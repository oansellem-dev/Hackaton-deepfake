import { useRoute } from "./router";
import { Shell } from "./Shell";
import { Toaster } from "../ui/ui";
import { Styleguide } from "../screens/Styleguide";
import { Accueil } from "../screens/Accueil";
import { EnConstruction } from "../screens/EnConstruction";
import { Rapport } from "../screens/Rapport";
import { RapportImprimer } from "../screens/RapportImprimer";
import { Entretiens } from "../screens/Entretiens";
import { Defis } from "../screens/Defis";
import { Reglages } from "../screens/Reglages";
import { Visio } from "../visio/Visio";
import { Candidat } from "../candidat/Candidat";

export function App() {
  const { parts } = useRoute();
  const [p0, p1] = parts;
  if (p0 === "styleguide") return <><Styleguide /><Toaster /></>;
  if (p0 === "candidat") return <><Candidat token={p1} /><Toaster /></>;
  if (p0 === "visio" && p1) return <><Visio id={p1} /><Toaster /></>;
  if (p0 === "rapport" && p1 && parts[2] === "imprimer") return <><RapportImprimer id={p1} /><Toaster /></>;

  let actif = "accueil";
  let ecran: React.ReactNode;
  if (!p0) ecran = <Accueil />;
  else if (p0 === "entretiens") { actif = "entretiens"; ecran = <Entretiens />; }
  else if (p0 === "rapport" && p1) { actif = "entretiens"; ecran = <Rapport id={p1} />; }
  else if (p0 === "defis") { actif = "defis"; ecran = <Defis />; }
  else if (p0 === "reglages") { actif = "reglages"; ecran = <Reglages />; }
  else ecran = <EnConstruction titre="Page introuvable" texte="Cette adresse ne mène nulle part." />;
  return <><Shell actif={actif}>{ecran}</Shell><Toaster /></>;
}
