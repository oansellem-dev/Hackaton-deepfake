# Oval — point d'étape (11 octobre 2026)

> Version livrée : branche `integration/oval-moteur`, dernier commit `5e237b6` (déployé sur Render).
> Produit : vérifier qu'un humain réel, et le bon, est présent dans une visio de recrutement. Le recruteur décide, l'outil éclaire.

---

## 1. Le produit en une page

**Le problème.** Les deepfakes en direct (face-swap, filtres, caméras virtuelles) permettent à une personne de passer un entretien à la place d'une autre, ou de maquiller son identité. Les recruteurs n'ont aucun outil pour le détecter sans casser l'expérience candidat.

**La réponse Oval.** Trois briques qui se parlent :

| Brique | Pour qui | Ce qu'elle fait |
|---|---|---|
| **Dashboard Oval** (`apps/oval`) | Le recruteur / RH | Planifie les entretiens, envoie le lien de pré-vérification, suit les scores, lit les rapports. |
| **Moteur candidat** (`apps/web` + `apps/server`) | Le candidat | Parcours de pré-vérification public : identité, visage, défis, créneau. Le serveur calcule le score. |
| **Extension Chrome** (`apps/extension`) | Le recruteur, pendant la visio | Widget flottant sur Meet / Zoom / Teams : score en direct, défis à lancer, continuité du visage. |

**Principe directeur.** Le score part de 100 et ne baisse que sur des **contradictions** (un défi raté, un visage différent, un détecteur qui s'affole). Rien n'est jamais « prouvé humain » : l'écran affiche « Pas encore vérifié » tant qu'aucune preuve n'a été collectée (`Score.evidence`).

---

## 2. Ce qui a été fait dans cette version

### 2.1 Identité visuelle
- **Nouveau logo** : deux disques noirs reliés par un col fin (chemin SVG unique, réutilisé partout : favicon, dashboard, extension, parcours candidat, e-mail).
- **Logo en e-mail** : rasterisé en PNG 120 × 240 et servi publiquement par le moteur (`/oval-logo.png`), car les clients mail n'affichent pas le SVG.
- **Photos de profil** : portraits générés sur Higgsfield intégrés comme avatars candidats et recruteurs (`apps/oval/public/avatars/*.webp`).
- **Preloader** : rideau blanc animé à chaque chargement de page, sans texte (le défilement de « Bonjour / Hello » a été retiré à la demande).

### 2.2 Dashboard Oval (`apps/oval`)

Stack : React 18 + Vite + CSS pur, tokens de design partagés (`packages/design/src/tokens.css`), police Manrope. Routage par hash (`#/`, `#/entretiens`, `#/rapport/:id`, `#/defis`, `#/reglages`).

**Coque (`Shell.tsx`)**
- Rail gauche à **icônes seulement** (Accueil, Entretiens, Défis, Réglages), plus de texte.
- Barre du haut simplifiée : titre, recherche, cloche de notifications, avatars de l'équipe, bouton principal « Nouvel entretien ».
- **Cloche** : reçoit les réponses des candidats sur leur créneau (acceptée / contre-proposition) et permet d'accepter en un clic (déplace l'entretien et renvoie le créneau).

**Accueil**
- S'ouvre sur un **grand widget replié « Ouvrir le calendrier »** (design d'origine, sans bord flou), qui se déplie en calendrier complet via View Transitions.
- Bloc **Aujourd'hui** : cartes des entretiens du jour, l'entretien en cours mis en avant avec « Rejoindre », envoi / relance du lien de pré-vérification, accès au rapport.
- **Demande à Manta** : champ de commande en langage naturel avec faisceau lumineux mono.

**Calendrier (`Calendrier.tsx`)** — un vrai calendrier :
- Vue **semaine par semaine**, grille horaire (72 px / heure, pas de 15 min), gère 10 rendez-vous dans la journée.
- **Déplacer** (glisser), **redimensionner** (poignée), **créer** (clic sur un créneau libre → formulaire pré-rempli date/heure), **supprimer** (avec confirmation).
- **Fiche** ancrée à côté de la personne cliquée : date, heure, durée, lien visio, pastilles d'état, bouton Supprimer.
- Barre « maintenant » qui ne masque plus les heures des rendez-vous.
- Chaque déplacement renvoie le nouveau créneau au moteur (le candidat voit la mise à jour).

**Nouvel entretien (`NouvelEntretien.tsx`)**
- Champs candidat + **lien visio** (Google Meet / Zoom / Teams) avec raccourcis « Créer sur Meet / Zoom / Teams ».
- **Zone de dépôt du CV (PDF)** : le serveur lit le PDF et **pré-remplit** nom, e-mail, poste. Le CV est rattaché à la session dès sa création.
- Pré-remplissage date/heure quand on vient du calendrier.

**Autres écrans**
- **Entretiens** : onglets avec compteurs (à venir, en attente de pré-vérification, terminés…).
- **Rapport** : score, signaux, décision, bouton « Rejoindre », copie du code pour l'extension, version imprimable.
- **Défis** : liste dépliante des défis disponibles.
- **Réglages** : accordéon « bouncy » (recréé localement, Skiper UI étant payant).
- **Styleguide** : page de référence des composants.

**Visio.** Aucun système d'appel maison : « Rejoindre » ouvre le lien Meet / Zoom / Teams de l'entretien. Le panneau de démo interne a été retiré.

**Animations.** Effet magnétique sur les boutons (rAF + lerp, sans transition CSS pendant le suivi), glow par transform, ripple doux, shimmer sur le bouton principal. Les versions « cheap » ont été refaites.

**Données de démo.** `seed.ts` (version 7) : 31 entretiens répartis sur la semaine, photos, liens visio, statuts variés (20 à venir, 12 terminés, liens envoyés / non envoyés).

### 2.3 Parcours candidat (`apps/web`, route `/check/:token`)

Refait de zéro, « super pro » :
1. **Intro** : logo en mouvement sur fond flouté.
2. **Créneau** : le candidat voit le créneau proposé par le recruteur **et ses disponibilités**, confirme ou **contre-propose** (→ notification dans la cloche du dashboard). Masqué si aucun créneau n'est attaché.
3. **Identité** par blocs successifs : nom, contact, lieu, profil, accord. Les champs connus via le CV sont **pré-remplis** avec une note « d'après votre CV ».
4. **Consentement** (biométrie facultative, page confidentialité dédiée).
5. **Visage** : capture animée (maillage lumineux, balayage, halo), empreinte + proportions calculées **dans le navigateur** (MediaPipe + ONNX). Le serveur ne reçoit jamais d'image.
6. **Flash** et **appareil** (passkey facultative).
7. **Fin** : récapitulatif, bouton « Rejoindre sur Meet / Zoom / Teams », fichier `.ics`.

### 2.4 Moteur serveur (`apps/server`, Express)

- **Sessions** : création avec créneau + e-mail du candidat, mise à jour du créneau, décision du recruteur, journal d'audit.
- **CV** (`cv.ts`) : extraction de texte PDF (`pdf-parse`), détection e-mails / téléphones / GitHub / LinkedIn / écoles, pré-remplissage, puis **comparaison** entre ce que le candidat déclare et le CV (signaux `cv.email`, `cv.phone`, `cv.github`, `cv.linkedin`). Routes `/api/cv/extract` et `/api/sessions/:id/cv`.
- **Score fiable** : trois failles corrigées qui laissaient le score à 100 avec un filtre :
  - le détecteur passif (probabilité de trucage) compte désormais dans le score **sans** l'agent Python ;
  - le défi « main devant le visage » détecte un **visage encore dessiné sous la main** (face-swap) : ≥ 6 images couvertes et ≥ 90 % de visage détecté → contradiction forte ;
  - le score ne monte jamais sans preuve (`evidence`), d'où « Pas encore vérifié ».
- **Continuité du visage** en direct : similarité d'empreinte et écart de proportions, médianes glissantes, verdict même / différent / inconnu, journalisé sans jamais stocker d'empreinte.
- **Caméra virtuelle** : détection par nom de périphérique, signalée comme indice à confirmer par un défi.
- Agent Python (`agent/`, FastAPI) **optionnel** et non déployé.

### 2.5 Extension Chrome (`apps/extension`, manifest v3, version 0.2.2)

- **Widget flottant façon Loom**, dans la DA Oval : bulle déplaçable → carte avec le panneau recruteur en iframe (`/panel/<id>?widget=1`), score en direct, défis. Rendu en shadow DOM pour ne pas casser les pages.
- Injecté sur Meet, Zoom, Teams et à la demande sur toute page http (clic sur l'icône).
- Side panel Chrome conservé, ouverture synchrone sur le geste utilisateur (correction de l'erreur `sidePanel.open()`).
- Build dans `apps/extension/dist`, copie synchronisée sur le Bureau (`~/Desktop/Extension-Oval`). Après chaque build : « Recharger » dans `chrome://extensions`.

### 2.6 Envoi des liens et déploiement

- **E-mail direct** : le lien de pré-vérification part par SMTP Gmail depuis le dashboard (plugin Vite `apps/oval/server/email.ts`, nodemailer). Nouveau logo dans l'en-tête.
- **Liens publics** : le moteur est déployé sur **Render** (`https://oval-moteur.onrender.com`, service `oval-moteur`, déploiement automatique à chaque push sur `integration/oval-moteur`). Le dashboard local pointe dessus via `.env` (`VITE_MOTEUR_URL`, `MOTEUR_API_URL`). Les tunnels (cloudflared / ngrok / localtunnel, `npm run tunnel`) restent disponibles mais ne sont plus nécessaires.

---

### 2.7 Dernière passe (soir du 11 octobre)

- **Deux langues** : dashboard et parcours candidat en français et en anglais. Le français est la langue source et la clé de chaque texte ; les traductions vivent dans `apps/oval/src/i18n/` et `apps/web/src/i18n/`. Dashboard : choix dans Réglages → Langue (la page se recharge). Candidat : langue du navigateur, bascule FR / EN sur l'intro et dans l'en-tête. Dates et heures suivent la langue. Les données de démo (postes, noms) restent en français ; les commandes de Manta se reconnaissent en français.
- **Extension renforcée** (version 0.3.0) : cible par défaut le moteur déployé (plus besoin de serveur local), vérifie le code « identifiant:clé » auprès du moteur avant d'ouvrir le panneau (message clair si le code est faux), attend le réveil du moteur gratuit en l'affichant, distingue le chargement initial des modèles d'une analyse interrompue (battement de cœur du panneau toutes les 3 s, bulle « hors ligne » sinon, bouton Réessayer), accepte uniquement les messages venant du site du moteur, survit au rechargement de l'extension, se réinsère si la page remplace son corps, se replie avec Échap, textes FR / EN selon le navigateur.
- **Sécurité du moteur** : limiteur de débit par adresse (600 requêtes / min en général, 20 créations d'entretien / min, 10 lectures de PDF / min, 120 appels candidat / min), corps JSON plafonné à 256 ko. Déjà en place : jeton recruteur comparé à temps constant, en-têtes `Referrer-Policy: no-referrer` et `nosniff`, HTTPS forcé derrière Render, e-mails échappés.
- **Calendrier** : plus de voile bleu derrière la colonne du jour (seules ses cases sont teintées) ; les journées passées n'invitent plus à créer un créneau.
- **Page candidat** : la note de pré-remplissage distingue « d'après votre CV » de « par le recruteur ».
- Vérifié : typecheck des quatre applications, 21 tests unitaires, build complet, écrans du dashboard et parcours candidat passés en anglais sans débordement, widget testé contre le moteur déployé.

## 3. Flux complet, de bout en bout

```
RH crée l'entretien (dashboard)        → dépose le CV, choisit le créneau, colle le lien Meet
        │
        ▼
Serveur crée la session                → extrait le CV, attache créneau + e-mail
        │
        ▼
E-mail au candidat                     → lien public https://oval-moteur.onrender.com/check/<jeton>
        │
        ▼
Candidat : intro → créneau → identité (pré-remplie) → consentement → visage → flash → appareil → fin (.ics)
        │                                     │
        │                                     └─ contre-proposition → cloche du dashboard → RH accepte
        ▼
Serveur compare déclaré vs CV, enregistre empreinte/proportions, score
        │
        ▼
Jour J : RH clique « Rejoindre » (Meet/Zoom/Teams) → extension Oval affiche le widget
        │
        ▼
Pendant la visio : continuité du visage, détecteur passif, défis (main, rotation, phrase)
        │
        ▼
Rapport dans le dashboard → décision du recruteur
```

---

## 4. Architecture du dépôt

```
Hackaton-deepfake/
├── apps/
│   ├── oval/        Dashboard RH (React + Vite + CSS). .env : VITE_MOTEUR_URL, MOTEUR_API_URL, SMTP_*, MAIL_FROM
│   ├── web/         Site du moteur : parcours candidat /check, panneau /panel, rapport /report, visio de secours
│   ├── server/      API Express (sessions, CV, défis, live, présence, passkeys), sert apps/web/dist en prod
│   └── extension/   Extension Chrome MV3 (widget.ts, background.ts, sidepanel.tsx)
├── packages/
│   ├── shared/      Types, bibliothèque de défis, calcul du score, contrôles d'environnement
│   ├── panel/       Panneau recruteur partagé (extension + visio de secours), client API
│   └── design/      Tokens CSS Oval
├── agent/           Détecteur Python FastAPI (optionnel, non déployé)
├── scripts/tunnel.mjs
├── docs/            conformite-rgpd.md, contrat-front-back.md, ce point d'étape
├── render.yaml      Déploiement Render du moteur
└── README.md        Lancement et tests à deux machines
```

**Routes du site moteur** : `/`, `/check/:token`, `/confidentialite`, `/presence/:token`, `/visio/:id`, `/panel/:id`, `/report/:id`, `/lab/flash`.

**API principale** : `/api/health`, `/api/sessions`, `/api/sessions/:id`, `/api/sessions/:id/{schedule,cv,challenges,decision,live-sample,live-camera,presence}`, `/api/cv/extract`, `/api/check/:token/*` (lien candidat), `/api/presence/:token`.

**Défis disponibles** : main devant le visage, rotation de la tête, phrase aléatoire.

---

## 5. Lancer et vérifier

```bash
npm install
npm run dev          # serveur :8787, moteur :5173, dashboard :5174, extension en watch
```

- Dashboard : `http://localhost:5174`
- Extension : `chrome://extensions` → mode développeur → charger `apps/extension/dist` (ou le dossier du Bureau). Elle parle au moteur déployé par défaut ; `VITE_API_URL` / `VITE_WEB_URL` dans `apps/extension/.env` pour un moteur local.
- Moteur public : `https://oval-moteur.onrender.com`
- Qualité : `npm run typecheck`, `npm test`, `npm run build`.

Déployer : `git push` sur `integration/oval-moteur` (Render reconstruit tout seul, environ 2 minutes).

---

## 6. Limites connues et suite proposée

| Sujet | État | Proposition |
|---|---|---|
| Stockage des sessions sur Render | Disque éphémère du palier gratuit : les sessions disparaissent au redéploiement ou à la mise en veille. | Base de données persistante (Postgres Render ou SQLite sur disque payant). |
| Dashboard public | Tourne en local seulement ; l'e-mail part du poste du recruteur. | Déployer le dashboard et déplacer l'envoi d'e-mail côté serveur. |
| Vérification des sources publiques | La comparaison porte sur le CV ; GitHub / LinkedIn sont détectés mais pas scrappés. | Agent de vérification externe (profil public, cohérence des dates). |
| Agent Python | Optionnel, non déployé. Le score fonctionne sans lui. | Déployer pour un second détecteur. |
| Passkey sur IP locale | Ne fonctionne qu'en HTTPS avec nom de domaine (ok sur Render). | Rien à faire en prod. |
| Confirmation d'appareil dans le widget | Pas encore proposée pendant la visio. | Étape passkey côté extension. |
| Images distantes dans les e-mails | Le logo PNG dépend de l'affichage des images par le client mail. | Acceptable ; le texte « Oval » reste visible. |

---

## 7. Historique des commits de cette version

| Commit | Contenu |
|---|---|
| `0c2dca4` | Dashboard, extension et parcours candidat : calendrier, widget flottant, score fiable, créneau |
| `f1a412b` | CV du candidat : dépôt à la création, lecture côté serveur, pré-remplissage et comparaison |
| `5e237b6` | Logo affiné dans l'e-mail de pré-vérification (PNG servi par le site du moteur) |

Documents liés : [conformite-rgpd.md](conformite-rgpd.md), [contrat-front-back.md](contrat-front-back.md), [README.md](../README.md).
