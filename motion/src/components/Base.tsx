import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { bounce, ease, io, kf, smooth } from './anim';
import { C, Counter, FONT, Logo, MONO } from './Ui';

/** Fond de scène Oval : clair par défaut, sombre pour les murs et les passages graves. */
export const Scene = ({ children, dark = false, fade = 12, style }: { children: ReactNode; dark?: boolean; fade?: number; style?: CSSProperties }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: dark ? C.navy : C.bg, color: dark ? '#f3f5f9' : C.ink, fontFamily: FONT, opacity: kf(frame, durationInFrames, fade, fade), ...style }}>
      {children}
    </AbsoluteFill>
  );
};

export const STEPS = ['Lien', 'Infos', 'Visage', 'Visio', 'Rapport'] as const;

/** Rail de progression en haut de l'écran + compteur de murs franchis. */
export const Rail = ({ active, walls, wallAt, dark = false, y = 0 }: { active: number; walls: number; wallAt?: number; dark?: boolean; y?: number }) => {
  const frame = useCurrentFrame();
  const fg = dark ? '#f3f5f9' : C.ink, dim = dark ? 'rgba(243,245,249,.45)' : C.ink3, track = dark ? 'rgba(255,255,255,.14)' : 'rgba(27,32,50,.1)';
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 40 + y, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 96px', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><Logo size={36} color={fg} /><span style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: fg }}>Oval</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 120, height: 6, borderRadius: 3, background: i < active ? C.green : i === active ? C.blue : track }} />
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: i === active ? fg : dim }}>{s}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 20, fontWeight: 700, color: fg, background: dark ? 'rgba(255,255,255,.08)' : '#fff', padding: '10px 20px', borderRadius: 999, boxShadow: dark ? 'none' : '0 6px 18px rgba(62,74,110,.12)' }}>
        <span style={{ color: dim, fontWeight: 600 }}>Murs franchis</span>
        <span style={{ fontFamily: MONO, fontSize: 22 }}>{wallAt !== undefined ? <Counter frame={frame} at={wallAt} from={walls - 1} to={walls} /> : walls}/4</span>
      </div>
    </div>
  );
};

/** Titre cinétique : mots qui montent un à un. */
export const KineticTitle = ({ text, size = 84, delay = 0, color, align = 'left', width = 1400, weight = 800 }: { text: string; size?: number; delay?: number; color?: string; align?: 'left' | 'center'; width?: number; weight?: number }) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: `0 ${size * 0.28}px`, width, fontSize: size, fontWeight: weight, letterSpacing: -size * 0.03, lineHeight: 1.08, color }}>
      {words.map((w, i) => {
        const p = smooth(frame, 30, delay + i * 3);
        return <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>{w}</span>;
      })}
    </div>
  );
};

/** Note technique : petite, en mono, pour prouver sans voler la vedette. */
export const TechNote = ({ children, delay = 0, dark = false, style }: { children: ReactNode; delay?: number; dark?: boolean; style?: CSSProperties }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ fontFamily: MONO, fontSize: 21, color: dark ? 'rgba(243,245,249,.7)' : C.ink3, background: dark ? 'rgba(255,255,255,.08)' : 'rgba(27,32,50,.06)', padding: '10px 18px', borderRadius: 12, display: 'inline-block', opacity: io(frame, delay, delay + 12), ...style }}>{children}</div>
  );
};

/** Mention « Illustration » ou « Reconstitution ». */
export const Badge = ({ text, dark = false, pos = 'br' }: { text: string; dark?: boolean; pos?: 'br' | 'tr' | 'bl' }) => (
  <div style={{ position: 'absolute', ...(pos === 'br' ? { right: 96, bottom: 48 } : pos === 'tr' ? { right: 96, top: 120 } : { left: 96, bottom: 48 }), fontFamily: MONO, fontSize: 20, letterSpacing: 2, textTransform: 'uppercase', color: dark ? 'rgba(243,245,249,.6)' : C.ink3, border: `1px solid ${dark ? 'rgba(243,245,249,.3)' : 'rgba(27,32,50,.2)'}`, padding: '8px 14px', borderRadius: 999 }}>{text}</div>
);

/** Apparition douce d'un bloc (fondu + montée). */
export const Rise = ({ children, delay = 0, style, from = 32 }: { children: ReactNode; delay?: number; style?: CSSProperties; from?: number }) => {
  const frame = useCurrentFrame();
  const p = smooth(frame, 30, delay);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * from}px)`, ...style }}>{children}</div>;
};

/** Apparition rebondie (pastilles, coches). */
export const Pop = ({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) => {
  const frame = useCurrentFrame();
  const p = frame < delay ? 0 : bounce(frame, 30, delay);
  return <div style={{ opacity: Math.min(1, p * 1.5), transform: `scale(${p})`, ...style }}>{children}</div>;
};

/** Texte de narration en bas de scène (≤ 12 mots), affiché au moins 3 s. */
export const Caption = ({ text, at = 0, dark = false, big = false }: { text: string; at?: number; dark?: boolean; big?: boolean }) => {
  const frame = useCurrentFrame();
  const p = io(frame, at, at + 14, 0, 1, ease.out);
  return (
    <div style={{ position: 'absolute', left: 96, right: 96, bottom: 72, display: 'flex', justifyContent: 'center', opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
      <div style={{ fontSize: big ? 52 : 40, fontWeight: 700, letterSpacing: -1, textAlign: 'center', maxWidth: 1500, lineHeight: 1.25, color: dark ? '#f3f5f9' : C.ink }}>{text}</div>
    </div>
  );
};
