const { contextBridge, ipcRenderer } = require('electron');

// Única ponte entre a interface (React) e o sistema. A interface nunca
// acessa o banco diretamente.
contextBridge.exposeInMainWorld('appcbo', {
  invoke: (canal, args) => ipcRenderer.invoke('api', canal, args),
  salvarArquivo: (tipo, args) => ipcRenderer.invoke('arquivo.salvar', tipo, args),
  logout: () => ipcRenderer.invoke('auth.logout'),
});
