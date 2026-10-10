import express from 'express';
import { FLASH_MAX_ATTEMPTS, describeFlash, sanitizeFlashAttempt, type FlashSubmission } from '@kyc/shared';
import { getSession, schedulePersist, upsertSignals } from './store.ts';

// Test du reflet de l'écran (après la vérification du visage). L'analyse se fait dans le navigateur du candidat ;
// le serveur reçoit seulement le résumé de chaque essai, puis « terminé ». Un test interrompu reste sans effet.
export const flashRouter = express.Router();

flashRouter.post('/api/sessions/:id/flash', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  if (!session.identity) return res.status(409).json({ error: 'consentement requis avant la caméra' });
  if (!session.faceId?.completedAt) return res.status(409).json({ error: 'vérification du visage à terminer d’abord' });
  if (session.screenFlash?.final) return res.status(409).json({ error: 'test du reflet déjà terminé' });

  const body = (req.body ?? {}) as Partial<FlashSubmission>;
  const attempt = body.attempt === undefined ? null : sanitizeFlashAttempt(body.attempt);
  if (body.attempt !== undefined && !attempt) return res.status(400).json({ error: 'essai invalide' });

  const previous = session.screenFlash?.attempts ?? [];
  // « Passer » n'est possible qu'avant le premier essai : un essai déjà fait reste dans le rapport.
  const skipped = body.skipped === true && !attempt && previous.length === 0;
  if (body.skipped === true && !skipped) return res.status(409).json({ error: 'un essai a déjà été fait' });
  const attempts = attempt ? [...previous, attempt] : previous;
  if (attempts.length > FLASH_MAX_ATTEMPTS) return res.status(409).json({ error: 'nombre d’essais dépassé' });

  const final = body.final === true || skipped || attempts.length === FLASH_MAX_ATTEMPTS;
  session.screenFlash = { attempts, final, skipped, at: Date.now() };
  upsertSignals(session, [
    { id: 'precheck.screen-flash', source: 'precheck', at: Date.now(), ...describeFlash(session.screenFlash) },
  ]);
  schedulePersist();
  // Le candidat apprend seulement que c'est enregistré : le verdict est pour le recruteur.
  res.json({ recorded: true, final });
});
