import type { CSSProperties } from "react";
import { BotAvatar } from "bot-avatars";

/** Les six états de Manta. Elle ne parle qu'au recruteur et n'accuse jamais. */
export type MantaState = "neutre" | "defi" | "analyse" | "signal" | "verifie" | "lumiere";

interface Props {
  state?: MantaState;
  /** Taille en px. Jamais en dessous de 48. */
  size?: number;
  /** Couleur du corps pour l'état « lumiere » (suit la séquence, jamais un rouge). */
  haloColor?: string;
  className?: string;
  title?: string;
  onClick?: () => void;
}

/**
 * Manta = avatar « ghost » de bot-avatars, animé en continu (canvas 2D, aucun WebGL, prefers-reduced-motion respecté).
 * Les six états d'Oval se traduisent en état de l'avatar et en couleur du corps : jamais de rouge, le signal est doré.
 */
const ETATS: Record<MantaState, { state: "default" | "working" | "sleeping"; color?: string; face?: "mouth" }> = {
  neutre: { state: "default" },
  defi: { state: "default", face: "mouth" },
  analyse: { state: "working" },
  signal: { state: "default", color: "#f0b43c" },
  verifie: { state: "working", color: "#4cc792", face: "mouth" },
  lumiere: { state: "default" },
};

export function Manta({ state = "neutre", size = 96, haloColor, className = "", title, onClick }: Props) {
  const px = Math.max(48, size);
  const e = ETATS[state];
  const style: CSSProperties = { width: px, height: px, display: "inline-block", lineHeight: 0, cursor: onClick ? "pointer" : undefined };
  return (
    <span className={`manta ${className}`} data-state={state} style={style} role="img" aria-label={title ?? "Manta"} onClick={onClick}>
      <BotAvatar type="ghost" size={px} state={e.state} face={e.face} color={state === "lumiere" ? haloColor : e.color} />
    </span>
  );
}
