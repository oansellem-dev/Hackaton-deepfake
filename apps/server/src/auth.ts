import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getSession } from './store.ts';

// Jeton du recruteur : donné une seule fois, à la création de l'entretien. Le lien du candidat ne contient que
// l'identifiant, qui ne permet ni de lire les signaux, ni de décider, ni d'enregistrer un défi.
export function hasRecruiterKey(req: Request, key: string | undefined): boolean {
  const given = String(req.get('x-recruiter-key') ?? req.query.key ?? '');
  if (!key || given.length !== key.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(key));
}

export function recruiterOnly(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  if (!hasRecruiterKey(req, session.recruiterKey)) return res.status(403).json({ error: 'réservé au recruteur' });
  next();
}
