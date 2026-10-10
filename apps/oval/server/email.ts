/**
 * ENVOI DES E-MAILS DE PRÉ-VÉRIFICATION — tourne dans le serveur de dev Vite (`npm run dev`).
 * POST /api/email  { to, subject, html, text }  → envoie via SMTP (identifiants dans .env).
 * GET  /api/email  → { configure, test }
 * Sécurité : réservé au poste du recruteur (requêtes locales, même origine, JSON uniquement).
 * L'équipe serveur pourra déplacer ce code tel quel dans son propre serveur.
 */
import type { Plugin } from "vite";
import nodemailer from "nodemailer";
import { mkdirSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sansPrefixe = (a = "") => a.replace(/^::ffff:/, "");
const adressesLocales = () => new Set(["127.0.0.1", "::1", ...Object.values(networkInterfaces()).flat().flatMap((i) => (i ? [sansPrefixe(i.address)] : []))]);

export function emailPlugin(env: Record<string, string>): Plugin {
  const test = env.SMTP_HOST === "test";
  const configure = test || !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  const port = Number(env.SMTP_PORT || 465);
  const transport = test
    ? nodemailer.createTransport({ jsonTransport: true })
    : configure ? nodemailer.createTransport({ host: env.SMTP_HOST, port, secure: port === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }) : null;
  const expediteur = env.MAIL_FROM || (env.SMTP_USER ? `Oval <${env.SMTP_USER}>` : "Oval <oval@exemple.fr>");

  return {
    name: "oval-email",
    configureServer(server) {
      server.middlewares.use("/api/email", async (req, res) => {
        const json = (code: number, body: unknown) => { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); };
        if (req.method === "GET") return json(200, { configure, test });
        if (req.method !== "POST") return json(405, { erreur: "Méthode non autorisée." });
        if (!adressesLocales().has(sansPrefixe(req.socket.remoteAddress))) return json(403, { erreur: "Envoi réservé au poste du recruteur." });
        const origine = req.headers.origin;
        if (origine && new URL(origine).host !== req.headers.host) return json(403, { erreur: "Origine refusée." });
        if (!String(req.headers["content-type"] ?? "").includes("application/json")) return json(415, { erreur: "JSON attendu." });
        if (!transport) return json(501, { erreur: "envoi automatique non configuré (fichier .env)" });

        let brut = "";
        for await (const morceau of req) { brut += morceau; if (brut.length > 300_000) return json(413, { erreur: "E-mail trop volumineux." }); }
        let m: { to?: string; subject?: string; html?: string; text?: string };
        try { m = JSON.parse(brut); } catch { return json(400, { erreur: "Requête illisible." }); }
        if (!m.to || !EMAIL.test(m.to) || !m.subject || !m.html) return json(400, { erreur: "E-mail incomplet." });

        try {
          const info = await transport.sendMail({ from: expediteur, to: m.to, subject: m.subject, html: m.html, text: m.text });
          if (test) {
            mkdirSync("outbox", { recursive: true });
            const fichier = `outbox/${new Date().toISOString().replace(/[:.]/g, "-")}-${m.to.replace(/[^a-z0-9@._-]/gi, "_")}.html`;
            writeFileSync(fichier, m.html);
            server.config.logger.info(`[oval] e-mail de test enregistré : ${fichier}`);
            return json(200, { ok: true, test: true, fichier });
          }
          server.config.logger.info(`[oval] e-mail envoyé à ${m.to}`);
          return json(200, { ok: true, id: info.messageId });
        } catch (e) {
          return json(502, { erreur: e instanceof Error ? e.message : "échec de l'envoi" });
        }
      });
    },
  };
}
