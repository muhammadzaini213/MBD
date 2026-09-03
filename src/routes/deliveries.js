const router = require("express").Router();
const { call } = require("../db");
const { verifyToken } = require("../middleware/auth");

router.get("/:webhookId", verifyToken, async (req, res, next) => {
  try {
    const out = await call("sp_get_delivery_history", [req.params.webhookId]);
    res.json(out.p_result);
  } catch (err) { next(err); }
});

module.exports = router;
