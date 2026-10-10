import "./manta.css";

/** Les six états de Manta. Elle ne parle qu'au recruteur et n'accuse jamais. */
export type MantaState = "neutre" | "defi" | "analyse" | "signal" | "verifie" | "lumiere";

interface Props {
  state?: MantaState;
  /** Taille en px. Jamais en dessous de 48 dans le panneau. */
  size?: number;
  /** Couleur du halo pour l'état "lumiere" (suit la séquence du test). */
  haloColor?: string;
  className?: string;
  title?: string;
}

export function Manta({ state = "neutre", size = 64, haloColor, className = "", title }: Props) {
  const style = haloColor ? ({ "--manta-halo": haloColor } as React.CSSProperties) : undefined;
  const rieurs = state === "verifie";
  return (
    <svg
      className={`manta ${className}`}
      data-state={state}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      style={style}
      role="img"
      aria-label={title ?? "Manta"}
    >
      <defs>
        <linearGradient id="manta-nacre" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe5f8" />
        </linearGradient>
      </defs>

      {/* halo sous le visage */}
      <ellipse className="manta__glow" cx="60" cy="86" rx="40" ry="14" />
      <ellipse className="manta__halo" cx="60" cy="88" rx="30" ry="7" />

      <g className="manta__body">
        {/* corps : ailes larges, queue fine */}
        <path
          d="M60 30 C78 29 98 37 114 50 C98 55 83 60 72 66 C67 74 63 84 60 96 C57 84 53 74 48 66 C37 60 22 55 6 50 C22 37 42 29 60 30 Z"
          fill="url(#manta-nacre)"
          stroke="#b7c2e4"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* lobes céphaliques */}
        <path d="M50 33 C47 26 52 22 55 29" fill="none" stroke="#b7c2e4" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M70 33 C73 26 68 22 65 29" fill="none" stroke="#b7c2e4" strokeWidth="1.5" strokeLinecap="round" />

        {/* sourcil (état signal) */}
        <path className="manta__brow" d="M64 38 L74 41" stroke="#141f3d" strokeWidth="2.4" strokeLinecap="round" />

        {/* yeux */}
        {rieurs ? (
          <g>
            <path d="M45 50 Q50 44 55 50" fill="none" stroke="#141f3d" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M65 50 Q70 44 75 50" fill="none" stroke="#141f3d" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        ) : (
          <g className="manta__pupils">
            <g className="manta__eye">
              <circle cx="50" cy="48" r="3.6" fill="#141f3d" />
              <circle cx="51.3" cy="46.7" r="1.1" fill="#fff" />
            </g>
            <g className="manta__eye">
              <circle cx="70" cy="48" r="3.6" fill="#141f3d" />
              <circle cx="71.3" cy="46.7" r="1.1" fill="#fff" />
            </g>
          </g>
        )}

        {/* sourire fin */}
        <path d="M53 57 Q60 62 67 57" fill="none" stroke="#141f3d" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
