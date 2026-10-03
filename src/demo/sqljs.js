// Banco da versão de demonstração: SQLite rodando dentro do navegador (sql.js),
// salvo no armazenamento do próprio navegador. Mesma interface dos outros adaptadores.
import initSqlJs from 'sql.js/dist/sql-asm.js';

const CHAVE = 'appcbo-demo-banco';

function paraBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function deBase64(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export async function criarSqlJs() {
  const SQL = await initSqlJs();
  let salvo = null;
  try { salvo = localStorage.getItem(CHAVE); } catch { /* sem armazenamento: fica só na memória */ }
  const conn = salvo ? new SQL.Database(deBase64(salvo)) : new SQL.Database();
  conn.run('PRAGMA foreign_keys = ON');

  let emTransacao = false;
  const salvar = () => {
    if (emTransacao) return;
    try { localStorage.setItem(CHAVE, paraBase64(conn.export())); } catch { /* cheio ou bloqueado */ }
    conn.run('PRAGMA foreign_keys = ON'); // export() desliga as chaves estrangeiras
  };

  const linhas = (sql, params = []) => {
    const st = conn.prepare(sql);
    try {
      st.bind(params.map((p) => (p === undefined ? null : p)));
      const out = [];
      while (st.step()) out.push(st.getAsObject());
      return out;
    } finally {
      st.free();
    }
  };

  // O schema usa pragma/prepare no estilo better-sqlite3; este é o mínimo necessário.
  const compat = {
    pragma(texto, opcoes) {
      const r = linhas(`PRAGMA ${texto}`);
      return opcoes && opcoes.simple ? (r[0] ? Object.values(r[0])[0] : undefined) : r;
    },
    prepare(sql) {
      return { get: (...p) => linhas(sql, p)[0] };
    },
  };

  const db = {
    dialeto: 'sqlite',
    conn: compat,
    async all(sql, params) { return linhas(sql, params); },
    async get(sql, params) { return linhas(sql, params)[0]; },
    async run(sql, params = []) {
      conn.run(sql, params.map((p) => (p === undefined ? null : p)));
      const changes = conn.getRowsModified();
      salvar();
      return { changes };
    },
    async insert(sql, params = []) {
      conn.run(sql, params.map((p) => (p === undefined ? null : p)));
      const id = linhas('SELECT last_insert_rowid() AS id')[0].id;
      salvar();
      return id;
    },
    async exec(sql) { conn.exec(sql); salvar(); },
    async transaction(fn) {
      if (emTransacao) return fn(db);
      conn.exec('BEGIN');
      emTransacao = true;
      try {
        const r = await fn(db);
        conn.exec('COMMIT');
        emTransacao = false;
        salvar();
        return r;
      } catch (e) {
        conn.exec('ROLLBACK');
        emTransacao = false;
        throw e;
      }
    },
    async close() { conn.close(); },
  };
  return db;
}

export function apagarDemo() {
  try { localStorage.removeItem(CHAVE); } catch { /* nada a apagar */ }
}
