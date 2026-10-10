import { useRoute } from "./router";
import { Nav } from "../dashboard/Nav";
import { Liste } from "../dashboard/Liste";
import { Rapport } from "../dashboard/Rapport";
import { EnvoiLien } from "../dashboard/EnvoiLien";
import { Rapports } from "../dashboard/Rapports";
import { Reglages } from "../dashboard/Reglages";
import { PreVerif } from "../candidat/PreVerif";
import { Vitrine } from "../manta/Vitrine";
import "../dashboard/dashboard.css";

export function App() {
  const { parts } = useRoute();
  const [p0, p1] = parts;

  // Page candidat : une colonne, sans la navigation recruteur
  if (p0 === "candidat") return <PreVerif token={p1 ?? "demo"} />;
  if (p0 === "manta") return <Vitrine />;

  let ecran: React.ReactNode;
  let onglet = "entretiens";
  if (p0 === "rapport" && p1) { ecran = <Rapport id={p1} />; onglet = "rapports"; }
  else if (p0 === "rapports") { ecran = <Rapports />; onglet = "rapports"; }
  else if (p0 === "pre-verifications") { ecran = <EnvoiLien />; onglet = "pre-verifications"; }
  else if (p0 === "reglages") { ecran = <Reglages />; onglet = "reglages"; }
  else ecran = <Liste />;

  return (
    <div className="surface dash">
      <Nav onglet={onglet} />
      {ecran}
    </div>
  );
}
