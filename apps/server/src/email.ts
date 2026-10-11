import express from 'express';
import nodemailer from 'nodemailer';
import { hasRecruiterKey } from './auth.ts';
import { getSession } from './store.ts';

// Envoi de l'e-mail de pré-vérification depuis le dashboard déployé. Réservé au recruteur de l'entretien (clé),
// et seulement si un SMTP est configuré (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM). Sans SMTP, le dashboard
// ouvre la messagerie du recruteur avec l'e-mail déjà rédigé.
export const emailRouter = express.Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const env = process.env;
const configure = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
const port = Number(env.SMTP_PORT || 465);
const transport = configure ? nodemailer.createTransport({ host: env.SMTP_HOST, port, secure: port === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }) : null;
const expediteur = env.MAIL_FROM || (env.SMTP_USER ? `Oval <${env.SMTP_USER}>` : 'Oval <oval@exemple.fr>');

emailRouter.get('/api/email', (_req, res) => res.json({ configure, test: false }));

emailRouter.post('/api/email', async (req, res) => {
  if (!transport) return res.status(501).json({ erreur: 'envoi automatique non configuré sur le serveur' });
  const m = (req.body ?? {}) as { to?: string; subject?: string; html?: string; text?: string; sessionId?: string; key?: string };
  const session = m.sessionId ? getSession(m.sessionId) : undefined;
  if (!session || !m.key || !hasRecruiterKey({ get: () => m.key, query: {} } as never, session.recruiterKey)) return res.status(403).json({ erreur: 'réservé au recruteur de cet entretien' });
  if (!m.to || !EMAIL.test(m.to) || !m.subject || !m.html || m.html.length > 300_000) return res.status(400).json({ erreur: 'e-mail incomplet' });
  try {
    const info = await transport.sendMail({ from: expediteur, to: m.to, subject: m.subject.slice(0, 200), html: m.html, text: m.text });
    res.json({ ok: true, id: info.messageId });
  } catch (e) {
    res.status(502).json({ erreur: e instanceof Error ? e.message : "échec de l'envoi" });
  }
});
