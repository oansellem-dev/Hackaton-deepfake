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
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "index.html"), sidepanel: resolve(__dirname, "sidepanel.html") },
      },
    },
  };
});
