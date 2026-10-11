import type { NextFunction, Request, Response } from 'express';

// Limiteur de débit en mémoire, par adresse : protège le moteur public des rafales (création d'entretiens en
// boucle, lecture de PDF à la chaîne, essais de jetons). Fenêtre glissante simple, sans dépendance.
interface Seau { debut: number; n: number }

export function rateLimit(max: number, fenetreMs: number, nom = 'api') {
  const seaux = new Map<string, Seau>();
  // Nettoyage périodique : les adresses inactives ne restent pas en mémoire.
  setInterval(() => {
    const now = Date.now();
    for (const [k, s] of seaux) if (now - s.debut > fenetreMs) seaux.delete(k);
  }, fenetreMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? '?';
    const now = Date.now();
    let s = seaux.get(ip);
    if (!s || now - s.debut > fenetreMs) { s = { debut: now, n: 0 }; seaux.set(ip, s); }
    s.n += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - s.n)));
    if (s.n > max) {
      res.setHeader('Retry-After', String(Math.ceil((s.debut + fenetreMs - now) / 1000)));
      return res.status(429).json({ error: `trop de requêtes (${nom}) : réessayez dans un instant` });
    }
    next();
  };
}
