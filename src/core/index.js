// Ponto de entrada da lógica de negócio. Não depende de Electron nem de React:
// o desktop (Electron + SQLite) e a web (Vercel + Neon/PostgreSQL) usam o mesmo código.
const { migrate } = require('./database/schema');
const { authService } = require('./services/auth');
const { cursosService } = require('./services/cursos');
const { alunosService } = require('./services/alunos');
const { formasPagamentoService } = require('./services/formasPagamento');
const { cobrancasService } = require('./services/cobrancas');
const { dashboardService } = require('./services/dashboard');
const { configuracoesService } = require('./services/configuracoes');
const documentos = require('./services/documentos');
const { gerarPixCopiaECola } = require('./services/pix');

// Escolhe o banco: PostgreSQL se houver DATABASE_URL (Neon/Vercel), senão arquivo SQLite.
function abrirBanco({ databaseUrl, arquivoSqlite } = {}) {
  if (databaseUrl) return require('./database/adapters/postgres').criarPostgres(databaseUrl);
  return require('./database/adapters/sqlite').criarSqlite(arquivoSqlite);
}

async function createApp(opcoes) {
  const db = opcoes && opcoes.dialeto ? opcoes : abrirBanco(opcoes);
  await migrate(db);

  const services = {
    auth: authService(db),
    cursos: cursosService(db),
    alunos: alunosService(db),
    formasPagamento: formasPagamentoService(db),
    cobrancas: cobrancasService(db),
    dashboard: dashboardService(db),
    configuracoes: configuracoesService(db),
  };

  services.cobrancas.pixCopiaECola = async (id) => {
    const c = await services.cobrancas.obter(id);
    const cfg = await services.configuracoes.obter();
    return gerarPixCopiaECola({
      chave: cfg.pix_chave, beneficiario: cfg.pix_beneficiario, cidade: cfg.pix_cidade,
      valor: c.valor_atualizado, txid: `CBO${c.id}P${c.numero_parcela}`,
    });
  };

  // Geração de arquivos: devolve { buffer, nome, tipo }. Quem entrega é a camada de fora
  // (janela "Salvar como" no desktop, download no navegador).
  const hoje = () => new Date().toISOString().slice(0, 10);
  const arquivos = {
    async cobrancas(ids) {
      const buffer = await documentos.gerarCobrancasPdf(await services.cobrancas.obterVarias(ids), await services.configuracoes.obter());
      return { buffer, nome: `cobrancas-${hoje()}.pdf`, tipo: 'application/pdf' };
    },
    async relatorio(formato, filtros = {}) {
      const dados = await services.cobrancas.listar(filtros);
      if (formato === 'xlsx') {
        return {
          buffer: await documentos.gerarRelatorioXlsx(dados),
          nome: `relatorio-cobrancas-${hoje()}.xlsx`,
          tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }
      return {
        buffer: await documentos.gerarRelatorioPdf(dados, filtros, await services.configuracoes.obter()),
        nome: `relatorio-cobrancas-${hoje()}.pdf`,
        tipo: 'application/pdf',
      };
    },
  };

  return { db, services, arquivos, close: () => db.close() };
}

module.exports = { createApp, abrirBanco };
