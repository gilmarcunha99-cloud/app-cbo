// Funções HTTP da versão web. Usadas pela Vercel (pasta api/) e pelo
// servidor local de desenvolvimento (server/dev-web.js).
const { createApp } = require('../core');
const { executar, gerarArquivo } = require('../core/rpc');
const { ErroValidacao } = require('../core/utils');
const { lerCookie, cookieSessao, cookieSair } = require('./sessao');

// Uma conexão por instância da função; reaproveitada entre requisições.
let appPromise;
function obterApp() {
  if (!appPromise) {
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    appPromise = createApp(databaseUrl ? { databaseUrl } : { arquivoSqlite: process.env.APPCBO_DB || 'appcbo-web.sqlite' })
      .catch((e) => { appPromise = null; throw e; });
  }
  return appPromise;
}

async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let texto = '';
  for await (const parte of req) texto += parte;
  return JSON.parse(texto || '{}');
}

function responder(res, status, corpo, cabecalhos = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(cabecalhos)) res.setHeader(k, v);
  res.end(JSON.stringify(corpo));
}

// Só aceita POST com JSON: impede que outro site dispare ações usando o cookie.
function validarPedido(req, res) {
  if (req.method !== 'POST' || !String(req.headers['content-type'] || '').includes('application/json')) {
    responder(res, 405, { ok: false, erro: 'Método não permitido.' });
    return false;
  }
  return true;
}

function mensagemDeErro(err) {
  if (err instanceof ErroValidacao) return err.message;
  console.error(err);
  return 'Erro inesperado no servidor. Tente novamente.';
}

async function rpc(req, res) {
  if (!validarPedido(req, res)) return;
  try {
    const { canal, args } = await lerCorpo(req);
    if (canal === 'auth.logout') return responder(res, 200, { ok: true, data: true }, { 'Set-Cookie': cookieSair() });
    const app = await obterApp();
    const data = await executar(app, canal, args, lerCookie(req));
    const renova = canal === 'auth.login' || canal === 'auth.alterarSenha' || canal === 'auth.sessao';
    return responder(res, 200, { ok: true, data }, renova ? { 'Set-Cookie': cookieSessao(data) } : {});
  } catch (err) {
    return responder(res, 200, { ok: false, erro: mensagemDeErro(err) });
  }
}

async function arquivo(req, res) {
  if (!validarPedido(req, res)) return;
  try {
    const { tipo, args } = await lerCorpo(req);
    const app = await obterApp();
    const { buffer, nome, tipo: mime } = await gerarArquivo(app, tipo, args, lerCookie(req));
    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.end(buffer);
  } catch (err) {
    responder(res, 400, { ok: false, erro: mensagemDeErro(err) });
  }
}

module.exports = { rpc, arquivo };
