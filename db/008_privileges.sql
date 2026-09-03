GRANT CONNECT ON DATABASE webhook_manager TO app_user, webhook_readonly;
GRANT USAGE ON SCHEMA public TO app_user, webhook_readonly;


GRANT SELECT ON users TO app_user;
REVOKE INSERT, UPDATE, DELETE ON users FROM app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON webhooks TO app_user;

GRANT SELECT, INSERT ON webhook_deliveries TO app_user;
GRANT USAGE, SELECT ON SEQUENCE webhook_deliveries_id_seq TO app_user;


GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO app_user;
GRANT SELECT, INSERT, UPDATE ON password_reset_tokens TO app_user;

GRANT SELECT ON v_uc1_webhook_management, v_uc2_delivery_result,
               v_uc3_delivery_history, v_uc4_webhook_statistics
TO app_user, webhook_readonly;

GRANT EXECUTE ON PROCEDURE sp_create_webhook(UUID, VARCHAR, TEXT, VARCHAR, TEXT) TO app_user;
GRANT EXECUTE ON PROCEDURE sp_get_all_webhooks() TO app_user;
GRANT EXECUTE ON PROCEDURE sp_get_webhook_by_id(UUID) TO app_user;
GRANT EXECUTE ON PROCEDURE sp_update_webhook(UUID, UUID, VARCHAR, VARCHAR, BOOLEAN, TEXT) TO app_user;
GRANT EXECUTE ON PROCEDURE sp_delete_webhook(UUID, UUID) TO app_user;
GRANT EXECUTE ON PROCEDURE sp_send_webhook(UUID, UUID, TEXT) TO app_user;
GRANT EXECUTE ON PROCEDURE sp_record_delivery(UUID, INTEGER, BOOLEAN, INTEGER, TEXT, TEXT) TO app_user;
GRANT EXECUTE ON PROCEDURE sp_get_delivery_history(UUID) TO app_user;
GRANT EXECUTE ON PROCEDURE sp_get_webhook_stats(UUID) TO app_user;
GRANT EXECUTE ON PROCEDURE sp_get_all_users() TO app_user;


GRANT EXECUTE ON PROCEDURE sp_register_user(VARCHAR, VARCHAR, TEXT) TO app_user;
GRANT EXECUTE ON PROCEDURE sp_login_user(VARCHAR) TO app_user;

GRANT EXECUTE ON PROCEDURE sp_create_password_reset(VARCHAR, TEXT, TIMESTAMPTZ) TO app_user;
GRANT EXECUTE ON PROCEDURE sp_reset_password(TEXT, TEXT) TO app_user;

GRANT EXECUTE ON PROCEDURE sp_upgrade_user_role(UUID, VARCHAR) TO app_user;

GRANT EXECUTE ON FUNCTION fn_success_rate(UUID) TO app_user;


ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO webhook_readonly;


ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;