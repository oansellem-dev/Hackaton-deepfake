import { useId, useState, type CSSProperties } from "react";
import "./manta.css";

/** Les six états de Manta. Elle ne parle qu'au recruteur et n'accuse jamais. */
export type MantaState = "neutre" | "defi" | "analyse" | "signal" | "verifie" | "lumiere";

interface Props {
  state?: MantaState;
  /** Taille en px. Jamais en dessous de 48. */
  size?: number;
  /** Couleur du halo pour l'état « lumiere » (suit la séquence, jamais un rouge). */
  haloColor?: string;
  className?: string;
  title?: string;
  onClick?: () => void;
}

/** Losange adouci : ailes larges en haut, queue fine en bas. */
const CORPS = "M60 10 C76 10 98 33 107 46 C111 51 111 56 106 62 C94 79 73 97 64 110 C62 113 58 113 56 110 C47 97 26 79 14 62 C9 56 9 51 13 46 C22 33 44 10 60 10 Z";
const ENCRE = "#1b2a5e";

/**
 * Version légère pour la visio : trois calques (corps, halo, visage).
 * Le flottement, le rebond et la pression sont des transform sur des calques HTML
 * (composités) ; aucun filtre SVG n'est recalculé à chaque image.
 */
export function Manta({ state = "neutre", size = 96, haloColor, className = "", title, onClick }: Props) {
  const id = useId().replace(/:/g, "");
  const [presse, setPresse] = useState(false);
  const px = Math.max(48, size);
  const style = { width: px, height: px, ...(haloColor ? { "--halo": haloColor } : {}) } as CSSProperties;
  const rieurs = state === "verifie";
  const presser = () => { setPresse(false); requestAnimationFrame(() => setPresse(true)); window.setTimeout(() => setPresse(false), 600); onClick?.(); };
  const trait = { fill: "none", stroke: ENCRE, strokeLinecap: "round" as const };
  return (
    <span className={`manta${presse ? " is-pressed" : ""} ${className}`} data-state={state} style={style} role="img" aria-label={title ?? "Manta"} onPointerDown={presser}>
      <span className="manta__shadow" />
      <span className="manta__press">
        <span className="manta__float">
          <svg className="manta__body" viewBox="0 0 120 120" aria-hidden>
            <defs>
              <radialGradient id={`${id}n`} cx="42%" cy="26%" r="78%">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset=".3" stopColor="#f8fafe" />
                <stop offset=".7" stopColor="#e6ecf6" />
                <stop offset="1" stopColor="#cfd8ea" />
              </radialGradient>
            </defs>
            <path d={CORPS} fill={`url(#${id}n)`} stroke="rgba(130,146,184,.45)" strokeWidth="1" />
            <path d="M47 22 C53 16 62 15 69 19" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".9" />
          </svg>
          <span className="manta__halo" />
          <svg className="manta__face" viewBox="0 0 120 120" aria-hidden>
            <path className="manta__brow" d="M63.5 30.5 Q69 26.5 75 29.5" {...trait} strokeWidth="2.4" />
            {rieurs ? (
              <>
                <path d="M44 41 Q49 35 54 41" {...trait} strokeWidth="2.8" />
                <path d="M64 41 Q69 35 74 41" {...trait} strokeWidth="2.8" />
              </>
            ) : (
              <g className="manta__eyes">
                <g className="manta__eye"><circle cx="49" cy="40" r="5" fill={ENCRE} /><circle cx="50.8" cy="38.2" r="1.7" fill="#fff" /><circle cx="47.4" cy="42" r=".8" fill="#fff" opacity=".7" /></g>
                <g className="manta__eye"><circle cx="69" cy="40" r="5" fill={ENCRE} /><circle cx="70.8" cy="38.2" r="1.7" fill="#fff" /><circle cx="67.4" cy="42" r=".8" fill="#fff" opacity=".7" /></g>
              </g>
            )}
            <path d="M55 47.5 Q60 51.5 65 47.5" {...trait} strokeWidth="2.2" />
          </svg>
        </span>
      </span>
    </span>
  );
}
