import { Manta, type MantaState } from "./Manta";

const ETATS: { s: MantaState; t: string }[] = [
  { s: "neutre", t: "Tout va bien. Je regarde avec vous." },
  { s: "defi", t: "Demandez-lui : pouvez-vous passer la main devant votre visage ?" },
  { s: "analyse", t: "Je vérifie le geste…" },
  { s: "signal", t: "Signal à vérifier : l'image s'est déformée pendant le geste." },
  { s: "verifie", t: "Présence humaine vérifiée." },
  { s: "lumiere", t: "Je vais éclairer ton visage quelques secondes." },
];

export function Vitrine() {
  return (
    <div className="surface">
      <h1 style={{ fontSize: 40, fontWeight: 400, letterSpacing: "-0.02em", marginBottom: 24 }}>Manta, six états</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {ETATS.map(({ s, t }) => (
          <div className="card" key={s} style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Manta state={s} size={96} haloColor={s === "lumiere" ? "#3b6cf0" : undefined} />
            <div><div className="pill pill--gris" style={{ marginBottom: 8 }}>{s}</div><p>{t}</p></div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 24 }}><a href="#/">← Dashboard</a></p>
    </div>
  );
}
