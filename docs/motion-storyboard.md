# Oval — storyboard de la vidéo V3 « Les murs qu'on a franchis »

Composition Remotion `OvalV3` dans `motion/` : 180 s, 1920 × 1080, 30 i/s, 5 400 images. Rendu : `motion/out/oval-v3.mp4`.

Fil rouge : le parcours d'un candidat, de l'e-mail à la décision du RH. Quatre murs, chacun devient une porte (primitive `<WallBreak>` : le mur arrive, un titre et une fissure dorée se tracent, puis les deux battants s'ouvrent ; 1,2 s → 1,05 s → 0,9 s → 0,8 s, même dessin). Un rail de progression reste en haut (Lien → Infos → Visage → Visio → Rapport) avec le compteur « Murs franchis 0/4 → 4/4 ». Captures réelles du produit (`motion/public/captures/`) dans un cadre de navigateur avec pan et zoom.

| # | Scène | Début | Durée | Image clé | Transition | Captures |
|---|---|---|---|---|---|---|
| 1 | Accroche | 0:00 | 12 s | Candidat en visio, quatre phrases, glitch RVB sur « Il n'existe pas. » | Le cadre se déchire vers la gauche | avatar (reconstitution) |
| 2 | Problème | 0:12 | 13 s | Le visage affiché se décolle comme un masque, badge d'accès qui glisse | Fondu | avatars |
| 3 | Oval | 0:25 | 15 s | Logo, Manta, parcours qui se dessine (Dashboard → Rapport) | Le rail monte en haut | — |
| 4 | Lien | 0:40 | 12 s | Planning, fenêtre « Nouvel entretien », e-mail, lien `/check/…` tapé, tampon « usage unique · 24 h » | Pan latéral | dash-calendrier, dash-nouvel-entretien |
| 5 | Mur 1 LinkedIn | 0:52 | 18 s | `<WallBreak>` « in » barré ; sources publiques qui s'allument, deux incohérences en orange | Porte 1,2 s · compteur 1/4 | cand-identite |
| 6 | Environnement | 1:10 | 10 s | `enumerateDevices()`, OBS et ManyCam barrés, fuseau, IP | Pan | cand-visage |
| 7 | Visage | 1:20 | 18 s | Ovale de scan, maillage 478 points, main qui passe ; écran scindé vrai / substitué (Illustration) | Le visage se floute | avatars |
| 8 | Mur 2 Photo | 1:38 | 20 s | RGPD art. 9 ; photo barrée « jamais envoyée », 128 nombres, coffre AES-256-GCM, minuteur 24 h | Porte 1,05 s · 2/4 | avatar |
| 9 | Mur 3 Lumière | 1:58 | 18 s | Écran qui change de couleur (5 couleurs, 1 s, fondu 0,3 s), courbes vrai / faux (Illustration) | Porte 0,9 s · 3/4 | avatar |
| 10 | Mur 4 Swap en visio | 2:16 | 20 s | Deux visages, jauge 0,97 → 0,05 au moment du swap, signal « Visage différent », panneau, Manta souffle un défi | Porte 0,8 s · 4/4 | panel |
| 11 | Rapport | 2:36 | 14 s | Rapport Oval, jauge 71 « consultatif », trois signaux, trois décisions | Repli | dash-rapport |
| 12 | Conclusion | 2:50 | 10 s | Quatre portes qui se replient, logo, signature, fondu au blanc | — | — |

Faits affichés (sources : code et doc du dépôt) : lien 32 caractères, 24 h, usage unique · sources Wikipédia, GitHub, ORCID, Brave · MediaPipe 478 repères / 21 par main · SFace 128 nombres + proportions, AES-256-GCM, 24 h · test de lumière 5 couleurs, 1 s, fondu 0,3 s · comparaison toutes les 2 s, seuils 0,40 / 0,25, 12 % · mesuré 0,97 et 0,05 · seules les contradictions comptent. Les courbes de reflet et l'écran scindé sont marqués « Illustration », la visio de l'accroche « Reconstitution ».

Produire : `cd motion && npm i && node scripts/stills.mjs 200 1000 1950 2800 3350 3950 4550 4900` (images clés) puis `npx remotion render OvalV3 out/oval-v3.mp4`. Les captures se régénèrent avec `scratchpad/captures/capture.mjs` (Chrome headless sur les serveurs de dev).
