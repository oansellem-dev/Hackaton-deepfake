# KYC Visio

Vérifier qu'un humain réel est présent dans une visio de recrutement. Le recruteur décide, l'outil éclaire.

## Lancer

```bash
npm install
npm run dev        # serveur :8787 + site :5173 + extension (build en watch)
```

Extension Chrome : `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » → `apps/extension/dist`.
Après une modification, cliquer sur « Recharger » dans `chrome://extensions`.

## Tester à deux (deux machines)

### Candidat sur une autre machine du même réseau

La caméra n'est autorisée qu'en HTTPS (ou sur `localhost`). Sur le même Wi-Fi, sans tunnel :

1. `apps/web/.env` : `HTTPS=1` (certificat auto-signé, le candidat accepte l'avertissement une fois).
2. `apps/oval/.env` : `VITE_MOTEUR_URL=https://<IP de l'hôte>:5173` (IP : `ipconfig getifaddr en0` sur Mac). Le lien envoyé par Oval devient `https://<IP>:5173/check/<jeton>`.
3. Relancer `npm run dev`. L'hôte accepte lui aussi l'avertissement sur `https://localhost:5173` et `https://<IP>:5173`.

La clé d'accès (passkey) ne fonctionne pas sur une adresse IP : le candidat clique « Passer » à cette étape facultative. Pour un réseau qui bloque les appareils entre eux, voir le tunnel ci-dessous.


La caméra n'est autorisée qu'en HTTPS (ou sur `localhost`). Le serveur sert donc le site lui-même et un seul tunnel HTTPS suffit.

**Hôte (le recruteur)** — deux terminaux, dans le dossier du projet :

```bash
# Terminal 1 : construit le site et lance le serveur sur :8787 (arrêter avant tout `npm run dev`)
npm run share

# Terminal 2 : tunnel HTTPS vers le port 8787
npx localtunnel --port 8787
```

Le tunnel affiche une adresse `https://xxxx.loca.lt`. C'est la seule adresse à connaître.

1. Ouvrir cette adresse. La première visite demande un « Tunnel Password » : c'est l'IP publique de l'hôte (`curl https://ipv4.icanhazip.com`).
2. Cliquer sur **Créer un entretien** et noter l'identifiant `<id>`.
3. Ouvrir `https://xxxx.loca.lt/visio/<id>?role=recruiter`.

**Candidat (l'ami)** — rien à installer :

1. Ouvrir `https://xxxx.loca.lt/check/<id>` pour la pré-vérification (même mot de passe de tunnel à la première visite).
2. Puis `https://xxxx.loca.lt/visio/<id>?role=candidate`.

Pas de mot de passe de tunnel avec `cloudflared tunnel --url http://localhost:8787` si l'hôte préfère l'installer.

Si les deux vidéos ne se connectent pas (Wi-Fi d'école ou d'entreprise qui bloque le pair à pair), passer l'un des deux en partage de connexion du téléphone : il manque un serveur TURN.

## Structure

| Dossier | Brique | Rôle |
|---|---|---|
| `packages/shared` | contrat | Types, bibliothèque de défis, calcul du score, contrôles d'environnement |
| `packages/panel` | C | Panneau recruteur + mascotte, partagé par l'extension et la visio de secours |
| `packages/panel/src/detector.ts` | **B** | **Point de branchement MediaPipe** (`ChallengeDetector`). Aujourd'hui un bouchon qui renvoie `inconclusive` |
| `apps/server` | A, D | API des entretiens, signaux de pré-vérification, score, signalisation WebRTC |
| `apps/web` | A, E, plan B | `/` recruteur, `/check/:id` candidat, `/visio/:id?role=…` visio de secours, `/report/:id` rapport |
| `apps/extension` | C | Panneau latéral Chrome qui capture l'onglet de visio |
| `apps/oval` | design | Interface Oval de Jules : dashboard, page candidat, panneau avec Manta. Sur données d'exemple, à brancher (voir ci-dessous) |

## Interface Oval (design de Jules) : `apps/oval/`

L'interface de Jules est dans le même dépôt, à côté du moteur, avec tout son historique. Les deux tournent séparément : rien ne casse.

```bash
npm run dev:oval      # interface Oval (port 5173, ou le suivant si le site moteur tourne déjà)
npm run dev           # moteur : serveur :8787, site fonctionnel :5173, extension
```

Pour l'instant, elle tourne sur ses données d'exemple (`apps/oval/src/store/seed.ts`). Chaque brique du moteur se branche dans **un seul fichier**, `apps/oval/src/store/integration.ts`, en remplaçant une fonction simulée :

| Fonction simulée | Brique du moteur à brancher | Où elle est |
|---|---|---|
| `simulerLumiere(seq)` | Test de lumière (Gaspard) | `apps/web/src/lib/flash.ts`, `packages/shared/src/flash.ts` |
| `simulerGeste(stream)` | Défi de la main, pré-vérification (Oren) | `apps/web/src/components/FaceId.tsx` |
| `simulerDefi(defi)` et `emettre(...)` | Défis en direct pendant la visio (Oren) | `apps/web/src/lib/liveDetector.ts` |
| `calculerScore(entretien)` | Score et explication (serveur, agent) | `GET /api/sessions/:id` (jeton recruteur) |
| `relever()` | Signaux techniques, adresse IP côté serveur | `POST /api/sessions/:id/precheck` |

Le magasin d'Oval vit dans le navigateur. Pour qu'un candidat sur un autre appareil remonte au dashboard, il faut passer par le serveur du moteur (`apps/server`).

**Mettre à jour depuis la branche de Jules** (s'il continue sur `Jules-architecture`) :

```bash
git fetch && git merge -X subtree=apps/oval origin/Jules-architecture
```

Le plus simple reste que chacun travaille désormais à partir de `main`, Jules dans `apps/oval/`.

## Lancer la démo (interface Oval + moteur)

```bash
npm install
npm run dev        # serveur :8787, site du moteur :5173, interface Oval :5174, extension
```

| Quoi | Adresse |
|---|---|
| Interface Oval (recruteur) | http://localhost:5174 |
| Page candidat du moteur (envoyée par e-mail) | http://localhost:5173/check/<jeton> |
| Visio du moteur (plan B) | http://localhost:5173/visio/<id>?key=<clé recruteur> |
| Panneau pour Teams, Meet, Zoom | http://localhost:5173/panel/<id>?key=<clé recruteur> |
| Rapport du moteur | http://localhost:5173/report/<id>?key=<clé recruteur> |
| Contrat front–back | `docs/contrat-front-back.md` |

Scénario en cinq étapes :

1. **Créer l'entretien dans Oval** (`Nouvel entretien`, « Envoyer le lien de pré-vérification »). En mode « moteur » (Réglages → Données ; choisi tout seul si le serveur répond), la session est créée sur le serveur et l'e-mail contient le lien `/check/<jeton>` du moteur. Sans SMTP, la fenêtre « E-mail prêt à partir » donne le lien à copier.
2. **Pré-vérification du candidat** : ouvrir le lien dans un autre onglet (ou une autre machine) : informations, consentement, Face ID, reflet de l'écran, clé d'accès facultative.
3. **Résultats dans Oval** : en moins de 5 s, l'entretien passe à « Pré-vérif. faite », avec les étapes, les signaux et l'indice (synchronisation toutes les 4 s).
4. **Visio et défis** : « Rejoindre avec Oval » ouvre la visio du moteur ; le panneau propose les défis, Manta commente, les résultats remontent dans Oval.
5. **Décision et rapport** : la décision prise dans Oval part au serveur (qui efface les biométries) et apparaît dans le rapport du moteur ; « Exporter » donne la version imprimable d'Oval.

Mode démo : sans serveur, Oval tourne seul avec ses données d'exemple (badge « Démo » dans la barre du haut, bouton « Réinitialiser la démo » dans Réglages).

## Parcours de démo (moteur seul)

1. Sur `http://localhost:5173`, créer un entretien.
2. Envoyer `/check/<id>` au candidat : caméra virtuelle, fuseau horaire, IP.
3. Entretien :
   - **Extension** : ouvrir Meet ou Zoom web, cliquer sur l'icône, coller l'identifiant, puis « Capturer l'onglet de visio ».
   - **Plan B** : le candidat ouvre `/visio/<id>?role=candidate` et le recruteur `/visio/<id>?role=recruiter`.
4. La mascotte propose un défi. Le recruteur le demande, puis clique sur « J'ai proposé… ».
5. Ouvrir `/report/<id>`.

## Règles respectées dans le code

- Seul le statut `contradiction` baisse le score. `unknown` n'a aucun effet (`packages/shared/src/score.ts`).
- Aucune image n'est envoyée au serveur : le flux est lu dans le navigateur.
- La décision est prise par le recruteur et tracée (`POST /decision`).

## Limites connues

- **Brique B** : brancher MediaPipe dans `detector.ts`. La capture d'onglet contient toute l'interface de la visio (vignettes, barres) : il faudra recadrer sur la vignette du candidat ou laisser le détecteur choisir le plus grand visage.
- `getUserMedia` exige HTTPS en dehors de `localhost`. Pour une visio de secours entre deux machines, passer par un tunnel HTTPS (ngrok, cloudflared) ou `@vitejs/plugin-basic-ssl`. Mettre aussi `VITE_API_URL` et `host_permissions` à jour.
- Géolocalisation de l'IP : pas encore branchée (signal `unknown`).
- Le stockage est en mémoire : un redémarrage du serveur efface les entretiens.

## Agent de score et détecteur passif (dossier `agent/`)

Service FastAPI (Python) branché sur le serveur Node : il calcule le score à partir de tous les signaux, rédige
l'explication, recommande le prochain défi et analyse localement des captures du visage (détecteur de face-swap,
DeepfakeGuard V2 en ONNX, rien n'est envoyé à un tiers ni conservé).

```bash
cd agent
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # Linux/macOS : .venv/bin/pip
export ANTHROPIC_API_KEY=sk-ant-...                # optionnel : explication reformulée par Claude Haiku
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

- Le serveur Node appelle `AGENT_URL` (défaut `http://localhost:8000`). Si l'agent est arrêté, il retombe sur `computeScore` : rien ne casse.
- Le panneau envoie une capture réduite du flux toutes les 2 s (`POST /api/sessions/:id/frame`), que le serveur transmet à l'agent. Après 5 captures, le détecteur peut ajouter un signal moyen (au plus 15 points).
- La première recommandation de l'agent remplace le tirage aléatoire du premier défi, puis chaque défi suivant.
- Doc interactive de l'agent : `http://localhost:8000/docs`. Tests : `cd agent && .venv/Scripts/python -m pytest`.
- Licence du modèle passif : recherche / non commercial. À remplacer avant un produit commercial.

## Conformité RGPD

Audit, corrections et questions juridiques ouvertes : [docs/conformite-rgpd.md](docs/conformite-rgpd.md). En bref : empreinte et détecteur de trucage calculés dans le navigateur (aucune image envoyée), gabarit chiffré et stocké à part sans identité, consentement biométrique explicite avec alternative sans biométrie et retrait, suppression à la décision, manuelle ou à expiration, lien candidat à usage unique, journal d'audit, clé d'accès (passkey) pour confirmer l'appareil en visio.

| Variable | Défaut | Rôle |
|---|---|---|
| `BIOMETRIC_KEY` | fichier `data/biometric.key` | clé AES-256 des gabarits (64 caractères hexadécimaux) |
| `BIOMETRIC_TTL_HOURS` | 24 | durée maximale d'un gabarit |
| `BIOMETRIC_SWEEP_SECONDS` | 600 | fréquence de la suppression automatique |
| `CANDIDATE_LINK_TTL_HOURS` | 24 | validité du lien de pré-vérification |
| `FACE_SAME_PERSON_MIN` / `FACE_DIFFERENT_PERSON_MAX` | 0,40 / 0,25 | seuils de similarité d'empreinte |
| `FORCE_HTTPS` | — | `1` derrière un proxy TLS : redirection HTTPS et HSTS |

## Lien de pré-vérification (2 pages)

Le recruteur crée un entretien sur `/` (en indiquant son entreprise, responsable du traitement) et envoie `/check/<jeton>` au candidat : jeton de 32 caractères, valable 24 h, une seule utilisation. Il suit le résultat sur `/report/<id>`, qui se met à jour tout seul : verdict de pré-vérification, informations déclarées, ce qui a été relevé, défis réussis ou non.

**Page 1 — Vos informations.** Prénom et nom (obligatoires), e-mail, téléphone, pays, ville, poste, entreprise, GitHub, LinkedIn (facultatifs), et **consentement explicite** (refusé côté serveur sans la case cochée). Vérifications, uniquement par des API publiques officielles :

- présence publique du nom : Wikipédia FR/EN, GitHub, ORCID sans clé, et le web via Brave Search si `BRAVE_API_KEY` est défini ;
- e-mail jetable (yopmail, mailinator…), indicatif téléphonique différent du pays déclaré, profil GitHub déclaré introuvable ou au nom différent (`GITHUB_TOKEN` facultatif pour lever la limite de 60 requêtes par heure) ;
- LinkedIn : affiché au recruteur, jamais vérifié automatiquement (pas de scraping).

Ne rien trouver ou laisser un champ vide ne pénalise jamais : seul un écart entre deux informations devient un signal à vérifier.

**Page 2 — Vérification du visage.** Caméra de l'appareil uniquement : une caméra virtuelle (OBS, ManyCam…) est remplacée par la vraie caméra si l'appareil en a une, sinon refusée et tracée. Une caméra virtuelle seulement installée (OBS pour le streaming) n'est qu'une information, sans effet sur le score ; pendant la visio, la page du candidat signale une caméra virtuelle réellement utilisée. La vérification d'environnement (caméras, fuseau horaire, IP) se fait au même moment. Puis, dans un ovale de cadrage (distance, lumière, visage de face) : tête tournée d'un côté puis de l'autre (retour de face obligatoire entre les deux, « Dans l'autre sens » si besoin), main devant le visage. Le serveur tire l'ordre au hasard et ajoute des étapes si un signal à vérifier existe déjà. Analyse MediaPipe dans le navigateur ; une dizaine d'images, surtout pendant les défis, partent vers l'agent local (détecteur passif et empreinte), analysées en mémoire puis jetées.

**Ce qui est conservé** (jamais d'image), chiffré en AES-256-GCM dans `apps/server/data/sessions.json`, effacé dès la décision du recruteur et au plus tard après 24 h :

- l'**empreinte faciale** : 128 nombres calculés par l'agent avec SFace (OpenCV Zoo, Apache 2.0), moyenne de plusieurs captures ;
- les **proportions du visage** (écart des yeux, largeur du nez, de la bouche…), de face et sous deux angles.

Clé de chiffrement : `BIOMETRIC_KEY` (64 caractères hexadécimaux), sinon `data/biometric.key` créé au premier lancement.

**Pendant l'entretien** (visio de secours), le panneau envoie une capture et une mesure du visage toutes les 2 s. Le serveur compare à la pré-vérification : similarité d'empreinte (même personne ≥ 0,40, différente ≤ 0,25 ; le seuil publié de SFace est 0,363) et écart des proportions (≥ 12 % = différent). Un seul contrôle qui voit un visage différent lève le signal fort « Visage différent de celui de la pré-vérification » ; entre les seuils, on ne conclut pas.

Mesuré en test (Chrome, caméra simulée) : même personne 0,97 de similarité et 1,2 % d'écart ; autre personne 0,05 et 10 %.

```bash
npm install                      # télécharge aussi les modèles MediaPipe dans apps/web/public (predev / prebuild)
cd agent && .venv/Scripts/python -m uvicorn app.main:app --port 8000      # autre terminal
BRAVE_API_KEY=... BIOMETRIC_KEY=$(openssl rand -hex 32) npm run dev
```

Au premier appel, l'agent télécharge ses modèles (DeepfakeGuard, YuNet, SFace : environ 70 Mo) depuis Hugging Face.

## Étape 3 : test du reflet de l’écran

Après la vérification du visage, l’écran du candidat passe en plein écran et affiche 12 couleurs tirées au hasard (400 à 600 ms chacune, environ 8 s en tout). Un vrai visage renvoie ces couleurs vers la caméra avec un léger retard. Une image injectée (caméra virtuelle, vidéo rejouée, visage de synthèse) ne voit pas l’écran du candidat et ne suit pas la suite.

- **Analyse dans le navigateur** (`packages/shared/src/flash.ts`). Pour chaque couleur, on mesure la teinte moyenne du centre du visage, on retire la dérive lente de la caméra (balance des blancs), puis on calcule l’accord avec la suite affichée, sur 26 retards possibles (0 à 500 ms). On le compare à 1 000 suites tirées au hasard que l’écran n’a jamais affichées.
- **Verdict d’un essai.**
  - Réussi : accord ≥ 0,5 et moins de 1 % des suites au hasard font aussi bien.
  - Échec : accord < 0,4 et pas meilleur que le hasard (p ≥ 0,05).
  - Sinon, non concluant.
  - Trop peu d’images ou visage absent donnent toujours non concluant (règle n° 1).
- **Côté candidat.**
  - Deux essais au plus, avec des conseils entre les deux (luminosité, distance, contre-jour).
  - Le test devient un signal à vérifier (gravité moyenne, 15 points) seulement si tous les essais sont des échecs.
  - Un test interrompu ou passé n’a aucun effet.
  - « Passer ce test » est proposé avant le premier essai, pour les personnes sensibles aux lumières clignotantes. Les couleurs changent au plus 2,5 fois par seconde, sous le seuil WCAG de 3 flashs par seconde.
- **Ce qui part au serveur** (`POST /api/check/:token/flash`, jeton du lien, dans la fenêtre qui suit la vérification du visage) : le résumé de chaque essai (verdict, accord, p, retard, ampleur, images par seconde). Les mesures image par image restent dans le navigateur : la couleur de la peau image par image peut trahir le pouls, qui est une donnée de santé.
- **Agent Python** : le champ `screen_flash_responsive` (`false` = aucune réaction sur un test terminé) retire 15 points.
- **Limite connue.** Un échange de visage qui recopie l’éclairage de la vraie caméra de l’attaquant peut suivre les couleurs. Ce test vise les flux injectés. Une photo imprimée renvoie la lumière : elle passe ce test, mais pas les défis de mouvement. Les signaux sont complémentaires.

### Espace de test : `/lab/flash`

Il sert à faire les 20 essais du plan sans serveur ni entretien. Le journal reste dans le navigateur et s’exporte en CSV ou JSON. La page calcule le **taux de détection** (attaques classées « échec ») et le **taux de faux positifs** (vrais visages classés « échec »).

- **Vrais visages (10 essais)** : sources « Caméra », dans plusieurs pièces, à plusieurs distances et plusieurs luminosités d’écran.
- **Attaques (10 essais)** :
  - « Vidéo rejouée, enregistrée ici » : bouton d’enregistrement de 6 s, la vidéo reste en mémoire dans l’onglet ;
  - caméra virtuelle OBS qui diffuse une vidéo ;
  - téléphone tenu devant la caméra ;
  - filtre de visage.
- **Filtre d’échange de visage** (source « Filtre : échange de visage en temps réel ») : un deepfake simple, en temps réel, dans le navigateur (`apps/web/src/lib/faceswap.ts`).
  - Fonctionnement : ton visage, yeux et bouche compris, est remplacé par celui d’une photo. Prends un visage généré par IA, ou une personne qui a donné son accord écrit.
  - Le test ne sait pas que le filtre est actif : il reçoit ce flux exactement comme une caméra.
  - Deux niveaux d’attaque :
    - **simple** : le visage collé ne renvoie pas le reflet de l’écran ;
    - **éclairage recopié** : à chaque image, la couleur du vrai visage est recopiée sur le faux, comme le transfert de couleur de DeepFaceLive.
  - Le journal compte le taux de détection pour chaque type d’attaque.
- **Les deux simulations** (photo qui renvoie l’écran, photo figée) vérifient seulement la chaîne technique. Elles ne comptent pas dans les chiffres.
- **Graphiques** : les bandes des couleurs affichées et les courbes de la teinte mesurée, puis l’accord selon le retard face à la ligne du hasard.

Calibré sur des caméras simulées (`packages/shared/test/flash.test.ts`) :

| Cas | Réussi | Échec |
|---|---|---|
| Visage avec un reflet de 1,5 % ou plus | 100 % | 0 % |
| Visage avec un reflet très faible (0,7 %) | 76 % | 2 % |
| Image injectée | 1 à 2 % | 82 à 93 % |

Dans Chrome, avec une caméra simulée qui renvoie l’écran (`tools/e2e/flash.mjs`) :

| Cas | Verdict |
|---|---|
| Vrai visage | Réussi |
| Échange de visage simple | Échec (détecté) |
| Échange avec éclairage recopié | Réussi (non détecté) |

Ce dernier cas est la limite du test. Il faut s’appuyer sur les autres signaux : défis de mouvement, détecteur passif.

Ces chiffres sont à confirmer avec les 20 vrais essais. Les seuils sont dans `FLASH_THRESHOLDS`.

## Accès recruteur (jeton)

À la création d'un entretien, le serveur remet un **jeton recruteur**, une seule fois. Il est intégré aux liens recruteur affichés sur `/` (visio `?role=recruiter&key=…`, rapport `?key=…`) et au code à coller dans l'extension (`identifiant:jeton`). Sans lui, impossible de lire les signaux, de décider, d'enregistrer un défi ou d'envoyer des captures en dehors de la vérification du visage. Le lien du candidat (`/check/<id>`, `/visio/<id>?role=candidate`) ne contient que l'identifiant. Le navigateur du recruteur garde le jeton pour les visites suivantes.

## CV du candidat (dans le rapport, chargé par le recruteur)

Le candidat n'envoie pas son CV : son parcours reste léger. Le recruteur charge le PDF reçu dans le rapport. L'agent le lit en mémoire (module d'Hector, `agent/app/cv/`, avec pdfplumber), le compare à ce que le candidat a déclaré en page 1, puis l'oublie :

- **écarts signalés** (à vérifier, jamais une preuve) : nom absent du CV, e-mail, téléphone, GitHub ou LinkedIn différents, entreprise déclarée absente du CV ; on ne compare que ce qui existe des deux côtés ;
- **concordances** affichées (« Identique dans le CV et la pré-vérification : nom, téléphone… ») ;
- **vérifier en un clic** : recherches préparées par le module d'Hector (école, entreprise, poste, plateformes pro), que le recruteur ouvre lui-même. Rien n'est aspiré automatiquement.

Un CV scanné (sans texte) est refusé avec un message clair. Les écarts comptent dans le score comme les autres incohérences déclarées (signal moyen, plafonné).

## Défis en direct (brique B)

Dans la visio de secours, le bouton « J'ai proposé : … » du panneau lance la même détection MediaPipe que la pré-vérification, sur le flux du candidat (`apps/web/src/lib/liveDetector.ts`) :

- **main devant le visage** : au moins 8 points de la main dans le visage pendant 4 images ; une capture part vers l'agent quand la main repart (c'est là qu'un face-swap se trahit) ;
- **rotation de la tête** : 14° par rapport à l'angle de départ (la caméra n'est pas toujours bien en face) ;
- **phrase aléatoire** : au moins deux ouvertures-fermetures de la bouche, mesurées de face et sans main près du visage. Jamais « non exécuté » : une parole peut ne pas se voir.

Délai 12 s (15 s pour la phrase). Au-delà, « non exécuté » seulement si le visage était bien suivi, sinon « non concluant », sans effet sur le score. Des mesures brutes (visage suivi, images main sur le visage, rotation max, mouvement des lèvres) sont enregistrées avec chaque défi et affichées au rapport, pour régler les seuils sur nos 20 tests. L'extension Chrome utilise encore le détecteur bouchon : il faudra y embarquer MediaPipe (WASM et modèles).

## Tests de bout en bout (`tools/e2e/`)

- `npm test` : tests unitaires (mesures du visage, test du reflet).
- `node tools/e2e/flash.mjs <photo de visage.jpg>` : 19 contrôles dans Chrome sans interface (site construit, serveur lancé, `BASE` et `CHROME_PATH` si besoin) :
  - espace de test (photo qui renvoie l’écran → réussi, photo figée → échec, échange de visage simple → échec, échange avec éclairage recopié → rapporté) ;
  - pré-vérification avec une fausse caméra fixe (deux essais → signal à vérifier, rapport) ;
  - « Passer ce test » ;
  - règles du serveur (ordre, nombre d’essais, validation).
- `node tools/e2e/server.mjs <dossier de données>` : 30 contrôles sur l'API (consentement, caméra virtuelle, sources publiques, chiffrement, comparaison, effacement). Lancer le serveur avec `KYC_DATA_DIR=<dossier de données>`.
- `python tools/e2e/make_video.py <visage.jpg> <sortie.y4m> --hand main.jpg --mode precheck|live|static` : fabrique une fausse caméra (de face, tête tournée, main devant le visage ; `static` = image figée).
- `node tools/e2e/browser.mjs <candidat.y4m> <autre.y4m> <captures> all` : parcours complet dans Chrome sans interface (`npm i playwright-core` dans un dossier à part, `CHROME_PATH` si Chrome n'est pas au chemin Windows par défaut) : pré-vérification, visio avec la même personne, puis substitution par une autre personne.
- `node tools/e2e/browser.mjs <live.y4m> <autre.y4m> <captures> live <fige.y4m>` : défis en direct, avec un candidat qui fait les gestes (vert) puis une image figée (rouge).

À régler sur nos 20 tests : seuils de continuité (`packages/shared/src/face.ts`) et de rotation (`TURN_YAW_DEG` dans `FaceId.tsx`). Le panneau de l'extension Chrome ne mesure pas encore les proportions du visage, mais ses captures alimentent déjà l'empreinte.
