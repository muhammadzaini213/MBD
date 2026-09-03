const router = require("express").Router();
const { call } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

function asHttpError(err) {
  if (err.code === "P0002") err.status = 404;
  else if (err.code === "P0001") err.status = 400;
}

router.post("/:id/send", verifyToken, requireRole("operator", "admin"), async (req, res, next) => {
  try {
    const payload = JSON.stringify(req.body || { content: "Test webhook" });

    const out = await call("sp_send_webhook", [req.params.id, req.user.sub, payload]);
    res.status(201).json(out.p_result);
  } catch (err) { asHttpError(err); next(err); }
});

module.exports = router;
