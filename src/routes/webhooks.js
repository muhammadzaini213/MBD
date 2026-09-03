const router = require("express").Router();
const { call } = require("../db");
const { verifyToken } = require("../middleware/auth");

function asHttpError(err) {
  if (err.code === "P0002") err.status = 404;
  else if (err.code === "23502" || err.code === "23514") err.status = 400;
  else if (err.code === "23505") err.status = 409;
  else if (err.code === "42501") err.status = 403;
}

router.post("/", verifyToken, async (req, res, next) => {
  try {
    const { name, webhook_url, channel_name, config } = req.body;
    const out = await call("sp_create_webhook", [
      req.user.sub, name, webhook_url, channel_name ?? null,
      config ? JSON.stringify(config) : null
    ]);
    res.status(201).json(out.p_result);
  } catch (err) { asHttpError(err); next(err); }
});

router.get("/", verifyToken, async (req, res, next) => {
  try {
    const out = await call("sp_get_all_webhooks");
    res.json(out.p_result);
  } catch (err) { asHttpError(err); next(err); }
});

router.get("/:id", verifyToken, async (req, res, next) => {
  try {
    const out = await call("sp_get_webhook_by_id", [req.params.id]);
    if (!out.p_result) return res.status(404).json({ error: "Webhook tidak ditemukan" });
    res.json(out.p_result);
  } catch (err) { asHttpError(err); next(err); }
});

router.patch("/:id", verifyToken, async (req, res, next) => {
  try {
    const { name, channel_name, is_active, config } = req.body ?? {};
    const out = await call("sp_update_webhook", [
      req.params.id, req.user.sub, name ?? null, channel_name ?? null, is_active ?? null,
      config !== undefined ? JSON.stringify(config) : null
    ]);
    if (!out.p_result) return res.status(404).json({ error: "Webhook tidak ditemukan" });
    res.json(out.p_result);
  } catch (err) { asHttpError(err); next(err); }
});

router.delete("/:id", verifyToken, async (req, res, next) => {
  try {
    await call("sp_delete_webhook", [req.params.id, req.user.sub]);
    res.status(204).send();
  } catch (err) { asHttpError(err); next(err); }
});

module.exports = router;
