require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const migrationFiles = [
  "001_roles.sql",
  "002_tables.sql",
  "003_indexes.sql",
  "004_trigger.sql",
  "005_functions.sql",
  "006_procedures.sql",
  "007_views.sql",
  "008_privileges.sql",
  "009_seed_data.sql",
];

(async () => {
  // Gunakan Client superuser (postgres) khusus untuk migrasi DDL
  const client = new Client({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5434,
    user: "postgres", // Wajib superuser agar punya hak CREATE SCHEMA/TABLE/ROLE
    password: process.env.POSTGRES_PASSWORD || "postgres", // Password postgres Anda
    database: process.env.DB_NAME || "webhook_manager",
  });

  try {
    await client.connect();

    // Pastikan schema public dimiliki oleh app_user atau memiliki izin CREATE
    await client.query(`
      GRANT ALL ON SCHEMA public TO app_user;
      GRANT CREATE ON SCHEMA public TO app_user;
      ALTER SCHEMA public OWNER TO app_user;
    `);

    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, "..", "db", file);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, "utf8");
        await client.query(sql);
        console.log(`Migration ${file} selesai.`);
      }
    }
    console.log("All migrations selesai.");
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();