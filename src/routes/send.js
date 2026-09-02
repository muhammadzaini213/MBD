const router = require("express").Router();
const { call } = require("../db");

function asHttpError(err) {
  if (err.code === "P0002") err.status = 404;
  else if (err.code === "P0001") err.status = 400;
}

router.post("/:id/send", async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) return res.status(400).json({ error: "X-User-Id header wajib diisi" });

    const payload = JSON.stringify(req.body || { content: "Test webhook" });

    const out = await call("sp_send_webhook", [req.params.id, userId, payload]);
    res.status(201).json(out.p_result);
  } catch (err) { asHttpError(err); next(err); }
});

module.exports = router;
