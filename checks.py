"""
Module de génération de requêtes et liens de vérification professionnelle (Dorks KYC).
Conçu dans le respect strict du RGPD et de l'AI Act :
- Aucune collecte de données personnelles privées (uniquement ce que le candidat a déclaré).
- Génération de liens Google cliquables pour une vérification humaine par le recruteur.
- Zéro profilage automatisé ni aspiration sauvage.
"""

import urllib.parse
from typing import Dict, List, Any

# Variantes linguistiques européennes
LANG_KEYWORDS = {
    "FR": {
        "team": ["équipe", "à propos", "nous rejoindre"],
        "alumni": ["diplômé", "promotion", "alumni"]
    },
    "EN": {
        "team": ["team", "about us", "join us", "people"],
        "alumni": ["alumni", "graduate", "class of"]
    },
    "DE": {
        "team": ["Team", "Über uns", "Mitarbeiter"],
        "alumni": ["Absolvent", "Abschlussjahr", "Alumni"]
    },
    "ES": {
        "team": ["equipo", "quiénes somos"],
        "alumni": ["egresado", "promoción", "alumni"]
    },
    "IT": {
        "team": ["team", "chi siamo"],
        "alumni": ["laureato", "laurea", "alumni"]
    }
}

# Registres officiels d'entreprises par pays
REGISTRIES = {
    "FR": [
        {"name": "Annuaire des Entreprises (Gouv)", "site": "annuaire-entreprises.data.gouv.fr"},
        {"name": "Pappers / Société.com", "site": "pappers.fr OR site:societe.com"}
    ],
    "UK": [
        {"name": "Companies House", "site": "find-and-update.company-information.service.gov.uk"}
    ],
    "DE": [
        {"name": "Unternehmensregister", "site": "unternehmensregister.de"}
    ]
}

def make_google_link(query: str) -> str:
    """Génère une URL de recherche Google directe pour une requête donnée."""
    return f"https://www.google.com/search?q={urllib.parse.quote(query)}"

def generate_verification_queries(data: Dict[str, Any], country: str = "FR") -> List[Dict[str, str]]:
    """
    Génère la liste complète des requêtes de vérification professionnelle à partir des données du candidat.
    Retourne une liste de dictionnaires avec catégorie, requête, URL Google et justification RGPD.
    """
    name = data.get("nom", "").strip()
    if not name:
        return []

    # Inversion Prénom / Nom pour variantes
    parts = name.split()
    inverted_name = f"{parts[-1]} {' '.join(parts[:-1])}" if len(parts) > 1 else name

    lang = LANG_KEYWORDS.get(country, LANG_KEYWORDS["FR"])
    team_kw = " OR ".join([f'"{k}"' for k in lang["team"]])
    alumni_kw = " OR ".join([f'"{k}"' for k in lang["alumni"]])

    queries = []

    # 1. Identité & Formations déclarées
    for edu in data.get("formations", []):
        school = edu.get("ecole", "")
        year = edu.get("annee", "")
        diploma = edu.get("diplome", "")

        if school:
            # Nom + École
            q1 = f'"{name}" "{school}"'
            queries.append({
                "categorie": "Formation",
                "label": f"Présence chez {school}",
                "requete": q1,
                "url": make_google_link(q1),
                "rgpd": "Vérification de l'établissement d'enseignement déclaré"
            })

            # Nom + École + Diplôme
            if diploma:
                q2 = f'"{name}" "{school}" "{diploma}"'
                queries.append({
                    "categorie": "Formation",
                    "label": f"Diplôme {diploma} chez {school}",
                    "requete": q2,
                    "url": make_google_link(q2),
                    "rgpd": "Vérification de l'intitulé de diplôme"
                })

            # Promotion / Alumni
            if year:
                q3 = f'"{name}" "{school}" promotion {year}'
                queries.append({
                    "categorie": "Formation",
                    "label": f"Promotion {year} chez {school}",
                    "requete": q3,
                    "url": make_google_link(q3),
                    "rgpd": "Vérification de l'année de cursus"
                })

    # 2. Expériences professionnelles & Projets
    for exp in data.get("experiences", []):
        company = exp.get("entreprise", "")
        role = exp.get("poste", "")
        year = exp.get("annee", "")
        domain = exp.get("domaine_web", "")

        if company:
            # Nom + Entreprise + Poste
            if role:
                q = f'"{name}" "{company}" "{role}"'
                queries.append({
                    "categorie": "Expérience",
                    "label": f"Poste {role} chez {company}",
                    "requete": q,
                    "url": make_google_link(q),
                    "rgpd": "Vérification du rôle professionnel déclaré"
                })

            # Nom inversé + Entreprise
            q_inv = f'"{inverted_name}" "{company}"'
            queries.append({
                "categorie": "Expérience",
                "label": f"Mention {company} (ordre inversé)",
                "requete": q_inv,
                "url": make_google_link(q_inv),
                "rgpd": "Variante orthographique du nom"
            })

            # Page équipe sur le site de l'entreprise si domaine disponible
            if domain:
                q_team = f'"{name}" ({team_kw}) site:{domain}'
                queries.append({
                    "categorie": "Expérience",
                    "label": f"Page équipe sur {domain}",
                    "requete": q_team,
                    "url": make_google_link(q_team),
                    "rgpd": "Présence dans l'équipe officielle déclarée"
                })

            # Si rôle de fondateur / dirigeant -> Registres officiels
            if any(k in role.lower() for k in ["fondateur", "co-fondateur", "ceo", "gérant", "dirigeant"]):
                for reg in REGISTRIES.get(country, []):
                    q_reg = f'"{name}" site:{reg["site"]}'
                    queries.append({
                        "categorie": "Registre Légal",
                        "label": f"Mandat légal sur {reg['name']}",
                        "requete": q_reg,
                        "url": make_google_link(q_reg),
                        "rgpd": "Vérification sur registre d'immatriculation public"
                    })

    # 3. Plateformes professionnelles ciblées
    for platform, site in [
        ("LinkedIn", "site:linkedin.com/in"),
        ("Malt", "site:malt.fr"),
        ("GitHub", "site:github.com"),
        ("Welcome to the Jungle", "site:welcometothejungle.com")
    ]:
        q_plat = f'{site} "{name}"'
        queries.append({
            "categorie": "Plateforme pro",
            "label": f"Profil public {platform}",
            "requete": q_plat,
            "url": make_google_link(q_plat),
            "rgpd": "Vérification de présence sur plateforme déclarable"
        })

    # 4. Publications / Travaux techniques (Google Scholar, Thèses)
    q_scholar = f'"{name}" site:scholar.google.com'
    queries.append({
        "categorie": "Publications",
        "label": "Publications scientifiques (Google Scholar)",
        "requete": q_scholar,
        "url": make_google_link(q_scholar),
        "rgpd": "Vérification d'écrits scientifiques éventuels"
    })

    return queries

if __name__ == "__main__":
    # Test avec le profil réel extrait du CV d'Hector Lebrun
    candidat_test = {
        "nom": "Hector Lebrun",
        "ville": "La Celle St Cloud",
        "formations": [
            {"ecole": "Eugenia School", "diplome": "Bachelor Business & Operations", "annee": "2025"},
            {"ecole": "Lycée Corneille", "diplome": "Baccalauréat général", "annee": "2024-2025"}
        ],
        "experiences": [
            {"entreprise": "Switlyassist", "poste": "Co-fondateur", "annee": "2024", "domaine_web": "switlyassist.com"},
            {"entreprise": "Burger King", "poste": "Employé polyvalent", "annee": "2024"},
            {"entreprise": "Midas", "poste": "Assistant logistique", "annee": "2023"}
        ]
    }

    resultats = generate_verification_queries(candidat_test, country="FR")
    print(f"Total requêtes générées : {len(resultats)}\n")
    for r in resultats[:8]:
        print(f"[{r['categorie']}] {r['label']}")
        print(f"  Requête : {r['requete']}")
        print(f"  Lien Google : {r['url']}\n")
