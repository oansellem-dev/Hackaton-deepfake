import { useEffect, useRef, useState } from "react";
import { Manta } from "../../manta/Manta";

/**
 * Test de lumière — réglages imposés par le contexte :
 * 5 couleurs tirées au hasard parmi blanc, bleu, rouge (adouci), vert, noir ;
 * 1 s par couleur, fondu de 0,3 s, jamais de flash ; avertissement et bouton « Passer cette étape ».
 * La mesure (couleur moyenne de la peau, retard) est faite par le moteur vidéo (brique B) :
 * il reçoit `sequence` et les horodatages via `onFin`.
 */
const COULEURS = {
  blanc: { fond: "#ffffff", encre: "#141f3d" },
  bleu: { fond: "#2f5df5", encre: "#ffffff" },
  rouge: { fond: "#d9453f", encre: "#ffffff" }, // rouge adouci, pas le rouge pur
  vert: { fond: "#2eb872", encre: "#141f3d" },
  noir: { fond: "#0a0f1f", encre: "#ffffff" },
} as const;
type Couleur = keyof typeof COULEURS;
const DUREE_MS = 1000;

const tirer = (): Couleur[] => {
  const noms = Object.keys(COULEURS) as Couleur[];
  return [...noms].sort(() => Math.random() - 0.5).slice(0, 5);
};

export interface ResultatLumiere { sequence: Couleur[]; horodatages: number[]; passe: boolean }

export function TestLumiere({ stream, onFin }: { stream: MediaStream | null; onFin: (r: ResultatLumiere) => void }) {
  const [phase, setPhase] = useState<"avert" | "test">("avert");
  const [idx, setIdx] = useState(-1);
  const seq = useRef<Couleur[]>(tirer());
  const stamps = useRef<number[]>([]);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => { if (video.current && stream) video.current.srcObject = stream; }, [stream, phase]);

  useEffect(() => {
    if (phase !== "test") return;
    let i = 0;
    setIdx(0); stamps.current = [performance.now()];
    const t = window.setInterval(() => {
      i += 1;
      if (i >= seq.current.length) {
        window.clearInterval(t);
        window.setTimeout(() => onFin({ sequence: seq.current, horodatages: stamps.current, passe: false }), 600);
        return;
      }
      stamps.current.push(performance.now());
      setIdx(i);
    }, DUREE_MS);
    return () => window.clearInterval(t);
  }, [phase, onFin]);

  if (phase === "avert") {
    return (
      <>
        <div className="card mantacard">
          <Manta state="lumiere" size={72} haloColor="#3b6cf0" />
          <p className="mantacard__text">Je vais éclairer votre visage quelques secondes avec des couleurs douces.</p>
        </div>
        <h1>Test de lumière</h1>
        <div className="card">
          <ul className="liste-check">
            <li><span className="pill pill--bleu">7 s</span>L'écran passe par cinq couleurs, en fondu, sans flash.</li>
            <li><span className="pill pill--bleu">Conseil</span>Approchez-vous de l'écran et montez sa luminosité.</li>
            <li><span className="pill pill--gris">Attention</span>Si les changements de lumière vous gênent, passez cette étape : ça ne compte pas contre vous.</li>
          </ul>
        </div>
        <div className="cand__actions">
          <button className="btn btn--secondary" onClick={() => onFin({ sequence: [], horodatages: [], passe: true })}>Passer cette étape</button>
          <button className="btn btn--primary" onClick={() => setPhase("test")}>Lancer le test</button>
        </div>
      </>
    );
  }

  const c = idx >= 0 ? COULEURS[seq.current[idx]] : COULEURS.blanc;
  return (
    <div className="lumiere" style={{ "--lum": c.fond, "--lum-ink": c.encre } as React.CSSProperties} aria-live="polite">
      <div className="lumiere__ovale">{stream ? <video ref={video} autoPlay muted playsInline /> : <span className="small">Pas de caméra</span>}</div>
      <div className="lumiere__foot">
        <span>Restez face à l'écran… {Math.max(0, seq.current.length - idx)} s</span>
        <button className="btn btn--secondary btn--sm" onClick={() => onFin({ sequence: seq.current, horodatages: stamps.current, passe: true })}>Passer cette étape</button>
      </div>
    </div>
  );
}
