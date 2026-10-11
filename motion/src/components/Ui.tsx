import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { bounce, ease, io, smooth } from './anim';

/* ── Charte Oval ── */
export const C = {
  bg: '#f3f5f9', card: '#fbfbfd', ink: '#1b2032', ink2: '#46506b', ink3: '#5e6880',
  blue: '#3463ea', blueText: '#1f45b8', blueSoft: '#e3ebff', green: '#4cc792', greenText: '#0f6b45', greenSoft: '#dcf5e9',
  gold: '#f0b63f', goldText: '#5c3a00', goldSoft: '#fdf0c6', red: '#e2574c', navy: '#1b2032', navy2: '#252c44',
};
export const FONT = "'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
export const LOGO = 'M120 4A116 116 0 0 1 208.9 194.6C192.8 213.8 154 218 154 240C154 262 192.8 266.2 208.9 285.4A116 116 0 0 1 120 476A116 116 0 0 1 31.1 285.4C47.2 266.2 86 262 86 240C86 218 47.2 213.8 31.1 194.6A116 116 0 0 1 120 4Z';
export const SHADOW = '0 24px 64px rgba(62,74,110,.18), 0 2px 6px rgba(62,74,110,.08)';

export const Logo = ({ size = 48, color = C.ink }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 240 480" width={size / 2} height={size} style={{ display: 'block' }}><path d={LOGO} fill={color} /></svg>
);

export const Card = ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: C.card, borderRadius: 28, boxShadow: SHADOW, padding: 36, ...style }}>{children}</div>
);

export const Pill = ({ children, tone = 'neutral', style }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'green' | 'gold' | 'dark' | 'red'; style?: CSSProperties }) => {
  const t = { neutral: ['#e8ebf2', C.ink2], blue: [C.blueSoft, C.blueText], green: [C.greenSoft, C.greenText], gold: [C.goldSoft, C.goldText], dark: [C.ink, '#fff'], red: ['#fde3e0', '#8a2a22'] }[tone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: t[0], color: t[1], fontWeight: 700, fontSize: 26, padding: '10px 22px', borderRadius: 999, ...style }}>{children}</span>;
};

/** Fenêtre de navigateur façon Oval autour d'une capture du produit, avec recadrage animé (pan / zoom). */
export const Browser = ({ src, url, x = 0, y = 0, zoom = 1, style, width = 1500 }: { src: string; url?: string; x?: number; y?: number; zoom?: number; style?: CSSProperties; width?: number }) => {
  const h = (width * 1080) / 1920;
  return (
    <div style={{ width, borderRadius: 28, overflow: 'hidden', boxShadow: SHADOW, background: '#fff', ...style }}>
      <div style={{ height: 46, background: '#e8ebf2', display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px' }}>
        {['#e2574c', '#f0b63f', '#4cc792'].map((c) => <i key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
        {url && <span style={{ marginLeft: 16, fontFamily: MONO, fontSize: 15, color: C.ink3, background: '#fff', padding: '4px 14px', borderRadius: 999 }}>{url}</span>}
      </div>
      <div style={{ width, height: h, overflow: 'hidden', position: 'relative' }}>
        <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width, height: h, transform: `translate(${-x}px, ${-y}px) scale(${zoom})`, transformOrigin: `${x}px ${y}px` }} />
      </div>
    </div>
  );
};

/** Ovale de cadrage animé (tracé qui se dessine, puis respire). */
export const OvalScan = ({ progress = 1, size = 520, color = C.blue }: { progress?: number; size?: number; color?: string }) => {
  const len = 1500;
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 400 520" style={{ display: 'block' }}>
      <ellipse cx="200" cy="260" rx="170" ry="230" fill="none" stroke="rgba(27,32,50,.08)" strokeWidth="6" />
      <ellipse cx="200" cy="260" rx="170" ry="230" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - progress)} transform="rotate(-90 200 260)" />
    </svg>
  );
};

/** Jauge circulaire 0–100 : indice de fiabilité. */
export const Gauge = ({ value, size = 260, tone = C.blue, label }: { value: number; size?: number; tone?: string; label?: string }) => {
  const r = 44, c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(27,32,50,.08)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={tone} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div><div style={{ fontSize: size * 0.3, fontWeight: 800, letterSpacing: -3, color: C.ink, lineHeight: 1 }}>{Math.round(value)}</div>{label && <div style={{ fontSize: 22, color: C.ink3, fontWeight: 600, marginTop: 6 }}>{label}</div>}</div>
      </div>
    </div>
  );
};

/** Mascotte Manta, simplifiée (silhouette fantôme), avec une bulle. */
export const Manta = ({ size = 120, say, frame = 0 }: { size?: number; say?: string; frame?: number }) => {
  const bob = Math.sin(frame / 14) * 6;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={size} height={size * 1.1} viewBox="0 0 100 110" style={{ transform: `translateY(${bob}px)`, filter: 'drop-shadow(0 16px 24px rgba(62,74,110,.25))' }}>
        <defs><linearGradient id="mg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#cfd6e6" /></linearGradient></defs>
        <path d="M50 4C24 4 10 26 10 52v44c0 6 6 8 10 4l6-6 8 8c3 3 7 3 10 0l6-6 6 6c3 3 7 3 10 0l8-8 6 6c4 4 10 2 10-4V52C90 26 76 4 50 4z" fill="url(#mg)" />
        <circle cx="36" cy="46" r="6" fill={C.ink} /><circle cx="64" cy="46" r="6" fill={C.ink} />
      </svg>
      {say && <div style={{ background: C.blueSoft, color: C.ink, fontSize: 28, fontWeight: 600, padding: '18px 26px', borderRadius: 24, borderTopLeftRadius: 6, maxWidth: 560, lineHeight: 1.3 }}>{say}</div>}
    </div>
  );
};

/* ── Le motif des murs : mur → fissure → porte ── */
/**
 * WallBreak : un mur plein porte un titre ; une fissure se dessine, puis le mur s'ouvre en deux battants
 * (porte) et révèle le contenu derrière. Mêmes timings pour les 4 murs, `openDur` diminue un peu à chaque mur.
 *  - 0 → 0.5 s : le mur arrive (glisse du bas)
 *  - 0.5 → 2.2 s : titre + fissure qui se trace
 *  - à `openAt` : ouverture en `openDur` s
 */
export const WallBreak = ({ frame, title, icon, openAt, openDur = 1.2, children }: { frame: number; title: string; icon?: ReactNode; openAt: number; openDur?: number; children?: ReactNode }) => {
  const arrive = smooth(frame);
  const crack = io(frame, 18, 60, 0, 1, ease.out);
  const open = io(frame, openAt, openAt + openDur * 30, 0, 1, ease.inOut);
  const shake = frame > openAt - 6 && frame < openAt ? Math.sin(frame * 3) * 4 : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: io(frame, openAt + 6, openAt + openDur * 30, 0, 1) }}>{children}</AbsoluteFill>
      {/* battant gauche */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', background: C.navy, transformOrigin: 'left center', transform: `translateY(${(1 - arrive) * 120}px) translateX(${shake}px) perspective(2400px) rotateY(${open * -100}deg)`, boxShadow: '12px 0 48px rgba(0,0,0,.35)' }} />
      {/* battant droit */}
      <div style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', background: C.navy, transformOrigin: 'right center', transform: `translateY(${(1 - arrive) * 120}px) translateX(${-shake}px) perspective(2400px) rotateY(${open * 100}deg)`, boxShadow: '-12px 0 48px rgba(0,0,0,.35)' }} />
      {/* fissure */}
      <svg viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 1 - open, pointerEvents: 'none' }}>
        <path d="M960 0 L950 140 L985 260 L940 420 L975 540 L930 700 L970 860 L950 1080" fill="none" stroke={C.gold} strokeWidth="6" strokeLinecap="round" strokeDasharray="1400" strokeDashoffset={1400 * (1 - crack)} style={{ filter: 'drop-shadow(0 0 18px rgba(240,182,63,.9))' }} />
      </svg>
      {/* titre du mur */}
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: Math.min(io(frame, 10, 24), 1 - open * 1.6), transform: `scale(${1 + open * 0.3})` }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, color: '#fff', textAlign: 'center' }}>
          {icon}
          <div style={{ fontSize: 30, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: 6 }}>Mur</div>
          <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, maxWidth: 1300 }}>{title}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Compteur animé (rebond au changement). */
export const Counter = ({ frame, at, from, to }: { frame: number; at: number; from: number; to: number }) => {
  const b = bounce(frame, 30, at);
  return <span style={{ display: 'inline-block', transform: `scale(${frame >= at ? 1 + (1 - Math.min(1, b)) * 0.5 : 1})` }}>{frame >= at ? to : from}</span>;
};

export const useFrame = useCurrentFrame;
