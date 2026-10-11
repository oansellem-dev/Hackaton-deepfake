import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const publicDir = fileURLToPath(new URL('public', import.meta.url));

// ONNX Runtime charge son moteur WASM par un import dynamique de /ort/*.mjs. En développement, Vite refuse
// d'importer un fichier de public/ comme module : on sert ces fichiers tels quels, avant ses propres traitements.
// (En production, le serveur Express les sert directement.)
const serveOrtRaw: Plugin = {
  name: 'serve-ort-raw',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split('?')[0] ?? '';
      if (!path.startsWith('/ort/')) return next();
      const file = join(publicDir, path);
      if (!existsSync(file)) return next();
      res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
      createReadStream(file).pipe(res);
    });
  },
};

// HTTPS=1 (fichier apps/web/.env) : certificat auto-signé, pour qu'un candidat sur une autre machine du même réseau
// puisse ouvrir son lien (la caméra n'est autorisée qu'en HTTPS ou sur localhost). Première visite : accepter l'avertissement.
export default defineConfig(({ mode }) => {
  const https = loadEnv(mode, process.cwd(), '').HTTPS === '1';
  return {
  plugins: [react(), serveOrtRaw, ...(https ? [basicSsl()] : [])],
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['bot-avatars'] },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
};
});
