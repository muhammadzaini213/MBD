# Discord Webhook Manager — Express.js + PostgreSQL + Docker

REST API sederhana untuk mengelola Discord Webhook, sekaligus mendemonstrasikan fitur PostgreSQL:

- **4 use case**
  1. CRUD webhook
  2. Test webhook / pencatatan delivery
  3. Riwayat delivery
  4. Statistik delivery
- PostgreSQL **procedure**
- PostgreSQL **function**
- PostgreSQL **trigger**
- PostgreSQL **view**
- **Optimization** dengan composite index, GIN index, pagination, dan `EXPLAIN ANALYZE`
- **B-tree index** PostgreSQL
- **JSONB**
- **User privilege / role**
- Docker Compose

> Catatan istilah index: PostgreSQL menyediakan index method `btree` (default). PostgreSQL tidak menyediakan index method bernama "b+tree" yang bisa dipilih sebagai `USING bplustree`. Struktur B-tree PostgreSQL memakai leaf pages yang saling terhubung dan cocok untuk equality/range/order queries, tetapi untuk tugas akademik sebaiknya tulis bahwa implementasi index yang digunakan adalah PostgreSQL B-tree, bukan B+tree terpisah.

## Jalankan

```bash
docker compose up --build
```

API:
- http://localhost:3000
- http://localhost:3000/health

## Endpoint

### Use case 1 — Webhook management

```http
GET    /api/webhooks
GET    /api/webhooks/:id
POST   /api/webhooks
PATCH  /api/webhooks/:id
DELETE /api/webhooks/:id
```

POST body:

```json
{
  "name": "Production",
  "webhook_url": "https://discord.com/api/webhooks/ID/TOKEN",
  "channel_name": "alerts",
  "config": {
    "username": "My Bot",
    "allowed_mentions": {
      "parse": []
    }
  }
}
```

### Use case 2 — Test / delivery

```http
POST /api/webhooks/:id/send
```

Body:

```json
{
  "content": "Hello from REST API"
}
```

Endpoint ini memanggil PostgreSQL procedure `sp_record_delivery()` secara langsung melalui `CALL`.

Catatan: validasi kepemilikan webhook (`fn_uc2_validate_ownership`) dan cek aktif webhook masih dipakai di endpoint sebelum prosedur dieksekusi.

### Use case 3 — Delivery history

```http
GET /api/deliveries?limit=50&offset=0
GET /api/deliveries/webhook/:webhookId
```

### Use case 4 — Statistics

```http
GET /api/stats
GET /api/stats/:webhookId
```

## PostgreSQL features

### Function

`delivery_success_rate(UUID)` menghitung persentase delivery sukses.

### Procedure

Endpoint sekarang memanggil procedure PostgreSQL langsung melalui `call()` dari Express:

- **`POST /api/webhooks`** → `CALL sp_create_webhook(...)` → insert webhook baru, return `p_id`
- **`POST /api/send/:id/send`** → `CALL sp_record_delivery(...)` → catat delivery, return `p_id` (delivery_id)

Contoh pemakaian `CALL` langsung:

```sql
-- Create webhook via procedure
CALL sp_create_webhook(
  'USER_UUID',
  'My Webhook',
  'https://discord.com/api/webhooks/ID/TOKEN',
  'channel_name'
);

-- Record delivery via procedure
CALL sp_record_delivery(
  'WEBHOOK_UUID',
  200,
  true,
  150,
  '{"message":"Delivered"}',
  '{"content":"test"}'::jsonb
);
```

### Trigger

`trg_webhooks_updated_at` otomatis mengubah `updated_at` saat row webhook di-update.

### View

- `v_webhook_overview`
- `v_delivery_history`
- `webhook_delivery_stats`

### JSONB

Kolom:
- `webhooks.config`
- `webhook_deliveries.payload`

Contoh query:

```sql
SELECT *
FROM webhooks
WHERE config @> '{"username":"My Bot"}';
```

GIN index `idx_webhooks_config_gin` membantu query JSONB containment seperti di atas.

### B-tree / optimization

Index utama:

```sql
CREATE INDEX idx_deliveries_webhook_created
ON webhook_deliveries (webhook_id, created_at DESC);
```

Ini cocok dengan query:

```sql
SELECT *
FROM v_delivery_history
WHERE webhook_id = '...'
ORDER BY created_at DESC
LIMIT 100;
```

Cek query planner:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM webhook_deliveries
WHERE webhook_id = '...'
ORDER BY created_at DESC
LIMIT 100;
```

Optimisasi yang sudah dipakai:
- parameterized query (`$1`, `$2`, ...)
- connection pool `pg`
- composite B-tree index
- GIN index untuk JSONB
- pagination `LIMIT/OFFSET`
- batas maksimum `limit=200`
- view sebagai read model
- statistik kolom JSONB ditingkatkan

## Privilege

Role:
- `app_user`: dipakai runtime API
- `webhook_readonly`: read-only reporting

Untuk environment production, ganti password default di Docker/secret manager dan jangan expose PostgreSQL port ke publik.
