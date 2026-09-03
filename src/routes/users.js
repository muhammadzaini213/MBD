const router = require("express").Router();
const { call } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

router.get(
  "/",
  verifyToken,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const out = await call("sp_get_all_users");
      const users = out.p_result.map(({ password_hash, ...rest }) => rest);
      res.json(users);
    } catch (err) { next(err); }
  }
);

router.patch(
  "/:id/role",
  verifyToken,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!["operator", "viewer", "admin"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const out = await call("sp_upgrade_user_role", [id, role]);
      if (!out.p_result) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password_hash, ...user } = out.p_result;
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
