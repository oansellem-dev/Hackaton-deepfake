# Oval — fiche de défense

**Un vrai visage derrière chaque écran.** Vérifier qu'un humain réel, et le bon, est présent dans une visio de recrutement. Le recruteur décide, l'outil éclaire.

## Le problème

Les deepfakes en direct (face-swap, filtres, caméras virtuelles) permettent de passer un entretien à la place d'une autre personne ou de maquiller son identité. Les recruteurs à distance n'ont aucun moyen de le voir, et un verdict automatique fondé sur la biométrie serait à la fois illégal (RGPD, article 9 et article 22) et dangereux (faux positifs qui écartent de vrais candidats).

## Notre solution

Trois briques reliées, et une règle : **le score part de 100 et ne baisse que sur des contradictions**. Rien n'est jamais « prouvé humain ».

1. **Pré-vérification (2 min)** : lien personnel à usage unique envoyé par e-mail. Créneau à confirmer ou contre-proposer, informations pré-remplies d'après le CV déposé par le recruteur, consentement explicite avec alternative sans biométrie, capture du visage (empreinte SFace et proportions calculées dans le navigateur), test de reflet d'écran, appareil (passkey).
2. **Widget flottant pendant la visio** (extension Chrome sur Meet / Zoom / Teams) : continuité du visage avec la pré-vérification, détecteur passif de trucage, caméra virtuelle, défis gestuels tirés au hasard (main devant le visage, rotation de la tête, phrase). Le défi « main devant le visage » repère un visage encore dessiné sous la main, signature d'un face-swap en direct.
3. **Dashboard recruteur** : calendrier, notifications de créneau, rapport avec chaque signal expliqué, décision tracée, suppression des biométries à la décision. Français / anglais.

**Où tourne l'analyse ?** Dans le navigateur. Le serveur ne reçoit que des nombres (similarités, proportions, probabilités, résultats de défis). Aucune image ni vidéo n'est transmise ni enregistrée ; les gabarits sont chiffrés (AES-256-GCM) et effacés à la décision ou après 24 h.

## Tests et résultats

| Test | Résultat |
|---|---|
| Filtre vidéo / face-swap sur la visio | Le score descend (détecteur passif + défi main) : 65 orange, 30 rouge en simulation API ; la première version restait à 100. |
| Continuité du visage | Similarité médiane sur 30 captures, seuils 0,40 (même) / 0,25 (différent) ; proportions ≥ 12 % d'écart = différent ; entre les deux, pas de conclusion. |
| Parcours complet | Création → e-mail → pré-vérification → créneau → widget → rapport, vérifié en local et sur le moteur déployé (Render). |
| Qualité | Typecheck des 4 applications, 21 tests unitaires (score, défis, environnement), build complet, écrans FR et EN contrôlés. |
| Sécurité | Jeton recruteur à temps constant, lien à usage unique, limiteur de débit par adresse, HTTPS forcé, no-referrer, e-mails échappés. |

## Limites connues

- Hébergement gratuit : sessions perdues au redéploiement, moteur en veille après inactivité (réveil affiché par le widget). Prochaine étape : base persistante.
- Le dashboard tourne en local ; l'e-mail part du poste du recruteur.
- Le détecteur passif est un modèle de recherche (licence non commerciale) ; un deepfake de très haute qualité qui réussit les défis peut passer. Oval réduit le risque, la décision reste humaine.
- LinkedIn n'est jamais scrappé ; la géolocalisation de l'IP n'est pas branchée.
- Extension chargée en mode développeur, pas encore sur le Chrome Web Store.

Dépôt : https://github.com/oansellem-dev/Hackaton-deepfake · Démo du moteur : https://oval-moteur.onrender.com
