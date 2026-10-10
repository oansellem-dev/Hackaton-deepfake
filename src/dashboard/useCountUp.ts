import { useEffect, useState } from "react";

/** Fait monter un nombre de 0 à `cible` en ~900 ms (respecte prefers-reduced-motion). */
export function useCountUp(cible: number, duree = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(cible); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duree);
      setV(Math.round(cible * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cible, duree]);
  return v;
}
