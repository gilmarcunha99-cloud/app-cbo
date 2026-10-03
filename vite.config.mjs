import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A interface (React) fica em src/renderer e é empacotada em dist/.
// base './' permite abrir o index.html direto pelo Electron (file://).
// Em "npm run dev:web", as chamadas /api vão para o servidor local (server/dev-web.js).
export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: { outDir: '../../dist', emptyOutDir: true },
});
