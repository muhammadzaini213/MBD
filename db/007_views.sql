CREATE OR REPLACE VIEW v_uc1_webhook_management AS
SELECT
  w.id,
  w.user_id,
  u.username AS owner,
  w.name,
  w.webhook_url,
  w.channel_name,
  w.is_active,
  w.config,
  w.created_at,
  w.updated_at,
  fn_success_rate(w.id) AS success_rate
FROM webhooks w
JOIN users u ON u.id = w.user_id;

CREATE OR REPLACE VIEW v_uc2_delivery_result AS
SELECT
  d.id AS delivery_id,
  d.webhook_id,
  w.name AS webhook_name,
  w.webhook_url,
  d.status_code,
  d.success,
  d.duration_ms,
  d.response_body,
  d.payload,
  d.created_at
FROM webhook_deliveries d
JOIN webhooks w ON w.id = d.webhook_id;

CREATE OR REPLACE VIEW v_uc3_delivery_history AS
SELECT
  d.id,
  d.webhook_id,
  w.name AS webhook_name,
  w.channel_name,
  d.status_code,
  d.success,
  d.duration_ms,
  d.response_body,
  d.payload,
  d.created_at
FROM webhook_deliveries d
JOIN webhooks w ON w.id = d.webhook_id;

CREATE OR REPLACE VIEW v_uc4_webhook_statistics AS
SELECT
  w.id AS webhook_id,
  w.name AS webhook_name,
  w.channel_name,
  COUNT(d.id)::BIGINT AS total_deliveries,
  COUNT(d.id) FILTER (WHERE d.success)::BIGINT AS successful_deliveries,
  COUNT(d.id) FILTER (WHERE NOT d.success)::BIGINT AS failed_deliveries,
  ROUND(COALESCE(AVG(d.duration_ms), 0), 2) AS avg_duration_ms,
  fn_success_rate(w.id) AS success_rate
FROM webhooks w
LEFT JOIN webhook_deliveries d ON d.webhook_id = w.id
GROUP BY w.id, w.name, w.channel_name;