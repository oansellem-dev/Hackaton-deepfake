import { useEffect, useState } from "react";

/** Relève les signaux techniques. À envoyer au serveur de score (brique A / D). */
export interface SignauxTechniques { cameras: string[]; fuseau: string; langue: string }

export function Signaux({ stream, onSuivant }: { stream: MediaStream | null; onSuivant: () => void }) {
  const [s, setS] = useState<SignauxTechniques | null>(null);
  useEffect(() => {
    (async () => {
      let cameras: string[] = [];
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        cameras = devs.filter((d) => d.kind === "videoinput").map((d) => d.label || "Caméra (nom non communiqué)");
      } catch { /* pas de périphériques : ce n'est pas un signal */ }
      setS({ cameras, fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone, langue: navigator.language });
    })();
  }, [stream]);

  return (
    <>
      <h1>Voici ce que votre navigateur nous dit</h1>
      <div className="card">
        {s ? (
          <dl className="signaux-tech">
            <div><dt>Caméras déclarées</dt><dd>{s.cameras.length ? s.cameras.join(", ") : "Aucune"}</dd></div>
            <div><dt>Fuseau horaire</dt><dd>{s.fuseau}</dd></div>
            <div><dt>Langue du navigateur</dt><dd>{s.langue}</dd></div>
            <div><dt>Adresse de connexion</dt><dd className="muted" style={{ fontWeight: 400 }}>Relevée côté serveur, non affichée ici</dd></div>
          </dl>
        ) : <p className="muted">Lecture…</p>}
        <div className="card__rule" />
        <p className="muted small">Ces informations servent uniquement à repérer une contradiction avec ce que vous avez déclaré. Un VPN ou un déplacement, ça arrive : le recruteur le saura.</p>
      </div>
      <div className="cand__actions">
        <button className="btn btn--primary" onClick={onSuivant} disabled={!s}>Continuer</button>
      </div>
    </>
  );
}
