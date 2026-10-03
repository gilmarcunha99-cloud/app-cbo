// Versão de demonstração: o app inteiro roda no navegador, sem servidor.
// Serve para testar telas e regras antes de publicar na Vercel. Os dados ficam
// só neste navegador.
import './polyfills';
import { createApp } from '../core';
import { executar, gerarArquivo } from '../core/rpc';
import { criarSqlJs, apagarDemo } from './sqljs';

const SESSAO = 'appcbo-demo-sessao';
const lerSessao = () => {
  try { return JSON.parse(sessionStorage.getItem(SESSAO)); } catch { return null; }
};
const gravarSessao = (u) => {
  try { u ? sessionStorage.setItem(SESSAO, JSON.stringify({ id: u.id })) : sessionStorage.removeItem(SESSAO); } catch { /* sem armazenamento */ }
};

function baixar(buffer, nome, tipo) {
  const url = URL.createObjectURL(new Blob([buffer], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Na página publicada o CSS já vem embutido; se o arquivo .css separado for
// bloqueado, a tela continua abrindo.
window.addEventListener('vite:preloadError', (e) => e.preventDefault());

async function iniciar() {
  const app = await createApp(await criarSqlJs());

  // Mesmo formato da ponte do Electron: as telas não mudam nada.
  window.appcbo = {
    async invoke(canal, args) {
      try {
        const data = await executar(app, canal, args, lerSessao());
        if (canal === 'auth.login' || canal === 'auth.alterarSenha') gravarSessao(data);
        return { ok: true, data };
      } catch (err) {
        return { ok: false, erro: err.message };
      }
    },
    // A página de teste roda numa moldura que bloqueia downloads; no app publicado
    // (Vercel ou desktop) os arquivos são baixados normalmente.
    async salvarArquivo(tipo, args) {
      try {
        const { buffer, nome, tipo: mime } = await gerarArquivo(app, tipo, args, lerSessao());
        if (!window.appcboDemoPermiteDownload) {
          return { ok: false, erro: 'Na versão de teste não dá para baixar arquivos. O PDF e o Excel funcionam no app publicado.' };
        }
        baixar(buffer, nome, mime);
        return { ok: true, data: nome };
      } catch (err) {
        return { ok: false, erro: err.message };
      }
    },
    async logout() { gravarSessao(null); return { ok: true }; },
    demo: true,
    apagarDados() { apagarDemo(); gravarSessao(null); location.reload(); },
  };

  await import('../renderer/main.jsx');
}

iniciar().catch((err) => {
  document.getElementById('root').innerHTML =
    `<p style="font-family:sans-serif;padding:24px">Não foi possível iniciar a demonstração: ${String(err.message || err)}</p>`;
});
