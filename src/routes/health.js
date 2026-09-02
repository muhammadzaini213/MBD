const router = require("express").Router();
const { pool } = require("../db");

router.get("/", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "ok", time: new Date().toISOString() });
  } catch (err) { next(err); }
});

module.exports = router;
