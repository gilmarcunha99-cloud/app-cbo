const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { createApp } = require('../src/core');
const { executar, gerarArquivo } = require('../src/core/rpc');

// Datas, números e calendários no padrão brasileiro.
app.commandLine.appendSwitch('lang', 'pt-BR');

let janela;
let core;
let usuarioLogado = null;

function registrarIpc() {
  // Mesma lista de operações da versão web (src/core/rpc.js).
  ipcMain.handle('api', async (_e, canal, args = []) => {
    try {
      const data = await executar(core, canal, args, usuarioLogado);
      if (canal === 'auth.login' || canal === 'auth.alterarSenha') usuarioLogado = data;
      return { ok: true, data };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('auth.logout', () => { usuarioLogado = null; return { ok: true }; });

  // Gera o arquivo na camada core e pergunta onde salvar.
  ipcMain.handle('arquivo.salvar', async (_e, tipo, args = []) => {
    try {
      const { buffer, nome } = await gerarArquivo(core, tipo, args, usuarioLogado);
      const ext = nome.split('.').pop();
      const { canceled, filePath } = await dialog.showSaveDialog(janela, {
        defaultPath: path.join(app.getPath('documents'), nome),
        filters: [ext === 'xlsx' ? { name: 'Excel', extensions: ['xlsx'] } : { name: 'PDF', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return { ok: true, data: null };
      fs.writeFileSync(filePath, buffer);
      shell.openPath(filePath);
      return { ok: true, data: filePath };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    title: 'App.CBO',
    backgroundColor: '#111827',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    janela.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    janela.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  // O banco fica na pasta de dados do usuário (ex.: %APPDATA%/App.CBO no Windows).
  const arquivoSqlite = process.env.APPCBO_DB || path.join(app.getPath('userData'), 'appcbo.sqlite');
  try {
    core = await createApp({ arquivoSqlite });
  } catch (err) {
    dialog.showErrorBox('App.CBO não conseguiu abrir o banco de dados', `${err.message}\n\nSe você rodou "npm test", rode "npm run rebuild:electron" antes de abrir o app.`);
    app.quit();
    return;
  }
  registrarIpc();
  criarJanela();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && criarJanela());
});

app.on('window-all-closed', () => {
  core?.close();
  if (process.platform !== 'darwin') app.quit();
});
