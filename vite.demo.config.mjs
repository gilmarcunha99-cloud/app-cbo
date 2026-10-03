import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Versão de demonstração (tudo no navegador): npm run build:demo -> dist-demo/
const raiz = path.resolve(import.meta.dirname);
const vazio = path.join(raiz, 'src/demo/vazio.js');

export default defineConfig({
  root: 'src/demo',
  base: './',
  plugins: [react()],
  css: { postcss: raiz },
  define: { 'process.env': '{}' },
  resolve: {
    alias: {
      pdfkit: path.join(raiz, 'node_modules/pdfkit/js/pdfkit.standalone.js'),
      exceljs: path.join(raiz, 'node_modules/exceljs/dist/exceljs.min.js'),
      'better-sqlite3': vazio,
      pg: vazio,
    },
  },
  build: {
    outDir: '../../dist-demo',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
    commonjsOptions: { include: [/src[\\/]core/, /src[\\/]demo[\\/]vazio/, /node_modules/], transformMixedEsModules: true },
  },
});
