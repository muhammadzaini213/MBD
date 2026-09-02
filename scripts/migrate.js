require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("../src/db");

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
  try {
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(__dirname, "..", "db", file), "utf8");
      await pool.query(sql);
      console.log(`Migration ${file} selesai.`);
    }
    console.log("All migrations selesai.");
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();