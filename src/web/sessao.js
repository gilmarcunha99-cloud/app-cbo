// Sessão da versão web: cookie HttpOnly assinado com HMAC (sem guardar nada no banco).
const crypto = require('node:crypto');

const COOKIE = 'appcbo_sessao';
const DURACAO_S = 12 * 60 * 60; // 12 horas

// Use SESSION_SECRET na Vercel. Sem ela, deriva uma chave da URL do banco
// (que já é secreta), para o app funcionar sem configuração extra.
function chave() {
  const base = process.env.SESSION_SECRET || `appcbo:${process.env.DATABASE_URL || process.env.POSTGRES_URL || 'local-dev'}`;
  return crypto.createHash('sha256').update(base).digest();
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const assinar = (dados) => crypto.createHmac('sha256', chave()).update(dados).digest('base64url');

function criarToken(usuario) {
  const dados = b64(JSON.stringify({ id: usuario.id, exp: Math.floor(Date.now() / 1000) + DURACAO_S }));
  return `${dados}.${assinar(dados)}`;
}

function lerToken(token) {
  if (!token || !token.includes('.')) return null;
  const [dados, assinatura] = token.split('.');
  const esperado = assinar(dados);
  if (assinatura.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperado))) return null;
  try {
    const p = JSON.parse(Buffer.from(dados, 'base64url').toString());
    return p.exp > Date.now() / 1000 ? { id: p.id } : null;
  } catch {
    return null;
  }
}

function lerCookie(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return lerToken(m && m[1]);
}

const cookieSessao = (usuario) =>
  `${COOKIE}=${criarToken(usuario)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACAO_S}`;
const cookieSair = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

module.exports = { lerCookie, cookieSessao, cookieSair };
