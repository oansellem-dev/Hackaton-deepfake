# Conformité RGPD : vérification biométrique 1:1

Étape 1 : un lien envoyé au candidat (pré-vérification, gabarit du visage). Étape 2 : pendant la visio (Teams, Meet, Zoom ou notre visio de secours), on vérifie que c'est la même personne. Toujours une comparaison 1:1 avec le gabarit de l'étape 1, jamais une identification dans une base.

Stack réelle : Express + TypeScript (serveur), React + Vite (site), FastAPI (agent de score). Pas de Supabase : les accès sont contrôlés par le serveur (jeton recruteur, jeton de lien), le stockage est un fichier JSON avec les gabarits chiffrés à part.

## Audit (10-11 octobre 2026) et corrections

| Exigence | Avant | Après | Où |
|---|---|---|---|
| **A1** Empreinte calculée côté client, aucune photo envoyée | Absent : images JPEG envoyées à l'agent, qui calculait l'empreinte | **OK** : SFace et le détecteur passif tournent dans le navigateur (ONNX Runtime Web) ; aucune route n'accepte d'image | `apps/web/src/lib/faceModels.ts`, `apps/server/src/live.ts` (415 pour une image), agent sans `/frame` |
| **A2** Vrai embedding + seuil configurable | Partiel : seuils en dur | **OK** : `FACE_SAME_PERSON_MIN`, `FACE_DIFFERENT_PERSON_MAX`, `FACE_SHAPE_*` | `apps/server/src/config.ts` |
| **B1** Seul le gabarit, chiffré, clé distincte | OK | OK | `apps/server/src/biometric.ts` (AES-256-GCM, `BIOMETRIC_KEY`) |
| **B2** Lié à un ID aléatoire, pas à l'identité | Partiel : gabarit dans la fiche du candidat | **OK** : `templates.json` séparé, identifiant aléatoire, sans nom, e-mail ni identifiant d'entretien | `apps/server/src/templates.ts`, `store.ts` |
| **B3** Suppression fin de visio + TTL + endpoint manuel | Partiel : pas de suppression manuelle | **OK** : décision, `DELETE /api/sessions/:id/biometrics`, retrait, TTL réglable avec tâche planifiée | `store.ts` (`purgeBiometrics`, `sweepExpiredBiometrics`), `index.ts` |
| **B4** Pas de réutilisation | OK | OK | gabarit lu seulement par `live.ts`, pour le même entretien |
| **B5** Aucun gabarit dans les journaux | OK | OK, vérifié par test | `tools/e2e/server.mjs` (journal analysé) |
| **C1** Consentement explicite et complet | Partiel : ni responsable du traitement ni droit de retrait | **OK** : écran dédié avant la caméra, case non cochée, responsable (saisi par le recruteur), finalité, durée, droits, retrait | `apps/web/src/pages/Precheck.tsx`, `candidate.ts` (400 sans consentement) |
| **C2** Alternative non biométrique sans pénalité | Absent | **OK** : « Je préfère une vérification sans biométrie », signal neutre | `candidate.ts` (`/optout`) |
| **C3** Trace horodatée + retrait | Partiel : pas de retrait | **OK** : horodatage et version du texte (`CONSENT_VERSION`), retrait toujours possible | `candidate.ts` (`/withdraw`), `packages/shared/src/types.ts` |
| **C4** Mentions d'information | Absent | **OK sur le fond**, choix juridiques à compléter | `apps/web/src/pages/Privacy.tsx` |
| **D1** HTTPS, accès restreint | Partiel | **OK** côté code : `FORCE_HTTPS=1` (redirection, HSTS), `Referrer-Policy: no-referrer` ; gabarits jamais lisibles | `index.ts` ; le certificat dépend du déploiement |
| **D2** Lien à usage unique, expiration courte, jeton non devinable | Absent | **OK** : `/check/<jeton de 32 caractères>`, `CANDIDATE_LINK_TTL_HOURS` (24 h par défaut), usage unique | `store.ts`, `candidate.ts` |
| **D3** Aucun secret dans le dépôt | OK | OK | `.gitignore` (`apps/server/data/`, `.env`) |
| **E1** Passkey WebAuthn | Absent | **OK** : créée à la pré-vérification (facultative), confirmée en visio par un lien à usage unique | `webauthn.ts`, `Presence.tsx` |
| **E2** Défi aléatoire en direct | Partiel : ordre fixe, pas sur Teams | **OK** : tirage au hasard, détection sur la fenêtre Teams partagée | `RecruiterPanel.tsx`, `liveDetector.ts`, `Panel.tsx` |
| **E3** Détection liveness / deepfake | Partiel : côté serveur sur images | **OK** : dans le navigateur, sans enrôlement | `faceModels.ts` |
| **F1** Journal d'audit sans biométrie | Partiel : pas de journal, suppressions non tracées | **OK** : qui, quoi, quand, résultat, suppressions avec leur raison | `audit.ts`, rapport recruteur, `data/audit.jsonl` |

## Tests

- `node tools/e2e/server.mjs <données>` : 38 contrôles (refus sans consentement, usage unique, gabarits sans identité ni donnée en clair, suppression manuelle, retrait, alternative sans biométrie, journal sans biométrie).
- `node tools/e2e/retention.mjs <données>` avec `BIOMETRIC_TTL_SECONDS=3 BIOMETRIC_SWEEP_SECONDS=1 CANDIDATE_LINK_TTL_SECONDS=3` : expiration du lien et suppression automatique tracée.
- `node tools/e2e/browser.mjs …` dans Chrome : aucune requête d'image sur tout le parcours, clé d'accès créée puis confirmée (authentificateur virtuel), Teams simulé.
- `cd agent && .venv/Scripts/python -m pytest` : l'agent n'a aucune route d'image.

## Questions juridiques à trancher (pas par le code)

1. **Base légale** : consentement explicite (art. 9.2.a) dans une relation de recrutement, où le consentement doit être libre. L'alternative sans biométrie suffit-elle à le rendre libre ?
2. **Qualification** : la comparaison 1:1 (même personne qu'à l'étape 1) relève-t-elle de la « vérification biométrique », hors des pratiques interdites de l'AI Act, et le système reste-t-il « à haut risque » (annexe III, recrutement) avec les obligations qui vont avec ?
3. **Durées** : 24 h maximum pour le gabarit, et quelle durée pour le reste de la fiche (identité, signaux, journal, rapport) ?
4. **AIPD** : une analyse d'impact (DPIA) est très probablement obligatoire (biométrie + recrutement). Qui la porte : l'éditeur ou chaque client ?
5. **Rôles** : le client recruteur est responsable du traitement, l'éditeur sous-traitant (contrat art. 28 à prévoir) ? Hébergement et transferts hors UE ?
6. **Recherche du nom dans des sources publiques** : base légale (consentement ou intérêt légitime) et information du candidat suffisantes ?
7. **Détecteur passif DeepfakeGuard** : sa licence (recherche, non commerciale) interdit un usage commercial ; à remplacer avant tout client.
8. **Lien de confirmation d'appareil** collé dans Teams : acceptable dans les outils du client (journaux de discussion) ?
