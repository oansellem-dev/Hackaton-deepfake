# Contexte projet — « Le KYC de la visio »

> **À coller au début d'une nouvelle discussion.** Ce document donne tout le contexte de notre projet de hackathon. Il est à jour au samedi 10 octobre 2026, 16 h.
>
> **Consigne pour l'assistant qui lit ceci :** tu aides un membre de notre équipe à construire ce projet. Les décisions ci-dessous sont prises, ne les rediscute pas sauf si on te le demande. Reste dans le périmètre (un seul cas d'usage : le recrutement). Sois direct et concret, on a peu de temps. Si une information te manque, demande-la au lieu de l'inventer. Les points marqués « à vérifier » ne sont pas des faits établis.

---

## 1. Le hackathon

- **Événement :** Secure Horizons, organisé par UTOPIA, KRYPTOSPHERE et ESSEC MetaLab, à l'ESSEC Cergy.
- **Dates :** samedi 10 et dimanche 11 octobre 2026. Début du hack samedi à 11 h, durée annoncée 36 heures.
- **Heure de fin : à vérifier.** Les messages des organisateurs disent à la fois « 36 heures » et « jusqu'à dimanche matin ». On vise un produit figé dimanche à 8 h.
- **Participants :** 150, dotation 15 000 € en cash et crédits.
- **Notre track : Track 3, « Uncharted Frontiers » (open track).** Règle unique : IA × cybersécurité, côté défense.
  - Track 1 (à éviter) : finance, transactions, actifs numériques.
  - Track 2 (à éviter) : l'IA pour la cybersécurité et la sécurisation de l'IA elle-même.
- **Jury Track 3 :** Bpifrance, ESSEC Alumni, UTOPIA.
- **Ce qui gagne, selon la slide :** « Projects with a real chance of becoming a company, think customers from day one. »
- **Format des pitchs :** présélection de 4 minutes, puis deux équipes en finale devant le jury. Le pitch se fait en anglais (le français semble toléré), avec nos deux membres les plus à l'aise en anglais.

### Grille de notation Track 3

| Critère | Poids |
|---|---|
| Importance et originalité du problème | 25 % |
| Efficacité défensive démontrée | 25 % |
| Impact et passage à l'échelle | 20 % |
| Viabilité économique | 20 % |
| Pitch et démo | 10 % |

### Livrables demandés (en plus des livrables communs)

1. **Un PoC fonctionnel** qui prouve la proposition de valeur sur un scénario défensif concret.
2. **Une slide « Why this problem »** : preuves que le problème est réel (chiffres, incidents, réglementation, témoignages).
3. **Une slide « What next? »** : premiers clients cibles, feuille de route à 6 mois, besoins pour passer à l'échelle.

Conseil des organisateurs : « Freedom isn't vagueness » — énoncer le problème en une phrase et nommer les personnes qu'on aide.

---

## 2. Le projet en bref

**Nom de travail :** « Le KYC de la visio » (provisoire, à changer si l'équipe trouve mieux).

**Le problème en une phrase :**
> Les PME et ESN recrutent en visio des candidats qu'elles ne rencontrent jamais, et n'ont aucun moyen de vérifier qu'il y a un humain réel à l'écran.

**Pourquoi c'est un problème de sécurité, pas un problème RH** (point clé des mentors) :
- Pendant l'entretien, un faux candidat voit des données, des modèles et du code que l'entreprise ne montrerait à personne d'autre.
- S'il est embauché, il obtient des accès internes. C'est une intrusion par la porte d'entrée.
- Les banques vérifient l'identité avant d'ouvrir un compte (KYC). Personne ne vérifie l'humain en direct dans une visioconférence.

**La solution :** un score de fiabilité expliqué, affiché au recruteur pendant l'entretien. **Le recruteur décide, l'outil éclaire.**

Deux moments :
1. **Avant l'entretien — lien de pré-vérification.** Le candidat ouvre un lien. La page relève des signaux techniques (caméra virtuelle, cohérence fuseau horaire / langue / lieu déclaré, VPN) et lui affiche ce qui est vérifié et ce qui ne l'est pas.
2. **Pendant l'entretien — panneau recruteur avec mascotte.** Une petite mascotte souffle au recruteur des défis humains à proposer (main devant le visage, rotation de la tête, phrase aléatoire). L'outil vérifie à l'image qu'ils sont exécutés et affiche un score avec son explication.

---

## 3. La concurrence (veille faite le 10 octobre)

**Important : la détection de deepfake en direct pendant un entretien existe déjà. Ne jamais dire « ça n'existe pas ».**

| Acteur | Ce qu'il fait |
|---|---|
| Reality Defender | Un bot Zoom envoie la vidéo et le son à leurs serveurs et affiche un score au recruteur pendant l'appel. |
| Pindrop Pulse | S'intègre à Zoom, Teams et Webex pour signaler une voix ou une image synthétique. |
| Sherlock AI, InterviewGuard, Talview | Détection pendant l'entretien : candidats assistés par IA, doublures, deepfakes. |
| Persona, Onfido, Veriff | Vérification de pièce d'identité à l'embauche. Ce n'est pas notre terrain. |

### Notre différence

| Eux | Nous |
|---|---|
| Détection passive : un modèle regarde l'image | **Défis actifs guidés**, plus durs à contourner |
| Flux vidéo envoyé à leurs serveurs | **Analyse dans le navigateur**, aucune vidéo stockée |
| Grands comptes, prix sur devis | **PME et ESN**, prix affiché, installation en deux minutes |
| Conçus pour le marché américain | **Conçus pour le RGPD et l'AI Act** |

**À vérifier :** aucun concurrent français trouvé sur ce créneau, mais la recherche n'était pas exhaustive.

---

## 4. Les cinq règles de conception (non négociables)

Elles répondent aux deux grosses objections des mentors : les faux positifs et « c'est interdit en Europe ».

1. **L'absence de trace ne baisse jamais le score.** Seules les contradictions comptent. Un candidat sans LinkedIn n'est pas pénalisé.
2. **Le score est consultatif.** Le recruteur décide. Pas de décision automatisée (RGPD art. 22), supervision humaine attendue pour un usage à haut risque.
3. **On vérifie qu'un humain réel est présent, pas qui il est.** Aucune comparaison de visage avec une pièce d'identité : on reste hors de l'identification biométrique.
4. **Ni analyse d'émotions, ni collecte de photos.** La reconnaissance des émotions au travail et les bases de visages aspirées sur Internet sont des pratiques interdites par l'AI Act.
5. **Tout se passe dans le navigateur.** Aucune vidéo stockée, candidat informé avant l'entretien.

**Recoupement d'informations (ex-« scraping ») :** on ne scrape pas LinkedIn. On recoupe uniquement du texte que le candidat a lui-même fourni (CV, profils déclarés). Pour la démo, on utilise un candidat fictif.

**Réponse prête à « c'est interdit en Europe ? » (20 secondes) :**
> « Notre outil n'entre dans aucune pratique interdite. On ne fait ni reconnaissance d'émotions, ni catégorisation biométrique, ni base de visages. On vérifie qu'un flux vidéo n'est pas manipulé, pas qui est la personne. Comme tout outil d'IA en recrutement, on est classé à haut risque, donc encadré : candidat informé, humain qui décide, traçabilité. On l'a conçu pour ça dès le départ. »

**À vérifier :** cette lecture AI Act / RGPD doit être validée par un mentor compliance. Ce n'est pas un avis juridique, et le calendrier d'application de l'AI Act a évolué.

---

## 5. Architecture technique

Cinq briques, dans l'ordre de construction. Les deux premières suffisent à faire une démo.

| Brique | Rôle | Comment (suggestion) | Difficulté |
|---|---|---|---|
| **A. Page de pré-vérification** | Relève les signaux d'environnement du candidat et l'informe de ce qui est vérifié. | Page web simple : liste des caméras vues par le navigateur (noms de caméras virtuelles connues), fuseau horaire, langue, adresse IP côté serveur. | Facile |
| **B. Moteur de défis** | Tire un défi au hasard et vérifie à l'image qu'il est exécuté. C'est le cœur du produit. | Suivi du visage et des mains dans le navigateur avec une bibliothèque existante (type MediaPipe). Mesures : occlusion par la main, angle de la tête, délai d'exécution. | Moyenne |
| **C. Panneau recruteur et mascotte** | Affiche les défis à proposer, les résultats, le score en direct. | Extension Chrome en panneau latéral qui capture l'onglet de visio. **Plan B : notre propre page de visio.** | Moyenne |
| **D. Score et explication** | Agrège les signaux, produit une note et trois lignes d'explication. | Petit serveur (Python ou Node), règles pondérées. Un modèle de langage rédige l'explication à partir des signaux, sans rien inventer. | Facile |
| **E. Rapport d'entretien** | Une page à la fin : signaux, défis, décision du recruteur. | Page générée. Sert de preuve de traçabilité. | Facile |

**Hors PoC :** la détection de voix synthétique. Trop difficile à fiabiliser en 36 h, on l'annonce dans la feuille de route.

### Signaux et poids (point de départ, à ajuster sur nos tests)

| Signal | Poids | À retenir |
|---|---|---|
| Défi non exécuté, ou image qui se déforme pendant le défi | Fort | Le signal le plus fiable en démo. |
| Caméra virtuelle déclarée par le navigateur | Fort | Un nom de périphérique n'est pas une preuve : signaler, pas condamner. |
| Fuseau horaire ou IP incohérents avec le lieu déclaré | Moyen | Un VPN d'entreprise est légitime : toujours expliquer. |
| Délai de réponse anormal, décalage lèvres / son | Moyen | Si le temps manque, en feuille de route. |
| Contradiction entre le CV et les informations déclarées | Moyen | Uniquement du texte fourni par le candidat. |

### La mascotte : trois règles

1. Elle ne parle qu'au recruteur, jamais au candidat.
2. Elle suggère des phrases naturelles (« Pouvez-vous ajuster votre caméra ? »), pas des ordres.
3. Elle n'accuse jamais : « signal à vérifier », pas « faux candidat ».

C'est un habillage de la brique C, pas une brique en plus.

### Le chiffre à produire pour le jury

20 mini-entretiens de test : 10 avec un vrai visage, 10 avec un filtre de substitution de visage. On affiche le **taux de détection** et le **taux de faux positifs**. C'est la preuve des 25 % « efficacité défensive démontrée ».

---

## 6. Ne pas devenir obsolète

Objection attendue : « Et quand les deepfakes seront parfaits ? » On le dit nous-mêmes avant qu'on nous le demande.

1. **Des signaux indépendants.** Si l'un est battu, les autres tiennent. On en ajoute sans refaire le produit.
2. **Une bibliothèque de défis mise à jour**, comme les signatures d'un antivirus.
3. **Un test permanent.** Chaque mois, on attaque notre propre outil avec les nouveaux outils du marché et on publie le taux de détection.

C'est ce qui justifie l'abonnement : le client paie les mises à jour, pas un logiciel figé.

---

## 7. Planning

| Quand | Étape | Résultat attendu |
|---|---|---|
| Sam. 15 h – 16 h | **Cadrage.** Phrase-problème envoyée aux organisateurs, rôles répartis, dépôt de code et tableau de tâches créés. | Chacun sait ce qu'il livre ce soir. |
| Sam. 16 h – 17 h 30 | **Deux ateliers de 45 min.** Conformité avec un mentor. Marché : tester le prix auprès de deux recruteurs présents et recueillir leur témoignage. | Conformité validée, deux témoignages, un prix testé. |
| Sam. 16 h – 19 h | **Brique A** (avec l'écran d'information du candidat) et squelette du serveur de score. | Un lien qui remonte des signaux réels. |
| Sam. 16 h – 22 h | **Brique B** : un premier défi (main devant le visage) détecté de bout en bout. | Un défi validé sur un vrai visage. |
| **Sam. 22 h** | **Point de décision.** Le panneau dans la visio marche-t-il ? Si non, bascule sur notre propre page de visio. | Décision prise. |
| Sam. 22 h – dim. 2 h | Deuxième et troisième défis. Brique D. Brancher A, B et D, puis habiller le panneau avec la mascotte. | Tout fonctionne de bout en bout, même moche. |
| **Dim. 2 h – 3 h** | **Vidéo de secours** de la démo. | Une démo garantie quoi qu'il arrive. |
| Dim. 3 h – 6 h | Les 20 tests. Ajuster les poids. Brique E. Relais de sommeil. | Taux de détection et de faux positifs. |
| **Dim. 6 h – 8 h** | Finitions, puis **gel du code à 8 h**. | Produit figé. |
| Dim. 8 h – fin | Slides, pitch de 4 minutes, trois répétitions chronométrées. | Pitch tenu en 3 min 50. |

### Rôles

| Rôle | Responsabilités |
|---|---|
| Vidéo et défis | Brique B. La personne la plus à l'aise en JavaScript. |
| Serveur et score | Briques A et D, branchement de l'ensemble. |
| Interface et démo | Briques C et E, mascotte, scénario de démo, vidéo de secours. |
| Business et conformité | Les deux ateliers, les slides, le pitch, les réponses au jury. |

À quatre, un rôle chacun. À trois, fusionner interface et business. À cinq, doubler « Vidéo et défis ».

**Mon rôle dans l'équipe :** _(à compléter par chaque membre avant de coller ce document)_

---

## 8. Business

**Tous les prix ci-dessous sont des hypothèses, à tester ce week-end auprès de deux recruteurs.**

| Offre | Prix | Pour qui |
|---|---|---|
| Découverte | Gratuit, 5 entretiens par mois | Startups, pour faire entrer l'outil |
| Pro | 39 € par recruteur et par mois | PME, cabinets de recrutement |
| Équipe | 149 € par mois pour 5 recruteurs, puis 3 € par entretien au-delà d'un quota | ESN |
| Plateforme | Sur devis, à l'usage | Plateformes de freelances, logiciels de recrutement |

- **Premiers clients :** ESN, cabinets de recrutement tech, plateformes de freelances, startups qui recrutent à distance.
- **Coûts :** l'analyse tourne dans le navigateur du client. Le coût par entretien se limite à la rédaction de l'explication, quelques centimes.
- **Distribution :** ESN et cabinets en direct d'abord, puis intégration aux logiciels de recrutement.
- **Objectif à 12 mois (illustratif, pas une prévision) :** 150 clients à 120 € par mois en moyenne, soit 18 000 € de revenu mensuel.
- **Repères de marché** (issus d'un comparatif publié par un vendeur, ordre de grandeur seulement) : un outil de vérification de candidats avant entretien à 49 $ par mois en illimité ; une vérification d'identité à l'embauche entre 2 et 8 $ ; une petite entreprise dépense moins de 1 000 $ par mois au total sur ce sujet.

### Feuille de route à 6 mois (slide « What next? »)

- Détection de voix synthétique.
- Intégrations aux outils de visio.
- Pilote avec deux ESN.
- Prochain marché : le support informatique.

---

## 9. Chiffres sourcés (slide « Why this problem »)

| Chiffre | Source | Attention |
|---|---|---|
| D'ici 2028, un profil de candidat sur quatre dans le monde **pourrait** être faux | Gartner, communiqué du 31 juillet 2025 | Gartner écrit « could » : garder le conditionnel. |
| 6 % des candidats reconnaissent avoir participé à une fraude à l'entretien | Même enquête Gartner, 3 000 candidats | — |
| Plus de 130 entreprises américaines piégées par de faux travailleurs IT nord-coréens | Département de la Justice américain, cité par Staffing Industry Analysts | — |
| Infiltrations de faux travailleurs IT nord-coréens en hausse de 220 % en un an | CrowdStrike, cité par Fortune (août 2025) | — |
| L'Allemagne, le Portugal et le Royaume-Uni sont visés ; fermes de laptops repérées en Roumanie et en Pologne | Google Threat Intelligence, CrowdStrike | — |
| Marché européen des technologies deepfake : environ 250 M$ en 2025, plus d'un milliard d'ici 2030 | MarketsandMarkets | La page se contredit sur l'année exacte : rester sur « plus d'un milliard d'ici 2030 ». |

**À faire :** relire les sources d'origine avant de mettre un chiffre en slide.

### Autres cas d'usage

| Cas | Ce que dit la veille | Verdict |
|---|---|---|
| Support informatique | Les intrusions chez MGM, Caesars et Marks & Spencer sont attribuées à un groupe qui commence souvent par un appel au support. | **Notre « What next »** |
| Onboarding de freelances et prestataires | Même problème que le recrutement, mêmes clients. | Extension naturelle |
| Fausses visios de dirigeants | Arup a perdu 25,6 M$ après une visio où tous les participants étaient des deepfakes. | Exemple seulement : c'est de la track 1 |
| Examens en ligne, téléconsultation | Non vérifié. | Ne pas mettre en avant |

**Règle des mentors :** un seul cas d'usage dans le produit et le pitch (le recrutement). Les autres tiennent en 15 secondes d'ouverture.

---

## 10. Pitch et démo

### Pitch de 4 minutes

| Temps | Contenu |
|---|---|
| 0:00 – 0:40 | L'accroche : un entretien, un candidat parfait, qui n'existe pas. Une intrusion, pas une perte de temps. |
| 0:40 – 1:10 | Le chiffre Gartner (au conditionnel) et l'analogie : on fait du KYC partout, sauf en visio. |
| 1:10 – 2:40 | **La démo en direct.** |
| 2:40 – 3:10 | Les résultats mesurés, la conformité en une phrase. |
| 3:10 – 3:45 | Les clients, le prix, les 6 prochains mois. |
| 3:45 – 4:00 | L'ouverture : demain le support informatique, puis toute visio sensible. |

### Scénario de démo

1. Le « recruteur » envoie le lien de pré-vérification. Premier signal : caméra virtuelle détectée.
2. L'entretien démarre. La mascotte propose un défi, le recruteur le demande naturellement.
3. L'image du faux candidat se déforme. Le score chute, l'explication s'affiche.
4. Même parcours avec un vrai candidat : tout est au vert. **Indispensable**, sinon on croit que l'outil dit toujours non.
5. Le rapport d'entretien s'affiche.

### Deepfake d'une personne réelle : accord écrit obligatoire

Un mentor a suggéré de faire le deepfake d'un membre du jury à partir de ses vidéos et photos publiques. **On ne le fait que si la personne concernée donne elle-même son accord écrit**, pour un usage limité à la démo et supprimé après. Sans cet accord, on utilise un membre de l'équipe ou un mentor volontaire. Cloner la voix ou le visage de quelqu'un sans son consentement est sanctionné en France, et ça détruirait notre argument conformité.

---

## 11. Objections et parades

| Objection | Parade |
|---|---|
| La démo en direct échoue | Vidéo de secours enregistrée dans la nuit. Répéter sur le Wi-Fi de la salle. |
| Le panneau dans la visio ne marche pas | Décision à 22 h samedi : bascule sur notre propre page de visio. |
| « C'est interdit en Europe » | Aucune pratique interdite. Usage à haut risque, donc encadré, et conçu pour ça. |
| « Ça existe déjà » | Oui, aux États-Unis, pour les grands comptes. Nous : défis actifs, tout dans le navigateur, prix PME, conçu pour l'Europe. |
| « Et les faux positifs ? » | Règle n° 1, taux mesuré, et le recruteur décide. |
| « Et quand les deepfakes seront parfaits ? » | Signaux indépendants, défis mis à jour, test mensuel publié. |
| On s'éparpille | Un seul cas d'usage. Le reste en 15 secondes. |

---

## 12. Ce que les mentors nous ont dit

- Le vrai problème est la **sécurité** (vol de données pendant l'entretien), pas le temps perdu des RH.
- Attention aux **faux positifs** : quelqu'un sans réseaux sociaux ne doit pas être pénalisé.
- Vérifier que le cas d'usage n'est **pas interdit** par l'AI Act. « À haut risque » est acceptable, « interdit » ne l'est pas.
- **Sourcer** chaque chiffre dans le pitch.
- L'analogie **KYC** est un bon angle.
- Faire une veille sur les autres cas d'usage, mais **ne pas partir dans le flou** : un focus, puis une ouverture chiffrée de 15 secondes.
- Le produit est **visuel**, c'est un avantage face aux équipes qui montrent des agents dans un terminal.
- S'organiser en **ateliers chronométrés** de 45 minutes.

---

## 13. Ce qu'on ne fait pas

- On n'ajoute plus de fonctionnalités. On ajoute des **preuves** : deux témoignages de recruteurs, nos chiffres de test, l'écran côté candidat.
- Pas de détection de voix dans le PoC.
- Pas de scraping de réseaux sociaux, pas de collecte de photos.
- Pas d'analyse d'émotions ni de « sincérité ».
- Pas de comparaison de visage avec une pièce d'identité.
- Pas de décision automatique : le score est une aide.
- Pas de deepfake d'une personne réelle sans son accord écrit.

---

## 14. Encore à vérifier

- [ ] L'heure exacte de rendu et le format de dépôt.
- [ ] La lecture AI Act et RGPD avec un mentor compliance.
- [ ] L'existence d'un concurrent français.
- [ ] Les prix auprès de deux recruteurs.
- [ ] Les sources d'origine de chaque chiffre avant mise en slide.
- [ ] L'accord écrit de toute personne réelle utilisée dans la démo.

---

## 15. Sources

- HR Dive, prédiction Gartner — https://www.hrdive.com/news/fake-job-candidates-ai/757126/
- Reality Defender, démonstration sur Zoom — https://www.realitydefender.com/insights/inside-our-live-demo-catching-deepfake-job-candidates-on-zoom
- Verif_Hire, comparatif des outils et des prix — https://verif-hire.com/resources/fake-candidate-detection-tools/
- MarketsandMarkets, marché européen — https://www.marketsandmarkets.com/Market-Reports/geography/deepfake-ai-market/Europe
- Trusona, attaques contre le support informatique — https://www.trusona.com/blog/your-help-desk-agent-cant-tell-its-not-you-anymore
- Staffing Industry Analysts, deepfakes et faux candidats — https://staffingindustry.com/editorial/cws-30-contingent-workforce-strategies/ai-deepfakes-and-fraudulent-candidates-a-compliance-crisis-hiding-in-your-hiring-pipeline
- Fortune, infiltrations nord-coréennes — https://fortune.com/2025/08/04/north-korean-it-worker-infiltrations-exploded/
- Field Effect, extension du schéma en Europe — https://fieldeffect.com/blog/it-worker-scheme-expands-europe

Plusieurs de ces sources sont des blogs de vendeurs : à citer avec prudence.
