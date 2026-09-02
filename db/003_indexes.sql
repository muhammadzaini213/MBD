CREATE INDEX IF NOT EXISTS idx_webhooks_user_created
  ON webhooks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_webhook_created
  ON webhook_deliveries (webhook_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhooks_active
  ON webhooks (is_active) WHERE is_active = TRUE;