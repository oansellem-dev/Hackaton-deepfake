# Oval — interface

> Un vrai visage derrière chaque écran. Le recruteur décide, l'outil éclaire.

Interface du projet Oval (hackathon Secure Horizons) : dashboard recruteur, panneau d'extension Chrome, page candidat de pré-vérification, mascotte Manta.

## Lancer

```bash
npm install
npm run dev
```

| Écran | Adresse |
|---|---|
| Système de design | http://localhost:5173/#/styleguide |
| Accueil (planning) | http://localhost:5173/#/ |
| Entretiens | http://localhost:5173/#/entretiens |
| Rapport d'un entretien | http://localhost:5173/#/rapport/e-noah |
| Page candidat | http://localhost:5173/#/candidat/e-camille |
| Panneau recruteur (360 px) | http://localhost:5173/sidepanel.html |

Extension Chrome : `npm run build`, puis `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » → dossier `dist/`.

Mode démo du panneau : touches `1` à `4` (états), `A`/`B` (candidat sans ou avec signal), `D` (barre démo), ou triple-clic sur Manta.

## Arborescence

```
design/                 maquettes de structure (oval-*.png)
src/
  app/                  routeur par hash, coquille (rail + barre du haut)
  styles/               tokens.css (jetons), base.css (matière), motion.css (mouvement)
  ui/                   composants : boutons, pilules, barres, onglets, champs, avatars, modale, messages
  manta/                Manta.tsx + manta.css (SVG, six états)
  store/                types.ts (CONTRAT), seed.ts (données d'exemple), store.ts (magasin persistant),
                        integration.ts (BRANCHEMENT ÉQUIPE), manta-commands.ts (« Demande à Manta »), texts.ts, format.ts
  screens/              Styleguide, Accueil, Entretiens, Rapport, Defis, Reglages
  panel/                extension Chrome (Manifest V3, sidePanel)
  candidat/             page de pré-vérification (accord, caméra, lumière, geste, fin)
public/manifest.json    extension
```

## Contrat avec l'équipe

Un seul fichier de types : [`src/store/types.ts`](src/store/types.ts). Il décrit `Entretien`, `PreVerification`, `Defi`, `Signal`, `Score`, `Decision`, et les événements temps réel `EvenementPanneau`.

Un seul fichier à brancher : [`src/store/integration.ts`](src/store/integration.ts).

| Brique | Quoi remplacer | Signature |
|---|---|---|
| A · signaux techniques | `relever()` (ajouter l'IP côté serveur) | `() => Promise<SignauxTechniques>` |
| B · analyse vidéo, page candidat | `simulerLumiere(seq)`, `simulerGeste(stream)` | `=> Promise<Resultat>` |
| B · analyse vidéo, pendant la visio | appeler `emettre({ type, ... })` ou `window.postMessage({ oval: {...} })` | `EvenementPanneau` |
| D · score | `calculerScore(entretien)` | `(Entretien) => Score` |

Les données d'exemple (`seed.ts`) sont sauvegardées dans le navigateur. « Réinitialiser la démo » dans Réglages les recharge.

## Règles de contenu

Jamais « faux candidat », jamais « identité vérifiée ». On écrit « signal à vérifier » et « présence humaine vérifiée ». La couleur ne porte jamais le sens seule. Une information absente n'est jamais négative. Le recruteur décide.
