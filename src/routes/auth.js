const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { pool, call } = require("../db");

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const out = await call("sp_login_user", [username]);
    const user = out.p_result;

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    delete user.password_hash;

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({ user, token });
  } catch (err) {
    next(err);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // berlaku 30 menit

    const { rows } = await pool.query(
      `CALL sp_create_password_reset($1::varchar, $2::text, $3::timestamptz)`,
      [email, tokenHash, expiresAt]
    );
    const out = { p_result: rows[0]?.p_result };

    // Selalu balas pesan generik, supaya tidak bocorkan apakah email terdaftar
    // (mitigasi user enumeration).
    if (!out.p_result) {
      return res.json({ message: "If that email exists, a reset link has been sent." });
    }

    // TODO: kirim rawToken via email di production, JANGAN pernah return di response.
    // dev_token di bawah ini HANYA untuk testing lokal — hapus sebelum production.
    res.json({
      message: "If that email exists, a reset link has been sent.",
      dev_token: rawToken
    });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    const { rows } = await pool.query(
      `CALL sp_reset_password($1::text, $2::text)`,
      [tokenHash, newPasswordHash]
    );
    const out = { p_result: rows[0]?.p_result };
    
    if (!out.p_result) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    res.json({ message: "Password has been reset successfully." });
  } catch (err) {
    next(err);
  }
});

router.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const password_hash = await bcrypt.hash(password, 12);

    let out;
    try {
      out = await call("sp_register_user", [username, email, password_hash]);
    } catch (err) {
      if (err.message?.includes("USERNAME_TAKEN")) {
        return res.status(409).json({ error: "Username already taken" });
      }
      if (err.message?.includes("EMAIL_TAKEN")) {
        return res.status(409).json({ error: "Email already registered" });
      }
      throw err;
    }

    const user = out.p_result;

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
