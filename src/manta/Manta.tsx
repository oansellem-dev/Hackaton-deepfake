import { useId, useState, type CSSProperties } from "react";
import "./manta.css";

/** Les six états de Manta. Elle ne parle qu'au recruteur et n'accuse jamais. */
export type MantaState = "neutre" | "defi" | "analyse" | "signal" | "verifie" | "lumiere";

interface Props {
  state?: MantaState;
  /** Taille en px. Jamais en dessous de 48. */
  size?: number;
  /** Couleur du halo pour l'état "lumiere" (suit la séquence du test). */
  haloColor?: string;
  className?: string;
  title?: string;
  onClick?: () => void;
}

export function Manta({ state = "neutre", size = 96, haloColor, className = "", title, onClick }: Props) {
  const id = useId().replace(/:/g, "");
  const [pressed, setPressed] = useState(false);
  const px = Math.max(48, size);
  const style = haloColor ? ({ "--halo": haloColor } as CSSProperties) : undefined;
  const rieurs = state === "verifie";
  const presser = () => { setPressed(true); window.setTimeout(() => setPressed(false), 600); onClick?.(); };
  return (
    <svg
      className={`manta ${pressed ? "is-pressed" : ""} ${className}`}
      data-state={state}
      width={px} height={px} viewBox="0 0 120 120"
      style={style}
      role="img" aria-label={title ?? "Manta"}
      onPointerDown={presser}
    >
      <defs>
        <radialGradient id={`${id}-nacre`} cx="40%" cy="30%" r="72%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".45" stopColor="#fbfcff" />
          <stop offset=".8" stopColor="#e9edf8" />
          <stop offset="1" stopColor="#d4dbec" />
        </radialGradient>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--halo)" stopOpacity="1" />
          <stop offset="1" stopColor="var(--halo)" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation=".9" result="b" />
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3e4a6e" floodOpacity=".22" />
        </filter>
        <filter id={`${id}-blur`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6.5" /></filter>
        <filter id={`${id}-blur-sm`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4" /></filter>
        <filter id={`${id}-blur-lg`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>

      {/* ombre floue au sol */}
      <ellipse className="manta__shadow" cx="60" cy="110" rx="26" ry="5" fill="#3e4a6e" opacity=".45" filter={`url(#${id}-blur-lg)`} />

      <g className="manta__scene">
        {/* halo de couleur derrière le corps (état lumière) */}
        <ellipse className="manta__glow" cx="60" cy="62" rx="44" ry="40" fill={`url(#${id}-halo)`} opacity="0" />

        <g className="manta__body">
          {/* corps : losange adouci, bords fondus */}
          <path
            d="M60 8 C71 8 92 34 105 50 C110 57 110 63 105 70 C92 86 71 112 60 112 C49 112 28 86 15 70 C10 63 10 57 15 50 C28 34 49 8 60 8 Z"
            fill={`url(#${id}-nacre)`} filter={`url(#${id}-soft)`}
          />
          {/* ombrage interne des bords (relief doux) */}
          <path
            d="M60 8 C71 8 92 34 105 50 C110 57 110 63 105 70 C92 86 71 112 60 112 C49 112 28 86 15 70 C10 63 10 57 15 50 C28 34 49 8 60 8 Z"
            fill="none" stroke="#c9d1e6" strokeWidth="1.2" opacity=".7" filter={`url(#${id}-blur-sm)`}
          />
          {/* reflet nacré */}
          <path d="M52 22 C58 16 66 18 72 26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".8" />

          {/* halo de couleur flou sous le visage */}
          <ellipse className="manta__halo" cx="60" cy="77" rx="21" ry="14" filter={`url(#${id}-blur)`} />

          {/* sourcil (état signal) */}
          <path className="manta__brow" d="M65 38 L75.5 41.5" stroke="#1b2a5e" strokeWidth="2.6" strokeLinecap="round" />

          {/* yeux bleu nuit brillants */}
          {rieurs ? (
            <g>
              <path d="M43 51 Q49 44 55 51" fill="none" stroke="#1b2a5e" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M65 51 Q71 44 77 51" fill="none" stroke="#1b2a5e" strokeWidth="2.8" strokeLinecap="round" />
            </g>
          ) : (
            <g className="manta__pupils">
              <g className="manta__eye">
                <circle cx="49" cy="50" r="5.2" fill="#1b2a5e" />
                <circle cx="50.8" cy="48.2" r="1.7" fill="#fff" />
                <circle cx="47.2" cy="52.2" r=".9" fill="#fff" opacity=".7" />
              </g>
              <g className="manta__eye">
                <circle cx="71" cy="50" r="5.2" fill="#1b2a5e" />
                <circle cx="72.8" cy="48.2" r="1.7" fill="#fff" />
                <circle cx="69.2" cy="52.2" r=".9" fill="#fff" opacity=".7" />
              </g>
            </g>
          )}

          {/* sourire fin */}
          <path d="M54 61 Q60 66.5 66 61" fill="none" stroke="#1b2a5e" strokeWidth="2.3" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
