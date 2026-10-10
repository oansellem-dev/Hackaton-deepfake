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
