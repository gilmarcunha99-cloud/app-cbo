// Banco local (desktop): arquivo SQLite via better-sqlite3.
// Expõe a mesma interface assíncrona do adaptador PostgreSQL, para que os
// serviços não saibam qual banco estão usando.
function criarSqlite(arquivo) {
  const Database = require('better-sqlite3');
  const conn = new Database(arquivo);
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');

  const db = {
    dialeto: 'sqlite',
    conn,
    async all(sql, params = []) { return conn.prepare(sql).all(params); },
    async get(sql, params = []) { return conn.prepare(sql).get(params); },
    async run(sql, params = []) { return { changes: conn.prepare(sql).run(params).changes }; },
    async insert(sql, params = []) { return Number(conn.prepare(sql).run(params).lastInsertRowid); },
    async exec(sql) { conn.exec(sql); },
    // As chamadas do better-sqlite3 são síncronas, então nada se intercala
    // entre BEGIN e COMMIT mesmo com funções async.
    async transaction(fn) {
      if (conn.inTransaction) return fn(db);
      conn.exec('BEGIN');
      try {
        const r = await fn(db);
        conn.exec('COMMIT');
        return r;
      } catch (e) {
        conn.exec('ROLLBACK');
        throw e;
      }
    },
    async close() { conn.close(); },
  };
  return db;
}

module.exports = { criarSqlite };
