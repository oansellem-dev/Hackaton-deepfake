import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { emailPlugin } from "./server/email";

// Deux pages : index.html (dashboard + page candidat) et sidepanel.html (extension).
// `npm run build` produit dist/, chargeable tel quel comme extension non empaquetée.
// Le serveur de dev expose aussi /api/email (envoi des liens de pré-vérification, voir server/email.ts).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), emailPlugin(env)],
    // Une seule copie de React pour les paquets de l'espace de travail (packages/design, bot-avatars).
    resolve: { dedupe: ["react", "react-dom"] },
    optimizeDeps: { include: ["bot-avatars"] },
    // Port fixe 5174 (le site du moteur est sur 5173). /api/* est relayé vers le serveur du moteur (8787),
    // sauf /api/email, servi ici par emailPlugin (même origine : pas de CORS).
    server: {
      port: 5174,
      strictPort: true,
      proxy: { "^/api/(?!email)": { target: env.MOTEUR_API_URL || "http://localhost:8787", changeOrigin: true } },
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "index.html"), sidepanel: resolve(__dirname, "sidepanel.html") },
      },
    },
  };
});
