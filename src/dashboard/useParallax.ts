import { useEffect } from "react";

/** Déplace légèrement les éléments [data-depth] selon la souris. Coupé si prefers-reduced-motion. */
export function useParallax() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, mx = 0, my = 0;
    const els = () => Array.from(document.querySelectorAll<HTMLElement>("[data-depth]"));
    const onMove = (e: MouseEvent) => {
      mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => els().forEach((el) => { const d = Number(el.dataset.depth); el.style.transform = `translate3d(${mx * d}px, ${my * d}px, 0)`; }));
    };
    addEventListener("mousemove", onMove);
    return () => { removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);
}
