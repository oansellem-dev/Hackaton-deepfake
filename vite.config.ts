import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Deux pages : index.html (dashboard + page candidat) et sidepanel.html (extension).
// `npm run build` produit dist/, chargeable tel quel comme extension non empaquetée.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        sidepanel: resolve(__dirname, "sidepanel.html"),
      },
    },
  },
});
