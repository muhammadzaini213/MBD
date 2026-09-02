DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_password';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'webhook_readonly') THEN
    CREATE ROLE webhook_readonly NOLOGIN;
  END IF;
END $$;