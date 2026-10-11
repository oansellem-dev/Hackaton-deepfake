/**
 * Micro-interactions globales, posées une fois sur le document (délégation d'événements).
 * Inspirées de Magnetic et Spotlight (21st.dev / ibelick, kevingirelli), Ripple Buttons et Shimmer Button.
 *  - ondulation douce au clic sur tout ce qui se presse ;
 *  - aimantation : les icônes rondes et les boutons principaux suivent le curseur par interpolation (rAF), sans transition CSS ;
 * Rien ne tourne si l'utilisateur a demandé moins d'animations.
 */
import "./effets.css";

const PRESSABLE = ".btn, .icirc, .rail__item, .tabs__tab, .bar, .bcard, .plan__who, .tbl__row, .menu__item, .bacc__tete, .auj__card, .switch, .depli__btn";
const AIMANT = ".rail__item, .icirc, .btn--primary, .btn--now";
const FORCE = 0.28;      // part du décalage souris → élément
const LISSAGE = 0.18;    // interpolation par image (plus petit = plus doux)

let installe = false;
export function installerEffets() {
  if (installe || typeof document === "undefined") return;
  installe = true;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* ── Ondulation ── */
  document.addEventListener("pointerdown", (e) => {
    const hote = (e.target as Element).closest<HTMLElement>(PRESSABLE);
    if (!hote || e.button !== 0) return;
    const r = hote.getBoundingClientRect();
    const taille = Math.hypot(r.width, r.height) * 1.6;
    const enveloppe = document.createElement("span");
    enveloppe.className = "fx-ripple";
    const onde = document.createElement("i");
    onde.style.width = onde.style.height = `${taille}px`;
    onde.style.left = `${e.clientX - r.left - taille / 2}px`;
    onde.style.top = `${e.clientY - r.top - taille / 2}px`;
    enveloppe.appendChild(onde);
    hote.appendChild(enveloppe);
    onde.addEventListener("animationend", () => enveloppe.remove(), { once: true });
  }, { passive: true });

  /* ── Aimantation, pilotée par une boucle rAF ── */
  let souris = { x: 0, y: 0 };
  let aimant: { el: HTMLElement; cx: number; cy: number; x: number; y: number } | null = null;
  let raf = 0;

  const boucle = () => {
    raf = 0;
    let encore = false;
    if (aimant) {
      const tx = (souris.x - aimant.cx) * FORCE, ty = (souris.y - aimant.cy) * FORCE;
      aimant.x += (tx - aimant.x) * LISSAGE; aimant.y += (ty - aimant.y) * LISSAGE;
      aimant.el.style.translate = `${aimant.x.toFixed(2)}px ${aimant.y.toFixed(2)}px`;
      if (Math.abs(tx - aimant.x) > 0.05 || Math.abs(ty - aimant.y) > 0.05) encore = true;
    }
    if (encore) raf = requestAnimationFrame(boucle);
  };
  const demander = () => { if (!raf) raf = requestAnimationFrame(boucle); };

  const relacherAimant = () => {
    if (!aimant) return;
    const el = aimant.el; aimant = null;
    el.classList.add("fx-retour");                 // transition CSS seulement pour le retour
    el.style.translate = "0px 0px";
    el.addEventListener("transitionend", () => el.classList.remove("fx-retour"), { once: true });
  };

  document.addEventListener("pointermove", (e) => {
    souris = { x: e.clientX, y: e.clientY };
    const cible = e.target as Element;
    const a = cible.closest<HTMLElement>(AIMANT);
    if (a !== aimant?.el) {
      relacherAimant();
      if (a) { const r = a.getBoundingClientRect(); a.classList.remove("fx-retour"); aimant = { el: a, cx: r.left + r.width / 2, cy: r.top + r.height / 2, x: 0, y: 0 }; }
    }
    demander();
  }, { passive: true });
  document.addEventListener("pointerleave", relacherAimant);
  addEventListener("scroll", relacherAimant, { passive: true, capture: true });
}
