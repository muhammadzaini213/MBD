CREATE OR REPLACE FUNCTION fn_success_rate(p_webhook_id UUID)
RETURNS NUMERIC(5,2)
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    ROUND(100.0 * COUNT(*) FILTER (WHERE success) / NULLIF(COUNT(*), 0), 2),
    0
  )
  FROM webhook_deliveries
  WHERE webhook_id = p_webhook_id;
$$;
