// Servidor local para testar a versão web sem publicar na Vercel.
// Uso: npm run dev:web  (abre http://localhost:5173)
// Com DATABASE_URL no arquivo .env usa o PostgreSQL (Neon); sem ele, um SQLite local.
const http = require('node:http');
const { rpc, arquivo } = require('../src/web/handlers');

const PORTA = Number(process.env.API_PORT || 3001);

http.createServer((req, res) => {
  const rota = req.url.split('?')[0];
  if (rota === '/api/rpc') return rpc(req, res);
  if (rota === '/api/arquivo') return arquivo(req, res);
  res.statusCode = 404;
  res.end('Não encontrado');
}).listen(PORTA, () => {
  const banco = process.env.DATABASE_URL ? 'PostgreSQL (DATABASE_URL)' : 'SQLite local (appcbo-web.sqlite)';
  console.log(`API do App.CBO em http://localhost:${PORTA} usando ${banco}`);
});
