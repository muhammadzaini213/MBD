const router = require("express").Router();
const { call } = require("../db");

router.get("/:webhookId", async (req, res, next) => {
  try {
    const out = await call("sp_get_webhook_stats", [req.params.webhookId]);
    if (!out.p_result) return res.status(404).json({ error: "Statistik tidak ditemukan" });
    res.json(out.p_result);
  } catch (err) { next(err); }
});

module.exports = router;
