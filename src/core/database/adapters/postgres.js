// Banco na nuvem (web): PostgreSQL (Neon) via "pg".
// Os serviços escrevem SQL com "?"; aqui viram $1, $2… como o PostgreSQL exige.
const { Pool, types } = require('pg');

// COUNT/SUM de inteiros voltam como texto (bigint); converte para número.
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

const converter = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

function envolver(cliente, extras = {}) {
  const q = (sql, params = []) => cliente.query(converter(sql), params);
  return {
    dialeto: 'postgres',
    async all(sql, params) { return (await q(sql, params)).rows; },
    async get(sql, params) { return (await q(sql, params)).rows[0]; },
    async run(sql, params) { return { changes: (await q(sql, params)).rowCount }; },
    async insert(sql, params) { return (await q(`${sql} RETURNING id`, params)).rows[0].id; },
    async exec(sql) { await cliente.query(sql); },
    ...extras,
  };
}

function criarPostgres(connectionString) {
  const pool = new Pool({
    connectionString,
    max: 5,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : true,
  });

  const db = envolver(pool, {
    async transaction(fn) {
      const cliente = await pool.connect();
      const tx = envolver(cliente, { transaction: (f) => f(tx) });
      try {
        await cliente.query('BEGIN');
        const r = await fn(tx);
        await cliente.query('COMMIT');
        return r;
      } catch (e) {
        await cliente.query('ROLLBACK');
        throw e;
      } finally {
        cliente.release();
      }
    },
    close: () => pool.end(),
  });
  return db;
}

module.exports = { criarPostgres };
