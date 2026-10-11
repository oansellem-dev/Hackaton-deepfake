# Oval — un vrai visage derrière chaque écran

> **EN (summary).** Oval verifies that a real human, and the right one, is present in a recruiting video call. A two-minute pre-check before the interview (identity, face, environment), then a floating Chrome widget on Meet / Zoom / Teams that watches for live deepfakes, face swaps and virtual cameras, and lets the recruiter trigger simple challenges. Everything is analysed in the browser; no video ever leaves it. The recruiter decides, the tool informs.

Oval vérifie qu'un humain réel, et le bon, est présent dans une visio de recrutement. Le recruteur décide, l'outil éclaire.

- **Guide pour le jury (tester en 5 minutes, lancer en local)** : [docs/jury/README.md](docs/jury/README.md)
- Dashboard recruteur en ligne : https://oval-moteur.onrender.com/app/
- Démo publique du moteur (page candidat, panneau) : https://oval-moteur.onrender.com
- Point d'étape complet : [docs/point-etape-2026-10-11.md](docs/point-etape-2026-10-11.md)
- Fiche de défense (1 page) : [docs/fiche-defense.md](docs/fiche-defense.md)
- Conformité RGPD : [docs/conformite-rgpd.md](docs/conformite-rgpd.md) · Contrat front–back : [docs/contrat-front-back.md](docs/contrat-front-back.md)

---

## 1. Le problème

Les deepfakes en direct (face-swap, filtres, caméras virtuelles) permettent à une personne de passer un entretien à la place d'une autre, ou de maquiller son identité. Les cas documentés se multiplient dans le recrutement à distance. Les recruteurs n'ont aucun outil pour le détecter sans casser l'expérience candidat, et un verdict automatique serait à la fois illégal (décision biométrique) et dangereux (faux positifs).

## 2. La solution

Trois briques qui se parlent, et un principe : **le score part de 100 et ne baisse que sur des contradictions** (un défi raté, un visage différent de la pré-vérification, un détecteur qui s'affole, une information qui contredit le CV). Rien n'est jamais « prouvé humain » : tant qu'aucune preuve n'a été collectée, l'écran dit « Pas encore vérifié ».

| Brique | Pour qui | Ce qu'elle fait |
|---|---|---|
| **Dashboard Oval** (`apps/oval`) | Le recruteur | Calendrier des entretiens, dépôt du CV, envoi du lien de pré-vérification par e-mail, notifications de créneau, rapports, décision. Français / anglais. |
| **Parcours candidat** (`apps/web` + `apps/server`) | Le candidat | Lien personnel à usage unique : créneau à confirmer ou contre-proposer, informations pré-remplies d'après le CV, consentement, capture du visage (empreinte et proportions calculées dans le navigateur), test de reflet d'écran, appareil (passkey). |
| **Extension Chrome** (`apps/extension`) | Le recruteur, pendant la visio | Widget flottant façon Loom sur Meet / Zoom / Teams : continuité du visage avec la pré-vérification, détecteur passif de trucage, défis à lancer (main devant le visage, rotation de la tête, phrase), caméra virtuelle, score en direct. |

**Flux complet** : le recruteur crée l'entretien (CV, créneau, lien Meet) → le candidat reçoit un e-mail → il fait sa pré-vérification (2 min) → le jour J, le recruteur ouvre le widget sur la visio → signaux, défis → rapport et décision tracée.

## 3. Architecture

```
Hackaton-deepfake/
├── apps/
│   ├── oval/        Dashboard recruteur : React 18 + Vite + CSS, tokens de design, i18n FR/EN
│   ├── web/         Site du moteur : parcours candidat /check, panneau /panel, rapport /report
│   │                MediaPipe (visage, mains) + ONNX Runtime Web (SFace, DeepfakeGuard) dans le navigateur
│   ├── server/      API Express (TypeScript) : sessions, CV (pdf-parse), défis, score, continuité du visage,
│   │                passkeys WebAuthn, journal d'audit, chiffrement AES-256-GCM des gabarits
│   └── extension/   Extension Chrome MV3 : widget flottant (shadow DOM), side panel, service worker
├── packages/
│   ├── shared/      Types, bibliothèque de défis, calcul du score, contrôles d'environnement (tests unitaires)
│   ├── panel/       Panneau recruteur partagé (extension + visio de secours), client API
│   └── design/      Tokens CSS et mascotte Manta
├── agent/           Détecteur Python FastAPI, optionnel (le moteur fonctionne sans)
└── render.yaml      Déploiement du moteur (serveur + site construit) sur Render
```

**Où tourne l'analyse ?** Dans le navigateur du candidat (pré-vérification) et du recruteur (visio). Le serveur ne reçoit que des nombres : similarités, proportions, probabilités, résultats de défis. Aucune image ni vidéo n'est transmise ni enregistrée.

**Ce qui fait baisser le score** (`packages/shared/src/score.ts`) :
- un défi non exécuté ou une image déformée pendant le geste ;
- un visage encore détecté sous la main pendant le défi « main devant le visage » (signature d'un visage dessiné par-dessus l'image) ;
- une empreinte ou des proportions différentes de la pré-vérification ;
- une probabilité de trucage élevée et persistante (détecteur passif) ;
- une caméra virtuelle réellement utilisée ;
- une information déclarée qui contredit le CV ou les sources publiques.

Un signal « inconnu » n'a jamais d'effet. Le recruteur voit chaque signal avec son explication, jamais un verdict.

## 4. Installation

Prérequis : Node 22, npm 10, Chrome.

```bash
npm install
npm run dev        # serveur :8787, site du moteur :5173, dashboard :5174, extension en watch
```

| Quoi | Adresse |
|---|---|
| Dashboard recruteur | http://localhost:5174 |
| Page candidat (lien envoyé par e-mail) | http://localhost:5173/check/<jeton> |
| Panneau pour Meet / Zoom / Teams | http://localhost:5173/panel/<id>?key=<clé recruteur> |
| Rapport | http://localhost:5173/report/<id>?key=<clé recruteur> |

**Extension Chrome** : `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » → `apps/extension/dist`. Sur une page Meet / Zoom / Teams (ou n'importe quelle page après un clic sur l'icône), la bulle Oval apparaît ; coller le code « identifiant:clé » donné par le dashboard (fiche de l'entretien → « Code extension »). Par défaut l'extension parle au moteur déployé ; pour un moteur local, créer `apps/extension/.env` avec `VITE_API_URL=http://localhost:8787` et `VITE_WEB_URL=http://localhost:5173` puis rebuild.

**Dashboard** (`apps/oval/.env`, facultatif) :

```
VITE_MOTEUR_URL=https://oval-moteur.onrender.com   # moteur public (sinon http://localhost:5173)
MOTEUR_API_URL=https://oval-moteur.onrender.com    # relais /api du serveur de dev
SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_USER=…  SMTP_PASS=…  MAIL_FROM="Oval <…>"
```

Sans SMTP, le dashboard ouvre la messagerie du recruteur avec l'e-mail déjà rédigé.

**Serveur** (variables facultatives) : `BIOMETRIC_KEY` (AES-256, sinon générée dans `data/biometric.key`), `BIOMETRIC_TTL_HOURS` (24), `CANDIDATE_LINK_TTL_HOURS` (24), `FORCE_HTTPS=1` derrière un proxy TLS, `AGENT_URL` si l'agent Python tourne, `BRAVE_API_KEY` / `GITHUB_TOKEN` pour les vérifications publiques.

**Qualité** : `npm run typecheck`, `npm test` (21 tests), `npm run build`.

**Déploiement** : `render.yaml` déploie le moteur (serveur + site) en un service web ; chaque push sur `integration/oval-moteur` redéploie.

**Agent Python (optionnel)** : `cd agent && python -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python -m uvicorn app.main:app --port 8000`. Il ajoute un second détecteur et une explication rédigée ; sans lui, le moteur calcule tout seul.

## 5. Tests et résultats

- Score : avec un filtre vidéo ou un face-swap sur la visio, le score descend (détecteur passif + défi « main devant le visage »), là où la première version restait à 100. Simulations par l'API : 65 (orange) et 30 (rouge).
- Continuité du visage : similarité d'empreinte médiane sur 30 captures, seuils 0,40 (même) / 0,25 (différent) ; proportions ≥ 12 % d'écart = différent. Entre les deux, pas de conclusion.
- Parcours candidat, dashboard et widget vérifiés de bout en bout en local et sur le moteur déployé (voir le point d'étape).
- Sécurité : jeton recruteur comparé à temps constant, lien candidat à usage unique, limiteur de débit par adresse, `Referrer-Policy: no-referrer`, HTTPS forcé en production, e-mails échappés, gabarits chiffrés et supprimés à la décision ou après 24 h.

## 6. Limites connues

- **Hébergement gratuit** : le disque de Render est éphémère, les sessions disparaissent au redéploiement ou à la mise en veille ; le moteur dort après inactivité (jusqu'à une minute de réveil, affiché par le widget). Une base persistante est le prochain chantier.
- **Dashboard non déployé** : il tourne en local et envoie les e-mails depuis le poste du recruteur.
- **Détection** : le détecteur passif est un modèle de recherche (licence non commerciale) ; un deepfake de très haute qualité qui réussit les défis gestuels peut passer. Oval réduit le risque, il ne le supprime pas, d'où la décision humaine.
- **Vérifications publiques** : GitHub et LinkedIn sont détectés dans le CV et comparés aux déclarations, mais LinkedIn n'est jamais scrappé ; la géolocalisation de l'IP n'est pas branchée.
- **Passkey** : impossible sur une adresse IP locale (fonctionne sur le moteur déployé).
- **Extension** : chargée en mode développeur, pas encore publiée sur le Chrome Web Store ; l'analyse dépend de la fenêtre partagée par le recruteur (le plus grand visage à l'écran est analysé).
- **Langues** : interface FR / EN ; données de démo et commandes de l'assistant Manta en français.

## 7. Équipe et licence

Projet de hackathon. Modèles embarqués : MediaPipe Tasks (Apache 2.0), SFace (OpenCV Zoo, Apache 2.0), DeepfakeGuard V2 (recherche, non commercial).
