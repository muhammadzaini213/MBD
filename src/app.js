require("dotenv").config();
const express = require("express");
const webhooks = require("./routes/webhooks");
const send = require("./routes/send");
const deliveries = require("./routes/deliveries");
const stats = require("./routes/stats");
const health = require("./routes/health");
const users = require("./routes/users");
const login = require("./routes/auth");

const app = express();
app.use(express.json({ limit: "256kb" }));

app.get("/", (req, res) => {
  res.json({
    service: "Discord Webhook Manager API",
    version: "1.0.0",
    endpoints: ["/api/users", "/api/webhooks", "/api/send", "/api/deliveries", "/api/stats", "/health"]
  });
});

app.use("/auth", login);
app.use("/health", health);
app.use("/api/users", users);
app.use("/api/webhooks", webhooks);
app.use("/api/send", send);
app.use("/api/deliveries", deliveries);
app.use("/api/stats", stats);

app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }
  
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`API listening on :${port}`));
}

module.exports = app;
