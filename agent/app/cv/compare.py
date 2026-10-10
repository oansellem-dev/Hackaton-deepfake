"""Comparaison entre le CV (chargé par le recruteur) et ce que le candidat a déclaré à la pré-vérification.

Le CV est lu en mémoire puis oublié : on ne garde que les éléments comparés, les écarts et les liens de vérification.
Règle n°1 : on ne compare que ce qui existe des deux côtés. Une information absente du CV ou du formulaire
ne crée jamais d'incohérence.
"""
import re
import unicodedata

from .checks import generate_verification_queries

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE = re.compile(r"(?:\+|00)?\d[\d .\-()]{7,}\d")
GITHUB = re.compile(r"github\.com/([A-Za-z0-9-]{1,39})", re.I)
LINKEDIN = re.compile(r"linkedin\.com/in/([A-Za-z0-9\-_%]+)", re.I)
YEAR = re.compile(r"\b(?:19|20)\d{2}\b")
SCHOOL = re.compile(
    r"((?:[A-ZÉÈ][\w'’\-]*\s){0,3}"
    r"(?:School|[ÉE]cole|Universit[ée]|University|Universidad|Lyc[ée]e|Institut|Institute|IUT|IAE|Polytechnique|Sciences Po)"
    r"(?:\s(?:de\s|d'|des\s|du\s)?[A-ZÉÈ][\w'’\-]*){0,4})"
)
DIPLOMA = re.compile(
    r"\b(Bachelor|Master|MSc|MBA|Licence|BTS|DUT|BUT|Doctorat|PhD|Baccalauréat|Diplôme d'ingénieur)\b[^\n,;|]{0,50}"
)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    return re.sub(r"\s+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).lower().strip()


def digits(phone: str) -> str:
    d = re.sub(r"\D", "", phone)
    return d[-9:]  # les 9 derniers chiffres : indépendants de l'indicatif (+33 6… = 06…)


def _schools(text: str) -> list[dict]:
    out, seen = [], set()
    for line in text.splitlines():
        m = SCHOOL.search(line)
        if not m:
            continue
        school = m.group(1).strip(" -–,;")
        if norm(school) in seen or len(school) < 4:
            continue
        seen.add(norm(school))
        year = YEAR.findall(line)
        diploma = DIPLOMA.search(line)
        out.append({"ecole": school, "annee": year[-1] if year else "",
                    "diplome": diploma.group(0).strip(" -–,;") if diploma else ""})
    return out[:5]


def analyze(text: str, declared: dict, country: str = "FR") -> dict:
    t = norm(text)
    first, last = declared.get("firstName", ""), declared.get("lastName", "")
    found = {
        "emails": sorted({e.lower() for e in EMAIL.findall(text)}),
        "phones": sorted({p.strip() for p in PHONE.findall(text) if len(re.sub(r"\D", "", p)) >= 9}),
        "github": sorted({g.lower() for g in GITHUB.findall(text)}),
        "linkedin": sorted({l.lower().rstrip("/") for l in LINKEDIN.findall(text)}),
        "schools": _schools(text),
    }
    issues, matches = [], []

    def compare(field: str, ok: bool, same: str, label: str, detail: str):
        if ok:
            matches.append(same)
        else:
            issues.append({"field": field, "label": label, "detail": detail})

    if first and last:
        compare("cv.name", norm(first) in t and norm(last) in t, "nom",
                "Nom déclaré absent du CV",
                f"« {first} {last} » n'apparaît pas dans le CV : nom d'usage possible, à vérifier.")

    email = (declared.get("email") or "").lower()
    if email and found["emails"]:
        compare("cv.email", email in found["emails"], "e-mail",
                "E-mail différent de celui du CV",
                f"Le CV indique {', '.join(found['emails'][:2])} ; la pré-vérification {email}. "
                "Adresse personnelle ou professionnelle : à demander simplement.")

    phone = declared.get("phone") or ""
    if phone and found["phones"]:
        compare("cv.phone", digits(phone) in {digits(p) for p in found["phones"]}, "téléphone",
                "Téléphone différent de celui du CV",
                f"Le CV indique {found['phones'][0]} ; la pré-vérification {phone}.")

    gh = re.search(r"github\.com/([A-Za-z0-9-]+)", declared.get("githubUrl") or "", re.I)
    if gh and found["github"]:
        compare("cv.github", gh.group(1).lower() in found["github"], "GitHub",
                "Profil GitHub différent de celui du CV",
                f"Le CV indique github.com/{found['github'][0]} ; la pré-vérification github.com/{gh.group(1)}.")

    li = re.search(r"linkedin\.com/in/([A-Za-z0-9\-_%]+)", declared.get("linkedinUrl") or "", re.I)
    if li and found["linkedin"]:
        compare("cv.linkedin", li.group(1).lower().rstrip("/") in found["linkedin"], "LinkedIn",
                "Profil LinkedIn différent de celui du CV",
                f"Le CV indique linkedin.com/in/{found['linkedin'][0]} ; la pré-vérification "
                f"linkedin.com/in/{li.group(1)}.")

    company = declared.get("company") or ""
    if company:
        compare("cv.company", norm(company) in t, "entreprise",
                "Entreprise déclarée absente du CV",
                f"« {company} » n'apparaît pas dans le CV : nom commercial différent ou poste récent, à vérifier.")

    # Liens de vérification en un clic (module d'Hector) : le recruteur les ouvre lui-même, rien n'est aspiré.
    links = generate_verification_queries({
        "nom": f"{first} {last}".strip(),
        "formations": found["schools"],
        "experiences": [{"entreprise": company, "poste": declared.get("jobTitle") or "", "annee": "",
                         "domaine_web": ""}] if company else [],
    }, country=country if country in ("FR", "UK", "DE") else "FR")

    return {
        "found": {k: found[k] for k in ("emails", "phones", "github", "linkedin")}
                 | {"schools": [s["ecole"] for s in found["schools"]]},
        "inconsistencies": issues,
        "consistent": matches,
        "links": [{"categorie": l["categorie"], "label": l["label"], "url": l["url"]} for l in links],
    }
