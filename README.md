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

## Parcours de démo

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

## Lien de pré-vérification (2 pages)

Le recruteur crée un entretien sur `/` et envoie `/check/<id>` au candidat. Il suit le résultat sur `/report/<id>`, qui se met à jour tout seul : verdict de pré-vérification, informations déclarées, ce qui a été relevé, défis réussis ou non.

**Page 1 — Vos informations.** Prénom et nom (obligatoires), e-mail, téléphone, pays, ville, poste, entreprise, GitHub, LinkedIn (facultatifs), et **consentement explicite** (refusé côté serveur sans la case cochée). Vérifications, uniquement par des API publiques officielles :

- présence publique du nom : Wikipédia FR/EN, GitHub, ORCID sans clé, et le web via Brave Search si `BRAVE_API_KEY` est défini ;
- e-mail jetable (yopmail, mailinator…), indicatif téléphonique différent du pays déclaré, profil GitHub déclaré introuvable ou au nom différent (`GITHUB_TOKEN` facultatif pour lever la limite de 60 requêtes par heure) ;
- LinkedIn : affiché au recruteur, jamais vérifié automatiquement (pas de scraping).

Ne rien trouver ou laisser un champ vide ne pénalise jamais : seul un écart entre deux informations devient un signal à vérifier.

**Page 2 — Vérification du visage.** Caméra de l'appareil uniquement : une caméra virtuelle (OBS, ManyCam…) est remplacée par la vraie caméra si l'appareil en a une, sinon refusée et tracée. La vérification d'environnement (caméras, fuseau horaire, IP) se fait au même moment. Puis, dans un ovale de cadrage (distance, lumière, visage de face) : tête tournée d'un côté puis de l'autre (retour de face obligatoire entre les deux, « Dans l'autre sens » si besoin), main devant le visage. Le serveur tire l'ordre au hasard et ajoute des étapes si un signal à vérifier existe déjà. Analyse MediaPipe dans le navigateur ; une dizaine d'images, surtout pendant les défis, partent vers l'agent local (détecteur passif et empreinte), analysées en mémoire puis jetées.

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
- **Ce qui part au serveur** (`POST /api/sessions/:id/flash`) : le résumé de chaque essai (verdict, accord, p, retard, ampleur, images par seconde). Les mesures image par image restent dans le navigateur : la couleur de la peau image par image peut trahir le pouls, qui est une donnée de santé.
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
- **Les deux simulations** (photo qui renvoie l’écran, photo figée) vérifient seulement la chaîne technique. Elles ne comptent pas dans les chiffres.
- **Graphiques** : les bandes des couleurs affichées et les courbes de la teinte mesurée, puis l’accord selon le retard face à la ligne du hasard.

Calibré sur des caméras simulées (`packages/shared/test/flash.test.ts`) :

| Cas | Réussi | Échec |
|---|---|---|
| Visage avec un reflet de 1,5 % ou plus | 100 % | 0 % |
| Visage avec un reflet très faible (0,7 %) | 76 % | 2 % |
| Image injectée | 1 à 2 % | 82 à 93 % |

Ces chiffres sont à confirmer avec les 20 vrais essais. Les seuils sont dans `FLASH_THRESHOLDS`.

## Tests de bout en bout (`tools/e2e/`)

- `npm test` : tests unitaires (mesures du visage, test du reflet).
- `node tools/e2e/flash.mjs <photo de visage.jpg>` : 16 contrôles dans Chrome sans interface (site construit, serveur lancé, `BASE` et `CHROME_PATH` si besoin) :
  - espace de test (photo qui renvoie l’écran → réussi, photo figée → échec) ;
  - pré-vérification avec une fausse caméra fixe (deux essais → signal à vérifier, rapport) ;
  - « Passer ce test » ;
  - règles du serveur (ordre, nombre d’essais, validation).
- `node tools/e2e/server.mjs <dossier de données>` : 30 contrôles sur l'API (consentement, caméra virtuelle, sources publiques, chiffrement, comparaison, effacement). Lancer le serveur avec `KYC_DATA_DIR=<dossier de données>`.
- `python tools/e2e/make_video.py <visage.jpg> <sortie.y4m> [main.jpg]` : fabrique une fausse caméra (de face, tête tournée, main devant le visage).
- `node tools/e2e/browser.mjs <candidat.y4m> <autre.y4m> <captures> all` : parcours complet dans Chrome sans interface (`npm i playwright-core` dans un dossier à part, `CHROME_PATH` si Chrome n'est pas au chemin Windows par défaut) : pré-vérification, visio avec la même personne, puis substitution par une autre personne.

À régler sur nos 20 tests : seuils de continuité (`packages/shared/src/face.ts`) et de rotation (`TURN_YAW_DEG` dans `FaceId.tsx`). Le panneau de l'extension Chrome ne mesure pas encore les proportions du visage, mais ses captures alimentent déjà l'empreinte.
