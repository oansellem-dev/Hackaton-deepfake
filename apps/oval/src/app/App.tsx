import { useRoute } from "./router";
import { Shell } from "./Shell";
import { Toaster } from "../ui/ui";
import { nomComplet, parId, useEtat } from "../store/store";
import { Styleguide } from "../screens/Styleguide";
import { Accueil } from "../screens/Accueil";
import { EnConstruction } from "../screens/EnConstruction";
import { Candidat } from "../candidat/Candidat";

export function App() {
  const { parts } = useRoute();
  const etat = useEtat();
  const [p0, p1] = parts;
  if (p0 === "styleguide") return <><Styleguide /><Toaster /></>;
  if (p0 === "candidat") return <><Candidat token={p1} /><Toaster /></>;

  let actif = "accueil";
  let ecran: React.ReactNode;
  if (!p0) ecran = <Accueil />;
  else if (p0 === "entretiens") { actif = "entretiens"; ecran = <EnConstruction titre="Entretiens" etape={5} />; }
  else if (p0 === "rapport") {
    actif = "entretiens";
    const x = p1 ? parId(etat, p1) : undefined;
    ecran = x
      ? <EnConstruction titre={`Rapport · ${nomComplet(x)}`} texte={`Le rapport de ${nomComplet(x)} (déroulé minute par minute, signaux, résumé de Manta, décision) est le prochain écran, juste après la validation de l'accueil.`} />
      : <EnConstruction titre="Rapport introuvable" texte="Cet entretien n'existe pas ou a été supprimé." />;
  }
  else if (p0 === "defis") { actif = "defis"; ecran = <EnConstruction titre="Défis" etape={6} />; }
  else if (p0 === "reglages") { actif = "reglages"; ecran = <EnConstruction titre="Réglages" etape={6} reset />; }
  else ecran = <EnConstruction titre="Page introuvable" texte="Cette adresse ne mène nulle part." />;
  return <><Shell actif={actif}>{ecran}</Shell><Toaster /></>;
}
