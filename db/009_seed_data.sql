INSERT INTO users (username, email, password_hash, role, is_active, email_verified_at)
VALUES (
  'admin',
  'admin@example.com',
  '$2b$12$skxi4C1QWkyfTavU/kX1NeScb1fID.Hf915oLYZuEo/UA4TCDq9nS',
  'admin',
  TRUE,
  now()
)
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, email, password_hash, role, is_active, email_verified_at)
VALUES (
  'operator1',
  'operator1@example.com',
  '$2b$12$PYxSl5vKQc2lnbs2wVCmJODitr.DDZclwRLJYIIYZzR7Mz/VQVnt2',
  'operator',
  TRUE,
  now()
)
ON CONFLICT (username) DO NOTHING;

INSERT INTO webhooks (user_id, name, webhook_url, channel_name, config)
SELECT
  u.id,
  'Development Alerts',
  'https://discord.com/api/webhooks/example/example',
  'development',
  '{"username":"Webhook Bot","avatar_url":null}'
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (webhook_url) DO NOTHING;

INSERT INTO webhook_deliveries (webhook_id, status_code, success, duration_ms, response_body, payload)
SELECT
  w.id,
  v.status_code,
  v.success,
  v.duration_ms,
  v.response_body,
  v.payload
FROM webhooks w
CROSS JOIN (VALUES
  (200, TRUE,  120, '{"message":"Webhook delivered successfully"}', '{"content":"Deploy reminder"}'),
  (200, TRUE,   85, '{"message":"Webhook delivered successfully"}', '{"content":"Bug report"}'),
  (200, TRUE,  200, '{"message":"Webhook delivered successfully"}', '{"content":"Weekly summary"}'),
  (200, TRUE,   95, '{"message":"Webhook delivered successfully"}', '{"content":"New feature ready"}'),
  (200, TRUE,  110, '{"message":"Webhook delivered successfully"}', '{"content":"Test passed"}'),
  (500, FALSE, 300, '{"message":"Internal Server Error"}',      '{"content":"Failed deploy"}'),
  (429, FALSE,  50, '{"message":"Rate limited"}',               '{"content":"Spam test"}'),
  (200, TRUE,   78, '{"message":"Webhook delivered successfully"}', '{"content":"Hotfix applied"}'),
  (200, TRUE,  130, '{"message":"Webhook delivered successfully"}', '{"content":"Config updated"}'),
  (502, FALSE, 500, '{"message":"Bad Gateway"}',                '{"content":"Server down"}')
) AS v(status_code, success, duration_ms, response_body, payload)
WHERE w.name = 'Development Alerts'
ON CONFLICT DO NOTHING;