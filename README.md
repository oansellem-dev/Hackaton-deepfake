# KYC Visio

Vérifier qu'un humain réel est présent dans une visio de recrutement. Le recruteur décide, l'outil éclaire.

## Lancer

```bash
npm install
npm run dev        # serveur :8787 + site :5173 + extension (build en watch)
```

Extension Chrome : `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » → `apps/extension/dist`.
Après une modification, cliquer sur « Recharger » dans `chrome://extensions`.

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
