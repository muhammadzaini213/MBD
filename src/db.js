const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function call(procName, params = []) {
  const placeholders = params
    .map((_, i) => `$${i + 1}`)
    .concat(`$${params.length + 1}`)
    .join(", ");
  const sql = `CALL ${procName}(${placeholders})`;
  const { rows } = await pool.query(sql, [...params, null]);
  return rows[0];
}

module.exports = { pool, query, call };
