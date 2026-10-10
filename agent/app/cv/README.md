# 🔍 Scraper — Branche `scrapeur_hector`

Deux modules Python pour analyser le CV d'un candidat et générer automatiquement des requêtes de vérification professionnelle.

---

## 📄 `extract_pdf.py` — Extraction du texte d'un PDF

### Ce que ça fait
Lit un fichier PDF (CV du candidat) et en extrait tout le texte brut, page par page, en utilisant la bibliothèque **pdfplumber**.

### Pourquoi pdfplumber ?
Contrairement à un extracteur basique, `pdfplumber` respecte la mise en page (colonnes, sauts de ligne, indentations) ce qui rend le texte directement exploitable pour en parser les informations.

### Utilisation

```python
from extract_pdf import extract_text_from_pdf

# Depuis un fichier local
texte = extract_text_from_pdf("cv_candidat.pdf")

# Depuis un upload web (FastAPI / Flask) — bytes ou file object
texte = extract_text_from_pdf(uploaded_file.file)
```

### Ce que ça retourne
Une chaîne de texte brut avec le contenu complet du PDF, prêt à être parsé pour extraire :
- Nom du candidat
- Formations & écoles
- Expériences professionnelles
- Projets

### Dépendance
```bash
pip install pdfplumber
```

---

## 🔎 `checks.py` — Générateur de requêtes de vérification professionnelle

### Ce que ça fait
À partir des informations extraites du CV, génère automatiquement une liste de **requêtes de recherche web ciblées** (dorks) et leurs **liens Google cliquables** correspondants.

Ces liens permettent au recruteur de vérifier manuellement les affirmations du CV (employeur, école, poste) en un clic depuis le panneau recruteur.

### Principe RGPD respecté
Le serveur ne scrape rien automatiquement. Il génère uniquement des **liens Google cliquables** que le recruteur ouvre lui-même. Zéro aspiration automatique de données tierces.

### Types de requêtes générées

| Catégorie | Exemple de requête produite |
|---|---|
| Nom + École | `"Jules Espy" "Eugenia School"` |
| Nom + École + Diplôme | `"Jules Espy" "Eugenia School" "Bachelor in AI"` |
| Nom + Promotion | `"Jules Espy" "Eugenia School" promotion 2025` |
| Nom + Entreprise + Poste | `"Jules Espy" "The Room Social App" "Europe Lead"` |
| Nom inversé + Entreprise | `"Espy Jules" "The Room Social App"` |
| Page équipe sur le site | `"Jules Espy" site:theroom.app` |
| Registre légal (fondateur) | `"Jules Espy" site:pappers.fr` |
| Profil LinkedIn | `site:linkedin.com/in "Jules Espy"` |
| GitHub | `site:github.com "Jules Espy"` |
| Malt (freelance) | `site:malt.fr "Jules Espy"` |

### Utilisation

```python
from checks import generate_verification_queries

candidat = {
    "nom": "Jules Espy",
    "formations": [
        {"ecole": "Eugenia School", "diplome": "Bachelor in AI Applied to Business", "annee": "2025"}
    ],
    "experiences": [
        {"entreprise": "The Room Social App", "poste": "Europe Lead", "domaine_web": "theroom.app"}
    ]
}

liens = generate_verification_queries(candidat, country="FR")

for lien in liens:
    print(lien["label"], "->", lien["url"])
```

### Ce que ça retourne
Une liste de dictionnaires, chacun contenant :
- `categorie` : type de vérification (Formation, Expérience, Plateforme pro…)
- `label` : description lisible du lien
- `requete` : la requête brute
- `url` : le lien Google cliquable direct
- `rgpd` : justification légale de la vérification

### Variantes multilingues incluses
Le module intègre les mots-clés d'équipe et d'alumni dans 5 langues (FR, EN, DE, ES, IT) et les registres officiels d'entreprises pour 4 pays (France, UK, Allemagne, Pays-Bas).

### Dépendances
```bash
pip install ddgs  # moteur de recherche (optionnel, si vérification automatique)
```

---

## 🔗 Intégration dans le projet

Ces deux modules s'intègrent dans la **Brique A** (pré-vérification avant entretien) et la **Brique D** (score et explication) de l'architecture du projet KYC Visio :

```
CV (PDF)
   │
   ▼
extract_pdf.py  ──► texte brut
   │
   ▼
[parser NLP]  ──► données structurées (nom, école, entreprise...)
   │
   ▼
checks.py  ──► liens de vérification cliquables
   │
   ▼
Panneau Recruteur  ──► le recruteur clique et vérifie
```
