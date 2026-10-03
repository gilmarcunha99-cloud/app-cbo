// Criação e migração do banco, para SQLite (desktop) e PostgreSQL (web).
// Roda automaticamente ao abrir o banco: na primeira vez cria as tabelas e os
// dados iniciais; nas próximas só aplica o que faltar.
const bcrypt = require('bcryptjs');

const SCHEMA_VERSION = 2;

// Tipos que mudam entre os bancos. Datas de negócio são texto AAAA-MM-DD nos dois.
const TIPOS = {
  sqlite: { id: 'INTEGER PRIMARY KEY AUTOINCREMENT', real: 'REAL', agora: "(datetime('now','localtime'))", ts: 'TEXT' },
  postgres: { id: 'SERIAL PRIMARY KEY', real: 'DOUBLE PRECISION', agora: 'now()', ts: 'TIMESTAMPTZ' },
};

function ddl(dialeto) {
  const t = TIPOS[dialeto];
  return `
CREATE TABLE IF NOT EXISTS usuarios (
  id            ${t.id},
  nome          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  senha_hash    TEXT    NOT NULL,
  perfil        TEXT    NOT NULL DEFAULT 'ADMIN' CHECK (perfil IN ('ADMIN','OPERADOR')),
  ativo         INTEGER NOT NULL DEFAULT 1,
  trocar_senha  INTEGER NOT NULL DEFAULT 0,
  criado_em     ${t.ts} NOT NULL DEFAULT ${t.agora}
);

CREATE TABLE IF NOT EXISTS cursos (
  id             ${t.id},
  nome           TEXT    NOT NULL,
  carga_horaria  INTEGER NOT NULL CHECK (carga_horaria > 0),
  descricao      TEXT,
  valor          ${t.real} NOT NULL CHECK (valor >= 0),
  instrutor      TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','INATIVO')),
  criado_em      ${t.ts} NOT NULL DEFAULT ${t.agora}
);

CREATE TABLE IF NOT EXISTS formas_pagamento (
  id                   ${t.id},
  nome                 TEXT    NOT NULL UNIQUE,
  max_parcelas         INTEGER NOT NULL DEFAULT 1 CHECK (max_parcelas >= 1),
  multa_percentual     ${t.real} NOT NULL DEFAULT 0 CHECK (multa_percentual >= 0),
  juros_mes_percentual ${t.real} NOT NULL DEFAULT 0 CHECK (juros_mes_percentual >= 0),
  status               TEXT    NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','INATIVO'))
);

CREATE TABLE IF NOT EXISTS alunos (
  id         ${t.id},
  nome       TEXT NOT NULL,
  cpf        TEXT NOT NULL UNIQUE,
  telefone   TEXT,
  email      TEXT,
  endereco   TEXT,
  criado_em  ${t.ts} NOT NULL DEFAULT ${t.agora}
);

CREATE TABLE IF NOT EXISTS matriculas (
  id                  ${t.id},
  aluno_id            INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  curso_id            INTEGER NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
  forma_pagamento_id  INTEGER NOT NULL REFERENCES formas_pagamento(id) ON DELETE RESTRICT,
  data_matricula      TEXT    NOT NULL,
  valor_total         ${t.real} NOT NULL,
  num_parcelas        INTEGER NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA','CONCLUIDA','CANCELADA'))
);

-- Cada parcela é uma cobrança. "Atrasado" não é gravado: é calculado
-- (status PENDENTE com vencimento no passado).
CREATE TABLE IF NOT EXISTS cobrancas (
  id               ${t.id},
  matricula_id     INTEGER NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
  numero_parcela   INTEGER NOT NULL,
  valor            ${t.real} NOT NULL,
  vencimento       TEXT    NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','PAGO','CANCELADO')),
  data_pagamento   TEXT,
  valor_pago       ${t.real},
  observacao       TEXT,
  criado_em        ${t.ts} NOT NULL DEFAULT ${t.agora},
  UNIQUE (matricula_id, numero_parcela)
);

CREATE TABLE IF NOT EXISTS configuracoes (
  chave  TEXT PRIMARY KEY,
  valor  TEXT
);

CREATE TABLE IF NOT EXISTS versao_schema (
  versao INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matriculas_aluno ON matriculas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_curso ON matriculas(curso_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_venc   ON cobrancas(vencimento);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON cobrancas(status);
`;
}

// A senha padrão precisa ser trocada no primeiro acesso (trocar_senha = 1).
const ADMIN_PADRAO = { nome: 'Administrador', email: 'admin@appcbo.com', senha: 'admin123' };

async function seed(db) {
  await db.run('INSERT INTO usuarios (nome, email, senha_hash, perfil, trocar_senha) VALUES (?, ?, ?, ?, 1)',
    [ADMIN_PADRAO.nome, ADMIN_PADRAO.email, bcrypt.hashSync(ADMIN_PADRAO.senha, 10), 'ADMIN']);

  const formas = [['Pix', 1, 2, 1], ['Cartão de Crédito', 12, 2, 1], ['Boleto Bancário', 6, 2, 1], ['Dinheiro', 1, 0, 0]];
  for (const f of formas) {
    await db.run('INSERT INTO formas_pagamento (nome, max_parcelas, multa_percentual, juros_mes_percentual) VALUES (?, ?, ?, ?)', f);
  }

  const cursos = [
    ['Alvenaria Básica', 40, 'Assentamento de blocos, prumo, nível e argamassa.', 450, 'A definir'],
    ['Leitura de Projetos', 24, 'Plantas, cortes, fachadas e escalas.', 380, 'A definir'],
    ['Pintura Residencial', 20, 'Preparação de superfícies, massa e pintura.', 320, 'A definir'],
  ];
  for (const c of cursos) {
    await db.run('INSERT INTO cursos (nome, carga_horaria, descricao, valor, instrutor) VALUES (?, ?, ?, ?, ?)', c);
  }

  const cfg = [['pix_chave', ''], ['pix_beneficiario', 'APP CBO CURSOS'], ['pix_cidade', 'SAO PAULO'], ['escola_nome', 'App.CBO - Curso Básico de Obras']];
  for (const c of cfg) await db.run('INSERT INTO configuracoes (chave, valor) VALUES (?, ?)', c);
}

async function versaoAtual(db) {
  if (db.dialeto === 'sqlite') {
    // Bancos da primeira versão do desktop guardavam a versão no user_version.
    const antiga = db.conn.pragma('user_version', { simple: true });
    const existe = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='versao_schema'");
    if (!existe) return antiga;
  } else {
    const existe = await db.get("SELECT to_regclass('versao_schema') AS t");
    if (!existe.t) return 0;
  }
  const r = await db.get('SELECT MAX(versao) AS v FROM versao_schema');
  return r?.v ?? 0;
}

async function migrate(db) {
  if (db.dialeto === 'sqlite') {
    const v = db.conn.pragma('user_version', { simple: true });
    const tem = db.conn.prepare("SELECT 1 FROM sqlite_master WHERE name='versao_schema'").get();
    if (tem && v >= SCHEMA_VERSION) return false;
  } else {
    // Checagem barata antes de pegar o lock (roda a cada início da função na Vercel).
    const tem = await db.get("SELECT to_regclass('versao_schema') AS t");
    if (tem.t) {
      const r = await db.get('SELECT MAX(versao) AS v FROM versao_schema');
      if ((r?.v ?? 0) >= SCHEMA_VERSION) return false;
    }
  }

  return db.transaction(async (tx) => {
    // Na web, duas funções podem iniciar juntas: o lock evita criar tudo em dobro.
    if (tx.dialeto === 'postgres') await tx.get('SELECT pg_advisory_xact_lock(424242)');
    const versao = await versaoAtual(tx);
    if (versao >= SCHEMA_VERSION) return false;

    if (versao === 1) {
      // v1 (desktop) -> v2: troca obrigatória da senha padrão.
      await tx.exec('ALTER TABLE usuarios ADD COLUMN trocar_senha INTEGER NOT NULL DEFAULT 0');
    }
    await tx.exec(ddl(tx.dialeto));
    if (versao === 0) await seed(tx);
    if (versao === 1) {
      const admin = await tx.get('SELECT senha_hash FROM usuarios WHERE email = ?', [ADMIN_PADRAO.email]);
      if (admin && bcrypt.compareSync(ADMIN_PADRAO.senha, admin.senha_hash)) {
        await tx.run('UPDATE usuarios SET trocar_senha = 1 WHERE email = ?', [ADMIN_PADRAO.email]);
      }
    }
    await tx.run('DELETE FROM versao_schema');
    await tx.run('INSERT INTO versao_schema (versao) VALUES (?)', [SCHEMA_VERSION]);
    if (tx.dialeto === 'sqlite') tx.conn.pragma(`user_version = ${SCHEMA_VERSION}`);
    return true;
  });
}

module.exports = { migrate, SCHEMA_VERSION, ADMIN_PADRAO };
