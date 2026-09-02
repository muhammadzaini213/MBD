const router = require("express").Router();
const { call } = require("../db");

router.get("/:webhookId", async (req, res, next) => {
  try {
    const out = await call("sp_get_delivery_history", [req.params.webhookId]);
    res.json(out.p_result);
  } catch (err) { next(err); }
});

module.exports = router;
