CREATE OR REPLACE PROCEDURE sp_create_webhook(
  p_user_id UUID,
  p_name VARCHAR(100),
  p_webhook_url TEXT,
  p_channel_name VARCHAR(100),
  p_config TEXT,
  OUT p_result JSON
)
LANGUAGE plpgsql
AS $$
DECLARE
  new_id UUID;
  v_role VARCHAR(20);
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Hanya admin yang boleh membuat webhook' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION 'name wajib diisi' USING ERRCODE = '23502';
  END IF;

  IF p_webhook_url IS NULL OR p_webhook_url = '' THEN
    RAISE EXCEPTION 'webhook_url wajib diisi' USING ERRCODE = '23502';
  END IF;

  INSERT INTO webhooks (user_id, name, webhook_url, channel_name, config)
  VALUES (p_user_id, p_name, p_webhook_url, p_channel_name, COALESCE(p_config, '{}'))
  RETURNING id INTO new_id;

  SELECT row_to_json(v) INTO p_result
  FROM v_uc1_webhook_management v
  WHERE id = new_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_login_user(
  p_username VARCHAR(50),
  OUT p_result JSON
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user users%ROWTYPE;
BEGIN
  SELECT * INTO v_user 
  FROM users 
  WHERE username = p_username AND is_active = TRUE;

  IF FOUND THEN
    SELECT json_build_object(
      'id', v_user.id,
      'username', v_user.username,
      'email', v_user.email,
      'role', v_user.role,
      'password_hash', v_user.password_hash
    ) INTO p_result;
  ELSE
    p_result := NULL;
  END IF;
END;
$$;
CREATE OR REPLACE PROCEDURE sp_get_all_webhooks(OUT p_result JSON)
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT COALESCE(json_agg(v ORDER BY v.created_at DESC), '[]'::json)
  INTO p_result
  FROM v_uc1_webhook_management v;
END;
$$;


CREATE OR REPLACE PROCEDURE sp_register_user(
  p_username VARCHAR(50),
  p_email VARCHAR(100),
  p_password_hash TEXT,
  OUT p_result JSON
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user users%ROWTYPE;
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE username = p_username) THEN
    RAISE EXCEPTION 'USERNAME_TAKEN';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
    RAISE EXCEPTION 'EMAIL_TAKEN';
  END IF;

  INSERT INTO users (username, email, password_hash, role, is_active)
  VALUES (p_username, p_email, p_password_hash, 'viewer', TRUE)
  RETURNING * INTO v_user;

  SELECT json_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'email', v_user.email,
    'role', v_user.role
  ) INTO p_result;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_create_password_reset(
  p_email VARCHAR(100),
  p_token_hash TEXT,
  p_expires_at TIMESTAMPTZ,
  OUT p_result JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE email = p_email AND is_active = TRUE;

  IF NOT FOUND THEN
    p_result := NULL; 
    RETURN;
  END IF;

  INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
  VALUES (v_user_id, p_token_hash, p_expires_at);

  SELECT json_build_object('user_id', v_user_id) INTO p_result;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_reset_password(
  p_token_hash TEXT,
  p_new_password_hash TEXT,
  OUT p_result JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token password_reset_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_token
  FROM password_reset_tokens
  WHERE token_hash = p_token_hash
    AND used_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    p_result := NULL;
    RETURN;
  END IF;

  UPDATE users
  SET password_hash = p_new_password_hash, updated_at = now()
  WHERE id = v_token.user_id;

  UPDATE password_reset_tokens
  SET used_at = now()
  WHERE id = v_token.id;

  SELECT json_build_object('user_id', v_token.user_id) INTO p_result;
END;
$$;


CREATE OR REPLACE PROCEDURE sp_upgrade_user_role(
  p_user_id UUID,
  p_new_role VARCHAR(20),
  OUT p_result JSON
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user users%ROWTYPE;
BEGIN
  IF p_new_role NOT IN ('operator', 'viewer', 'admin') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;

  UPDATE users
  SET role = p_new_role, updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_user;

  IF NOT FOUND THEN
    p_result := NULL;
    RETURN;
  END IF;

  SELECT json_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'email', v_user.email,
    'role', v_user.role
  ) INTO p_result;
END;
$$;


CREATE OR REPLACE PROCEDURE sp_get_webhook_by_id(
  p_id UUID,
  OUT p_result JSON
)
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT row_to_json(v) INTO p_result
  FROM v_uc1_webhook_management v
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_update_webhook(
  p_id UUID,
  p_user_id UUID,
  p_name VARCHAR(100),
  p_channel_name VARCHAR(100),
  p_is_active BOOLEAN,
  p_config TEXT,
  OUT p_result JSON
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_role VARCHAR(20);
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Hanya admin yang boleh mengubah webhook' USING ERRCODE = '42501';
  END IF;

  UPDATE webhooks
  SET name = COALESCE(p_name, name),
      channel_name = COALESCE(p_channel_name, channel_name),
      is_active = COALESCE(p_is_active, is_active),
      config = COALESCE(p_config, config)
  WHERE id = p_id;

  IF NOT FOUND THEN
    p_result := NULL;
    RETURN;
  END IF;

  SELECT row_to_json(v) INTO p_result
  FROM v_uc1_webhook_management v
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_delete_webhook(
  p_id UUID,
  p_user_id UUID,
  OUT p_deleted BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_role VARCHAR(20);
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Hanya admin yang boleh menghapus webhook' USING ERRCODE = '42501';
  END IF;

  DELETE FROM webhooks WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Webhook tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
  p_deleted := TRUE;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_send_webhook(
  p_webhook_id UUID,
  p_user_id UUID,
  p_payload TEXT,
  OUT p_result JSON
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_webhook webhooks%ROWTYPE;
  v_status INTEGER;
  v_success BOOLEAN;
  v_response TEXT;
  v_duration INTEGER;
  v_delivery_id BIGINT;
BEGIN
  SELECT * INTO v_webhook FROM webhooks WHERE id = p_webhook_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Webhook tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  IF v_webhook.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Webhook tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_webhook.is_active THEN
    RAISE EXCEPTION 'Webhook % sedang nonaktif', v_webhook.name USING ERRCODE = 'P0001';
  END IF;

  v_status := 200;
  v_success := TRUE;
  v_response := '{"message":"Webhook delivered successfully"}';
  v_duration := 1;

  INSERT INTO webhook_deliveries (webhook_id, status_code, success, duration_ms, response_body, payload)
  VALUES (p_webhook_id, v_status, v_success, v_duration, LEFT(v_response, 10000), COALESCE(p_payload, '{}'))
  RETURNING id INTO v_delivery_id;

  p_result := json_build_object(
    'delivery_id', v_delivery_id,
    'webhook_id', p_webhook_id,
    'webhook_name', v_webhook.name,
    'status_code', v_status,
    'success', v_success,
    'duration_ms', v_duration,
    'response_body', v_response,
    'payload', COALESCE(p_payload::json, '{"content":"Test webhook"}'::json),
    'mode', 'test'
  );
END;
$$;

CREATE OR REPLACE PROCEDURE sp_record_delivery(
  p_webhook_id UUID,
  p_status_code INTEGER,
  p_success BOOLEAN,
  p_duration_ms INTEGER,
  p_response_body TEXT,
  p_payload TEXT,
  OUT p_id BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO webhook_deliveries (webhook_id, status_code, success, duration_ms, response_body, payload)
  VALUES (p_webhook_id, p_status_code, p_success, p_duration_ms, LEFT(p_response_body, 10000), COALESCE(p_payload, '{}'))
  RETURNING id INTO p_id;
END;
$$;


CREATE OR REPLACE PROCEDURE sp_get_delivery_history(
  p_webhook_id UUID,
  OUT p_result JSON
)
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT COALESCE(json_agg(h ORDER BY h.created_at DESC), '[]'::json)
  INTO p_result
  FROM (
    SELECT * FROM v_uc3_delivery_history
    WHERE webhook_id = p_webhook_id
    ORDER BY created_at DESC
    LIMIT 100
  ) h;
END;
$$;


CREATE OR REPLACE PROCEDURE sp_get_webhook_stats(
  p_webhook_id UUID,
  OUT p_result JSON
)
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT row_to_json(v) INTO p_result
  FROM v_uc4_webhook_statistics v
  WHERE webhook_id = p_webhook_id;
END;
$$;


CREATE OR REPLACE PROCEDURE sp_get_all_users(OUT p_result JSON)
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT COALESCE(json_agg(u ORDER BY u.created_at DESC), '[]'::json)
  INTO p_result
  FROM (
    SELECT id, username, email, role, created_at FROM users
  ) u;
END;
$$;
