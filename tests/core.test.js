// Testes da camada de negócio (sem Electron). Rodar com: npm test
// Por padrão usam SQLite em memória. Para rodar também no PostgreSQL:
//   TEST_DATABASE_URL=postgres://usuario:senha@localhost/banco_de_teste npm test
// (o banco de teste é APAGADO e recriado a cada teste)
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/core');
const { executar } = require('../src/core/rpc');
const { calcularEncargos } = require('../src/core/services/cobrancas');
const { gerarPixCopiaECola, crc16 } = require('../src/core/services/pix');
const { dividirParcelas } = require('../src/core/services/alunos');
const { cpfValido, hojeISO, addMeses } = require('../src/core/utils');

const BANCOS = [['SQLite', async () => createApp({ arquivoSqlite: ':memory:' })]];

if (process.env.TEST_DATABASE_URL) {
  BANCOS.push(['PostgreSQL', async () => {
    const { criarPostgres } = require('../src/core/database/adapters/postgres');
    const limpar = criarPostgres(process.env.TEST_DATABASE_URL);
    await limpar.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await limpar.close();
    return createApp({ databaseUrl: process.env.TEST_DATABASE_URL });
  }]);
}

for (const [nomeBanco, novoApp] of BANCOS) {
  test(`[${nomeBanco}] cria as tabelas e os dados iniciais na primeira abertura`, async () => {
    const { db, close } = await novoApp();
    const tabelas = ['alunos', 'cobrancas', 'configuracoes', 'cursos', 'formas_pagamento', 'matriculas', 'usuarios'];
    for (const t of tabelas) {
      const r = await db.get(`SELECT COUNT(*) AS n FROM ${t}`);
      assert.equal(typeof r.n, 'number', `tabela ${t} deveria existir`);
    }
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM formas_pagamento')).n, 4);
    assert.equal((await db.get('SELECT versao FROM versao_schema')).versao, 2);
    await close();
  });

  test(`[${nomeBanco}] login, troca obrigatória da senha padrão e bloqueio até trocar`, async () => {
    const app = await novoApp();
    const { services, close } = app;
    const u = await services.auth.login('ADMIN@appcbo.com', 'admin123');
    assert.equal(u.perfil, 'ADMIN');
    assert.equal(u.trocarSenha, true);
    await assert.rejects(() => services.auth.login('admin@appcbo.com', 'errada'), /inválidos/);

    await assert.rejects(() => executar(app, 'cursos.listar', [], null), /Sessão expirada/);
    await assert.rejects(() => executar(app, 'cursos.listar', [], u), /Troque a senha/);
    await assert.rejects(() => executar(app, 'auth.alterarSenha', ['admin123', 'curta'], u), /8 caracteres/);
    const novo = await executar(app, 'auth.alterarSenha', ['admin123', 'SenhaForte#2026'], u);
    assert.equal(novo.trocarSenha, false);
    assert.ok((await executar(app, 'cursos.listar', [], novo)).length >= 3);
    await assert.rejects(() => executar(app, 'usuarios.apagarTudo', [], novo), /não permitida/);
    await close();
  });

  test(`[${nomeBanco}] CRUD de cursos com validação e bloqueio de exclusão`, async () => {
    const { services, close } = await novoApp();
    const c = await services.cursos.criar({ nome: 'Instalações Elétricas', carga_horaria: 30, valor: 500, instrutor: 'João' });
    assert.equal(c.status, 'ATIVO');
    await assert.rejects(() => services.cursos.criar({ nome: '', carga_horaria: 1, valor: 1, instrutor: 'x' }), /nome do curso/);
    await services.cursos.atualizar(c.id, { ...c, status: 'INATIVO' });
    assert.equal((await services.cursos.obter(c.id)).status, 'INATIVO');
    assert.equal((await services.cursos.listar({ busca: 'ELÉTR', status: 'INATIVO' })).length, 1);
    await services.cursos.excluir(c.id);
    await assert.rejects(() => services.cursos.obter(c.id), /não encontrado/);
    await close();
  });

  test(`[${nomeBanco}] aluno com matrícula gera parcelas mensais que somam o valor do curso`, async () => {
    const { services, close } = await novoApp();
    const curso = (await services.cursos.listar()).find((c) => c.nome === 'Alvenaria Básica'); // R$ 450
    const boleto = (await services.formasPagamento.listar()).find((f) => f.nome === 'Boleto Bancário');
    const aluno = await services.alunos.criar({
      nome: 'José da Silva', cpf: '529.982.247-25', telefone: '(11) 99999-0000',
      matricula: { curso_id: curso.id, forma_pagamento_id: boleto.id, num_parcelas: 4, primeiro_vencimento: '2030-01-31' },
    });
    const ficha = await services.alunos.ficha(aluno.id);
    assert.equal(ficha.emAberto.length, 4);
    assert.deepEqual(ficha.emAberto.map((c) => c.vencimento), ['2030-01-31', '2030-02-28', '2030-03-31', '2030-04-30']);
    assert.equal(ficha.totalEmAberto, 450);
    await assert.rejects(() => services.alunos.criar({ nome: 'Outro Nome', cpf: '529.982.247-25' }), /CPF/);
    await assert.rejects(() => services.alunos.matricular(aluno.id, { curso_id: curso.id, forma_pagamento_id: boleto.id, num_parcelas: 7 }), /no máximo 6/);
    // Erro no meio da matrícula não deixa aluno pela metade.
    await assert.rejects(() => services.alunos.criar({ nome: 'Pela Metade', cpf: '11144477735', matricula: { curso_id: curso.id } }), /forma de pagamento/);
    assert.equal((await services.alunos.listar({ busca: 'metade' })).length, 0);
    await close();
  });

  test(`[${nomeBanco}] parcela vencida aparece como ATRASADO com multa e juros; baixa manual`, async () => {
    const { services, close } = await novoApp();
    const curso = (await services.cursos.listar())[0];
    const pix = (await services.formasPagamento.listar()).find((f) => f.nome === 'Pix');
    const venc = addMeses(hojeISO(), -1);
    const aluno = await services.alunos.criar({
      nome: 'Maria Souza', cpf: '11144477735',
      matricula: { curso_id: curso.id, forma_pagamento_id: pix.id, num_parcelas: 1, primeiro_vencimento: venc },
    });
    const { linhas, totais } = await services.cobrancas.listar({ situacao: 'ATRASADO', alunoId: aluno.id });
    assert.equal(linhas.length, 1);
    assert.ok(linhas[0].valor_atualizado > linhas[0].valor);
    assert.equal(totais.atrasado, linhas[0].valor_atualizado);
    assert.equal((await services.alunos.listar())[0].parcelas_atrasadas, 1);

    const resumo = await services.dashboard.resumo();
    assert.equal(resumo.indicadores.parcelasAtrasadas, 1);
    assert.equal(resumo.indicadores.alunosAtivos, 1);
    assert.equal(resumo.matriculasPorMes.at(-1).matriculas, 1);

    await services.cobrancas.marcarComoPaga(linhas[0].id, { valorPago: 400 });
    assert.equal((await services.cobrancas.listar({ situacao: 'PAGO' })).linhas.length, 1);
    assert.equal((await services.dashboard.resumo()).indicadores.receitaMensal, 400);
    await services.cobrancas.estornar(linhas[0].id);
    assert.equal((await services.cobrancas.listar({ situacao: 'ATRASADO' })).linhas.length, 1);
    await close();
  });

  test(`[${nomeBanco}] configurações, Pix e geração de PDF/XLSX`, async () => {
    const { services, arquivos, close } = await novoApp();
    await services.configuracoes.salvar({ pix_chave: 'financeiro@appcbo.com' });
    assert.equal((await services.configuracoes.obter()).pix_chave, 'financeiro@appcbo.com');
    const curso = (await services.cursos.listar())[0];
    const forma = (await services.formasPagamento.listar())[0];
    await services.alunos.criar({ nome: 'Ana Pereira', cpf: '52998224725',
      matricula: { curso_id: curso.id, forma_pagamento_id: forma.id, num_parcelas: 1 } });
    const ids = (await services.cobrancas.listar()).linhas.map((c) => c.id);
    assert.match(await services.cobrancas.pixCopiaECola(ids[0]), /^000201/);
    const pdf = await arquivos.cobrancas(ids);
    assert.equal(pdf.buffer.subarray(0, 4).toString(), '%PDF');
    const xlsx = await arquivos.relatorio('xlsx', {});
    assert.equal(xlsx.buffer.subarray(0, 2).toString(), 'PK');
    const rel = await arquivos.relatorio('pdf', { situacao: 'PENDENTE' });
    assert.equal(rel.buffer.subarray(0, 4).toString(), '%PDF');
    await close();
  });
}

test('encargos: multa 2% + juros 1% ao mês pró-rata', () => {
  const e = calcularEncargos({ valor: 100, vencimento: '2030-01-01', multa_percentual: 2, juros_mes_percentual: 1 }, '2030-01-31');
  assert.equal(e.dias_atraso, 30);
  assert.equal(e.multa, 2);
  assert.equal(e.juros, 1);
  assert.equal(e.valor_atualizado, 103);
});

test('Pix Copia e Cola tem CRC válido', () => {
  const p = gerarPixCopiaECola({ chave: '12345678909', beneficiario: 'Escola Obra', cidade: 'São Paulo', valor: 150.5, txid: 'CBO1P1' });
  assert.match(p, /^000201/);
  assert.ok(p.includes('5406150.50'));
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
});

test('utilitários', () => {
  assert.ok(cpfValido('529.982.247-25'));
  assert.ok(!cpfValido('111.111.111-11'));
  assert.deepEqual(dividirParcelas(100, 3), [33.34, 33.33, 33.33]);
  assert.match(hojeISO(), /^\d{4}-\d{2}-\d{2}$/);
  // 01:00 UTC ainda é o dia anterior em Brasília.
  assert.equal(hojeISO(new Date('2030-03-10T01:00:00Z')), '2030-03-09');
});

test('sessão web: cookie assinado não pode ser forjado', () => {
  const { cookieSessao } = require('../src/web/sessao');
  const { lerCookie } = require('../src/web/sessao');
  const cookie = cookieSessao({ id: 7 }).split(';')[0];
  assert.deepEqual(lerCookie({ headers: { cookie } }), { id: 7 });
  const [nome, valor] = cookie.split('=');
  const [dados, assinatura] = valor.split('.');
  const forjado = Buffer.from(JSON.stringify({ id: 1, exp: 9999999999 })).toString('base64url');
  assert.equal(lerCookie({ headers: { cookie: `${nome}=${forjado}.${assinatura}` } }), null);
  assert.equal(lerCookie({ headers: { cookie: `${nome}=${dados}.xx` } }), null);
  assert.equal(lerCookie({ headers: {} }), null);
});
