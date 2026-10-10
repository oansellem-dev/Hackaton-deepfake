import { useEffect, useState, type FormEvent } from "react";
import type { Entretien } from "../shared/types";
import { envoyerLien, getEntretiens } from "../shared/api";
import { PREVERIF_STATUTS } from "../shared/texts";
import { quand } from "../shared/format";

export function EnvoiLien() {
  const [liste, setListe] = useState<Entretien[]>([]);
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [poste, setPoste] = useState("Développeur full-stack · Tech");
  const [toast, setToast] = useState<string | null>(null);
  const [lien, setLien] = useState<string | null>(null);

  const charger = () => getEntretiens().then(setListe);
  useEffect(() => { charger(); }, []);

  const envoyer = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = await envoyerLien(email, date ? new Date(date).toISOString() : new Date().toISOString(), poste);
    setLien(`${location.origin}/#/candidat/${e.id}`);
    setToast(`Lien envoyé à ${email}. Valable une fois, jusqu'à l'entretien.`);
    setEmail(""); setDate("");
    charger();
    window.setTimeout(() => setToast(null), 4000);
  };

  return (
    <>
      <header className="hero rise"><h1 className="hero__hi">Pré-vérifications</h1><div className="hero__center">Un contrôle technique de deux minutes</div><div /></header>
      <div className="rapport">
        <div className="col">
          <form className="card form rise" onSubmit={envoyer}>
            <h2 className="card__title">Envoyer un lien</h2>
            <div className="field"><label htmlFor="email">E-mail du candidat</label><input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@exemple.fr" /></div>
            <div className="field"><label htmlFor="date">Date de l'entretien</label><input id="date" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label htmlFor="poste">Poste</label>
              <select id="poste" value={poste} onChange={(e) => setPoste(e.target.value)}>
                <option>Développeur full-stack · Tech</option><option>Développeur back-end · Tech</option><option>Data analyst · Produit</option><option>Chef de projet · Produit</option>
              </select>
            </div>
            <button className="btn btn--primary" type="submit">Envoyer</button>
            {lien && <p className="small muted">Pour la démo, le lien s'ouvre ici : <a href={lien} target="_blank" rel="noreferrer">page candidat</a></p>}
          </form>
        </div>
        <div className="card rise">
          <h2 className="card__title">Liens envoyés</h2>
          <div className="card__rule" />
          <table className="table">
            <thead><tr><th>Candidat</th><th>Entretien</th><th>Pré-vérification</th><th>Résumé</th></tr></thead>
            <tbody>
              {liste.filter((e) => e.statut !== "termine").map((e) => {
                const n = e.preVerification.signaux.length;
                const st = e.preVerification.statut;
                return (
                  <tr key={e.id}>
                    <td>{e.candidat.prenom ? `${e.candidat.prenom} ${e.candidat.nom}` : e.candidat.email}</td>
                    <td className="muted">{quand(e.date)}</td>
                    <td><span className={`pill ${st === "faite" ? "pill--jaune" : "pill--gris"}`}>{PREVERIF_STATUTS[st]}</span></td>
                    <td>{st !== "faite" ? <span className="muted">Pas d'information, ce n'est pas un signal</span> : n === 0 ? <span className="pill pill--vert">Rien à signaler</span> : <span className="pill pill--rouge">{n} point{n > 1 ? "s" : ""} à vérifier pendant l'entretien</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
