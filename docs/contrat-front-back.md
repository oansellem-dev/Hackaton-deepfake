# Contrat front–back : interface Oval ↔ moteur

Branche d'intégration : `integration/oval-moteur`. Noms vérifiés dans `packages/shared/src/types.ts`,
`apps/server/src/index.ts`, `apps/server/src/candidate.ts`, `apps/server/src/live.ts` (11 octobre, 3 h).

## Les quatre décisions

| # | Décision | Choix |
|---|---|---|
| 1 | Qui fait quoi | **Oval** = interface finale côté recruteur (accueil, entretiens, rapport, envoi du lien, décision). Les pages caméra (candidat `/check/:token`, visio `/visio/:id`, panneau `/panel/:id`) restent celles du moteur (`apps/web`), habillées au design d'Oval. `apps/web` reste banc d'essai et secours. |
| 2 | Valeurs de décision | Celles d'Oval partout : `poursuivre`, `refaire_defi`, `presentiel` (et `non_prise` = pas de décision). Le serveur et les libellés du moteur sont mis à jour. |
| 3 | Comparaison de visages (`face.continuity`, `face.profile`) | Masquée dans Oval (pas dans son contrat, feuille de route du contexte v2). Le code du moteur est conservé. À confirmer avec Oren. |
| 4 | Test de lumière | Réglages actuels inchangés (`packages/shared/src/flash.ts`). Le passage aux fondus est du ressort de Gaspard. |

## Ports et adresses

| Quoi | Adresse |
|---|---|
| Serveur (API) | `http://localhost:8787` |
| Site du moteur (pages caméra) | `http://localhost:5173` — `VITE_MOTEUR_URL` côté Oval |
| Oval | `http://localhost:5174` — relaie `/api/*` vers 8787 (sauf `/api/email`, servi par Oval) |

## Routes utiles à Oval

### Recruteur (en-tête `X-Recruiter-Key: <recruiterKey>`)

| Route | Rôle | Réponse |
|---|---|---|
| `GET /api/health` | Le moteur répond ? (choix démo / moteur) | `{ ok: true }` |
| `POST /api/sessions` `{ candidateLabel, controllerName?, controllerContact? }` | Créer l'entretien | `SessionView & { recruiterKey }` — seule réponse qui contient la clé. `candidateLink.token` = jeton du lien |
| `GET /api/sessions/:id` | Synchronisation (toutes les 4 s) | `SessionView` |
| `POST /api/sessions/:id/challenges` `{ challengeId, result, durationMs, metrics? }` | Résultat d'un défi en direct | `SessionView` |
| `POST /api/sessions/:id/decision` `{ value, note? }` | Décision (décision 2) ; purge les biométries | `SessionView` |
| `DELETE /api/sessions/:id/biometrics` | Effacer le gabarit | `SessionView` |

### Candidat (jeton du lien, sans clé) — utilisées par `apps/web`, pas par Oval

`GET /api/check/:token` (info du lien : `status`, `identityDone`, `faceDone`, `flashDone`, `optedOut`, `withdrawn`),
`POST …/identity`, `…/precheck`, `…/faceid/start`, `…/faceid/submit`, `…/flash` (fenêtre de 10 min après le Face ID),
`…/optout`, `…/withdraw`, `…/device/options`, `…/device`.

Lien envoyé au candidat par Oval : `${VITE_MOTEUR_URL}/check/<candidateLink.token>`.

## Correspondance session du moteur → `Entretien` d'Oval (`apps/oval/src/store/moteur.ts`, `versEntretien`)

| Moteur (`SessionView`) | Oval (`Entretien`) |
|---|---|
| `id`, `recruiterKey` (à la création), `candidateLink.token` / `expiresAt` / `usedAt` | `moteur.sessionId`, `moteur.recruiterKey`, `moteur.lienToken` ; `preVerification.lien.token` / `expireLe` / `utiliseLe` |
| `identity.firstName`, `lastName`, `email`, `city` (une fois remplis) | `candidat.prenom`, `nom`, `email`, `villeDeclaree` (le poste reste celui saisi dans Oval) |
| lien créé → `identity` remplie ou `candidateLink.usedAt` → `faceId.completedAt` ou `biometricOptOut` → `consent.withdrawnAt` | `preVerification.statut` : `envoyee` → `ouverte` → `faite` ; `non_faite` + `refuseeLe` si retrait sans Face ID |
| `consent.infoAt` ; `precheckDone` | `etapes.accord` ; `etapes.camera` |
| `screenFlash` : `combine(attempts).result` `passed` / `failed` / `inconclusive` ; `skipped` | `etapes.lumiere` : `coherent` / `a_verifier` / `non_concluant` / `passe` |
| défi `hand-over-face` en phase `precheck` : `passed` / `failed` / `inconclusive` | `etapes.geste` : `coherent` / `a_verifier` / `non_concluant` |
| signal `status` : `ok` / `contradiction` / `unknown` | `resultat` : `coherent` (ou `rien_a_signaler` pour une simple information) / `a_verifier` / `non_concluant` |
| signal `severity` : `strong` / `medium` | `poids` : `fort` / `moyen` (`info` quand `status` = `unknown`) |
| signal `id` : `precheck.virtual-camera` (ok → `camera_physique`), `precheck.timezone`, `precheck.ip`, `precheck.screen-flash`, `identity.*` et `cv.*`, `challenge.*` en échec (phase live), `live.virtual-camera` | `type` : `camera_virtuelle` / `camera_physique`, `fuseau_horaire`, `adresse_connexion`, `test_lumiere`, `contradiction_cv`, `defi_non_execute`, `camera_virtuelle` (source `entretien`) |
| `face.continuity`, `face.profile`, `face.optout`, `face.withdrawn`, `device.bound` | Masqués (décision 3 ; le refus et le retrait passent par `preVerification.statut` / `refuseeLe`) |
| signal `label`, `detail`, `at` (ms) ; `source` ∈ {`precheck`, `identity`, `face`, `cv`, `device`} → `preverification`, `challenge` en phase live → `entretien` | `libelle`, `explication`, `a` (ISO), `source` ; `minute` = minutes depuis `createdAt` du premier défi live |
| `challenges[]` phase `live` : `hand-over-face`, `head-turn`, `random-phrase` ; `passed` / `failed` / `inconclusive` | `defis[]` : `main_devant_visage`, `rotation_tete`, `phrase_aleatoire` ; `reussi` / `a_verifier` / `non_concluant` ; `proposePar: "manta"` ; `debutMin` / `finMin` depuis `at` et `durationMs` |
| `score.value`, `score.explanation[]` | `score.valeur`, `score.resume` (lignes jointes par une ligne vide), `calculeLe` = maintenant |
| `decision.value` / `note` / `at` | `decision.valeur` / `note` / `le` |

Règles tenues par la correspondance : un `unknown` ne donne jamais un `a_verifier` ; une étape absente reste
`undefined` (jamais négative) ; aucune image ne transite (le moteur n'en reçoit pas non plus).

## Champs ajoutés au contrat d'Oval (`apps/oval/src/store/types.ts`)

- `Entretien.moteur?: { sessionId: string; recruiterKey: string; lienToken?: string }`
- `Reglages.donnees?: "demo" | "moteur"` (choix affiché dans Réglages, « moteur » par défaut si `/api/health` répond)
- `Reglages.entreprise?: string` (responsable du traitement envoyé en `controllerName`)
