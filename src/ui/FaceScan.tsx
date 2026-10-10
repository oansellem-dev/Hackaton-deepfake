import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { IcHand } from "./icons";
import "./facescan.css";

/**
 * Cadre Oval : l'ovale de scan affiché autour du visage.
 * Graduations qui s'allument, balayage, grille, orbite et repères d'angle.
 * Tout bouge en transform/opacity (léger pendant une visio). Aucune image n'est enregistrée.
 */
export type ScanEtat = "idle" | "scan" | "geste" | "ok" | "signal" | "lumiere" | "off";
const N = 72;
const TEINTES: Record<ScanEtat, string> = { idle: "#6f9bff", scan: "#56d0f5", geste: "#56d0f5", ok: "#4cd69a", signal: "#f5be4c", lumiere: "#ffffff", off: "#8a93a8" };

interface Props {
  stream?: MediaStream | null;
  etat?: ScanEtat;
  /** Couleur de l'anneau (sinon : couleur de l'état). */
  couleur?: string;
  /** 0 à 1 : nombre de graduations allumées (test de lumière). */
  progression?: number;
  largeur?: number | string;
  badge?: ReactNode;
  /** Couleur des repères (blanc sur fond sombre, encre sur fond clair). */
  hud?: string;
  miroir?: boolean;
}

export function FaceScan({ stream, etat = "idle", couleur, progression, largeur = 280, badge, hud = "#ffffff", miroir = true }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (video.current) video.current.srcObject = stream ?? null; }, [stream]);
  const graduations = useMemo(() => {
    const cx = 150, cy = 200, rx = 163, ry = 215;
    return Array.from({ length: N }, (_, i) => {
      const t = (i / N) * Math.PI * 2 - Math.PI / 2;
      const x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t);
      let nx = Math.cos(t) / rx, ny = Math.sin(t) / ry;
      const l = Math.hypot(nx, ny); nx /= l; ny /= l;
      const majeure = i % 6 === 0, long = majeure ? 15 : 8;
      return { x1: x, y1: y, x2: x + nx * long, y2: y + ny * long, majeure };
    });
  }, []);
  const allumees = progression === undefined ? -1 : Math.round(progression * N);
  const style = { width: largeur, "--c": couleur ?? TEINTES[etat], "--hud": hud } as CSSProperties;
  return (
    <div className={`scan scan--${etat}`} style={style}>
      <div className="scan__glow" />
      <div className="scan__frame">
        {stream ? <video ref={video} autoPlay muted playsInline className={miroir ? "scan__video scan__video--miroir" : "scan__video"} /> : <Silhouette />}
        <div className="scan__vignette" />
        <div className="scan__grid" />
        <div className="scan__band" />
        {etat === "geste" && <div className="scan__hand"><IcHand /></div>}
      </div>
      <svg className="scan__ticks" viewBox="0 0 300 400" aria-hidden>
        {graduations.map((g, i) => <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} className={`${g.majeure ? "maj" : ""}${i < allumees ? " on" : ""}`} style={{ "--k": i } as CSSProperties} />)}
      </svg>
      <div className="scan__orbit" aria-hidden><div className="scan__orbitIn"><i /></div></div>
      <span className="scan__c scan__c--tl" /><span className="scan__c scan__c--tr" /><span className="scan__c scan__c--bl" /><span className="scan__c scan__c--br" />
      {badge && <div className="scan__badge" role="status">{badge}</div>}
    </div>
  );
}

function Silhouette() {
  return (
    <svg className="scan__ph" viewBox="0 0 300 400" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="scan-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b4668" /><stop offset="1" stopColor="#1a2036" /></linearGradient>
      </defs>
      <ellipse cx="150" cy="168" rx="58" ry="70" fill="url(#scan-sil)" />
      <path d="M38 400 C46 304 92 262 150 262 C208 262 254 304 262 400 Z" fill="url(#scan-sil)" />
    </svg>
  );
}
