import { useEffect, useRef } from "react";
import "./preloader.css";

/**
 * Rideau d'ouverture (adapté du Words Preloader de Skiper UI / dennissnellenberg.com, sans les mots).
 * Un rideau blanc couvre le dashboard au chargement, puis remonte avec un bord inférieur courbe qui s'aplatit.
 * Toute la chronologie est pilotée par une seule boucle requestAnimationFrame sur l'horloge réelle, avec
 * mise à jour directe du DOM : pas de re-rendu React, donc une cadence stable même si la page charge derrière.
 * Monté à chaque chargement de page ; `onDone` est appelé quand l'animation est finie.
 */
const SORTIE_A_MS = 350;   // instant du départ du rideau (le temps que la page soit rendue derrière)
const COURBE_DELAI = 300;  // la courbe commence à s'aplatir un peu après le départ
const COURBE_MS = 700;     // durée de l'aplatissement
const BOMBE = 300;         // profondeur du bord courbe (px)

/** cubic-bezier(.76, 0, .24, 1) : même courbe d'accélération que l'original. */
function bezier(t: number) {
  const [x1, y1, x2, y2] = [0.76, 0, 0.24, 1];
  const bx = (s: number) => 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3;
  const by = (s: number) => 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s * s * (1 - s) + s ** 3;
  let lo = 0, hi = 1, s = t;
  for (let i = 0; i < 24; i++) { s = (lo + hi) / 2; if (bx(s) < t) lo = s; else hi = s; }
  return by(s);
}

export function Preloader({ onDone }: { onDone: () => void }) {
  const racine = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const [w, h] = [innerWidth, innerHeight];
  const courbe = (k: number) => `M0 0 L${w} 0 L${w} ${h} Q${w / 2} ${h + BOMBE * (1 - k)} 0 ${h} L0 0`;

  useEffect(() => {
    const t0 = performance.now();
    let raf = 0, fini = false;
    const tick = (now: number) => {
      const t = now - t0;
      // Départ du rideau (animation CSS), puis aplatissement de la courbe
      if (t >= SORTIE_A_MS) racine.current?.classList.add("preloader--sortie");
      const k = (t - SORTIE_A_MS - COURBE_DELAI) / COURBE_MS;
      if (k >= 0) path.current?.setAttribute("d", courbe(bezier(Math.min(1, k))));
      if (k >= 1) { fini = true; onDone(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (!fini) cancelAnimationFrame(raf); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={racine} className="preloader" aria-hidden>
      <svg className="preloader__svg" viewBox={`0 0 ${w} ${h + BOMBE}`} preserveAspectRatio="none">
        <path ref={path} d={courbe(0)} />
      </svg>
    </div>
  );
}
