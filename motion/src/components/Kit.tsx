/**
 * Kit V4 — la direction artistique « mockups qui flottent » : fond gris clair, ordinateur qui s'ouvre, cartes
 * d'interface en relief, mots qui claquent un à un, aplats de couleur qui balaient l'écran, et un bruitage par geste.
 */
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { bounce, ease, io, smooth } from './anim';
import { C, FONT, LOGO, MONO } from './Ui';

export const BG = '#eef0f5';
export const SHADOW_DEEP = '0 40px 90px rgba(27,32,50,.22), 0 8px 20px rgba(27,32,50,.10)';

/* ── Bruitage : un fichier WAV, lancé à `at` (image relative à la scène) ── */
export type SfxName = 'click' | 'tick' | 'pop' | 'whoosh' | 'thud' | 'ding' | 'crack' | 'glitch' | 'door';
export const Sfx = ({ name, at, volume = 1 }: { name: SfxName; at: number; volume?: number }) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={40} layout="none">
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);

/* ── Mots cinétiques : chaque mot claque avec un tic ── */
export const Words = ({ text, start = 0, step = 4, size = 96, color = C.ink, accent, accentColor = C.blue, width = 1500, align = 'center', weight = 800, sfx = true, out }: {
  text: string; start?: number; step?: number; size?: number; color?: string; accent?: string[]; accentColor?: string; width?: number; align?: 'left' | 'center'; weight?: number; sfx?: boolean; out?: number;
}) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  const leave = out !== undefined ? io(frame, out, out + 10, 1, 0, ease.in) : 1;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: `0 ${size * 0.26}px`, width, fontSize: size, fontWeight: weight, letterSpacing: -size * 0.035, lineHeight: 1.04, color, opacity: leave, transform: `scale(${0.96 + leave * 0.04})` }}>
      {words.map((w, i) => {
        const at = start + i * step;
        const p = frame < at ? 0 : bounce(frame, 30, at);
        const clean = w.replace(/[.,!?:;«»]/g, '');
        const isAccent = accent?.includes(clean);
        return (
          <span key={i} style={{ display: 'inline-block', opacity: Math.min(1, p * 2), transform: `translateY(${(1 - Math.min(1, p)) * size * 0.5}px) scale(${0.7 + Math.min(1.08, p) * 0.3})`, color: isAccent ? accentColor : undefined }}>
            {w}{sfx && <Sfx name="tick" at={at} volume={0.5} />}
          </span>
        );
      })}
    </div>
  );
};

/* ── Aplat de couleur qui balaie l'écran (transition), avec whoosh ── */
export const Wipe = ({ color, at, dur = 16, from = 'right', children, hold = 0, sfx = true }: { color: string; at: number; dur?: number; from?: 'right' | 'left' | 'top' | 'bottom'; children?: ReactNode; hold?: number; sfx?: boolean }) => {
  const frame = useCurrentFrame();
  const p = io(frame, at, at + dur, 0, 1, ease.expo);
  const q = hold > 0 ? io(frame, at + dur + hold, at + dur + hold + dur, 0, 1, ease.expo) : 0; // ressort de l'autre côté
  const axis = from === 'left' || from === 'right' ? 'X' : 'Y';
  const sign = from === 'right' || from === 'bottom' ? 1 : -1;
  const t = (1 - p) * sign * 100 + q * -sign * 100;
  return (
    <>
      {sfx && <Sfx name="whoosh" at={at} volume={0.9} />}
      {hold > 0 && sfx && <Sfx name="whoosh" at={at + dur + hold} volume={0.7} />}
      <AbsoluteFill style={{ background: color, transform: `translate${axis}(${t}%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</AbsoluteFill>
    </>
  );
};

/* ── Zone d'une capture (coordonnées en 1920 × 1080), affichée à la largeur `w` ── */
export const Crop = ({ src, sx, sy, sw, sh, w, radius = 22, style }: { src: string; sx: number; sy: number; sw: number; sh: number; w: number; radius?: number; style?: CSSProperties }) => {
  const k = w / sw;
  return (
    <div style={{ width: w, height: sh * k, overflow: 'hidden', borderRadius: radius, position: 'relative', background: '#fff', ...style }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', left: -sx * k, top: -sy * k, width: 1920 * k, height: 1080 * k }} />
    </div>
  );
};

/* ── Carte flottante : surgit avec un pop, respire, ombre profonde ── */
export const Float = ({ children, delay = 0, x = 0, y = 0, rot = 0, depth = 1, drift = 8, style, sfx = true }: { children: ReactNode; delay?: number; x?: number; y?: number; rot?: number; depth?: number; drift?: number; style?: CSSProperties; sfx?: boolean }) => {
  const frame = useCurrentFrame();
  const p = frame < delay ? 0 : bounce(frame, 30, delay);
  const d = Math.sin((frame + delay * 3) / 22) * drift * depth;
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: Math.min(1, p * 1.6), transform: `translateY(${d + (1 - Math.min(1, p)) * 60}px) rotate(${rot}deg) scale(${0.6 + Math.min(1.06, p) * 0.4})`, boxShadow: SHADOW_DEEP, borderRadius: 22, ...style }}>
      {sfx && <Sfx name="pop" at={delay} volume={0.7} />}
      {children}
    </div>
  );
};

/* ── Ordinateur portable : s'ouvre (rotation du capot), écran = capture ou contenu libre ── */
export const Laptop = ({ src, open = 1, w = 1100, tilt = 0, children, screen }: { src?: string; open?: number; w?: number; tilt?: number; children?: ReactNode; screen?: ReactNode }) => {
  const sw = w, sh = (w * 10) / 16, bezel = Math.round(w * 0.012);
  const angle = (1 - open) * 95; // 95° fermé → 0° ouvert
  return (
    <div style={{ position: 'relative', width: w, height: sh + 30, transform: `perspective(2600px) rotateX(${tilt}deg)`, transformStyle: 'preserve-3d' }}>
      {/* capot + écran */}
      <div style={{ position: 'absolute', left: 0, bottom: 30, width: sw, height: sh, transformOrigin: 'bottom center', transform: `rotateX(${-angle}deg)`, background: '#161a27', borderRadius: `${w * 0.02}px ${w * 0.02}px 6px 6px`, padding: bezel, boxSizing: 'border-box', boxShadow: '0 30px 80px rgba(27,32,50,.28)', backfaceVisibility: 'hidden' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: w * 0.01, overflow: 'hidden', background: '#0f1322', position: 'relative' }}>
          {src && <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          {screen}
        </div>
        <div style={{ position: 'absolute', left: '50%', top: bezel * 0.3, width: 8, height: 8, borderRadius: 4, background: '#2a3147', transform: 'translateX(-50%)' }} />
      </div>
      {/* base */}
      <div style={{ position: 'absolute', left: -w * 0.03, bottom: 0, width: w * 1.06, height: 30, background: 'linear-gradient(180deg,#d9dde8,#aeb5c7)', borderRadius: '4px 4px 16px 16px', boxShadow: '0 24px 40px rgba(27,32,50,.25)' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, width: w * 0.14, height: 7, background: '#8f97ab', borderRadius: '0 0 8px 8px', transform: 'translateX(-50%)' }} />
      </div>
      {children}
    </div>
  );
};

/* ── Cadre de visio (Meet-like) autour d'un portrait ── */
export const Call = ({ src, name, w = 900, glitch = 0, mesh, children, style }: { src: string; name: string; w?: number; glitch?: number; mesh?: ReactNode; children?: ReactNode; style?: CSSProperties }) => (
  <div style={{ width: w, height: (w * 9) / 16, borderRadius: 24, overflow: 'hidden', position: 'relative', background: '#0f1322', ...style }}>
    <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${glitch * 6}px)` }} />
    {glitch > 0 && (
      <>
        <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${glitch * -14}px)`, mixBlendMode: 'screen', opacity: 0.8, filter: 'saturate(3) hue-rotate(160deg)', clipPath: `inset(${20 + glitch * 10}% 0 ${50 - glitch * 20}% 0)` }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: `${38 + glitch * 12}%`, height: 14 * glitch, background: 'rgba(52,99,234,.45)', transform: `translateX(${glitch * 50}px)` }} />
      </>
    )}
    {mesh}
    <div style={{ position: 'absolute', left: 20, bottom: 16, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(15,19,34,.6)', color: '#fff', padding: '8px 14px', borderRadius: 999, fontSize: w * 0.024, fontWeight: 600, backdropFilter: 'blur(6px)' }}>
      <i style={{ width: 9, height: 9, borderRadius: 5, background: C.green }} />{name}
    </div>
    <div style={{ position: 'absolute', right: 20, top: 16, display: 'flex', gap: 8 }}>{['#e2574c', '#f0b63f', '#4cc792'].map((c) => <i key={c} style={{ width: 10, height: 10, borderRadius: 5, background: c, opacity: 0.8 }} />)}</div>
    {children}
  </div>
);

/* ── Icône arrondie → logo + nom (le « morph » de la référence) ── */
export const IconMorph = ({ at, size = 240, dark = true }: { at: number; size?: number; dark?: boolean }) => {
  const frame = useCurrentFrame();
  const p = frame < at ? 0 : bounce(frame, 30, at);
  const draw = io(frame, at + 10, at + 40);
  const slide = io(frame, at + 36, at + 56, 0, 1, ease.expo);
  const bg = dark ? C.ink : '#fff', fg = dark ? '#fff' : C.ink;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: slide * size * 0.18 }}>
      <Sfx name="pop" at={at} />
      <Sfx name="whoosh" at={at + 36} volume={0.6} />
      <div style={{ width: size, height: size, borderRadius: size * 0.24, background: bg, display: 'grid', placeItems: 'center', transform: `scale(${Math.min(1.08, p)}) rotate(${(1 - Math.min(1, p)) * -20}deg)`, opacity: Math.min(1, p * 2), boxShadow: SHADOW_DEEP }}>
        <svg viewBox="0 0 240 480" width={size * 0.26} height={size * 0.52}><path d={LOGO} fill="none" stroke={fg} strokeWidth="18" strokeDasharray="1500" strokeDashoffset={1500 * (1 - draw)} /><path d={LOGO} fill={fg} opacity={io(frame, at + 34, at + 44)} /></svg>
      </div>
      <div style={{ overflow: 'hidden', width: slide * size * 1.9 }}>
        <div style={{ fontSize: size * 0.7, fontWeight: 800, letterSpacing: -size * 0.03, color: C.ink, transform: `translateX(${(1 - slide) * -80}px)`, whiteSpace: 'nowrap' }}>Oval</div>
      </div>
    </div>
  );
};

/* ── Rail discret : étapes en haut à gauche, compteur de murs en haut à droite ── */
export const STEPS = ['Lien', 'Infos', 'Visage', 'Visio', 'Rapport'] as const;
export const Rail = ({ active, walls, wallAt, dark = false }: { active: number; walls: number; wallAt?: number; dark?: boolean }) => {
  const frame = useCurrentFrame();
  const fg = dark ? '#f3f5f9' : C.ink, dim = dark ? 'rgba(243,245,249,.4)' : 'rgba(27,32,50,.38)';
  const bump = wallAt !== undefined && frame >= wallAt ? bounce(frame, 30, wallAt) : 1;
  const shown = wallAt !== undefined && frame < wallAt ? walls - 1 : walls;
  return (
    <div style={{ position: 'absolute', left: 72, right: 72, top: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <svg viewBox="0 0 240 480" width={15} height={30}><path d={LOGO} fill={fg} /></svg>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: i === active ? fg : dim }}>
            <i style={{ width: 8, height: 8, borderRadius: 4, background: i < active ? C.green : i === active ? C.blue : dim }} />{s}
          </div>
        ))}
      </div>
      {wallAt !== undefined && <Sfx name="ding" at={wallAt} volume={0.8} />}
      <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: fg, background: dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.9)', padding: '8px 16px', borderRadius: 999, transform: `scale(${1 + (1 - Math.min(1, bump)) * 0.4})` }}>
        murs <span style={{ color: C.gold }}>{shown}</span>/4
      </div>
    </div>
  );
};

/* ── Note technique mono, petite ── */
export const Note = ({ children, at = 0, dark = false, style }: { children: ReactNode; at?: number; dark?: boolean; style?: CSSProperties }) => {
  const frame = useCurrentFrame();
  const p = io(frame, at, at + 10);
  return <div style={{ fontFamily: MONO, fontSize: 20, color: dark ? 'rgba(243,245,249,.7)' : C.ink3, background: dark ? 'rgba(255,255,255,.08)' : 'rgba(27,32,50,.06)', padding: '9px 16px', borderRadius: 10, display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 10}px)`, ...style }}>{children}</div>;
};

export const Tag = ({ text, dark = false }: { text: string; dark?: boolean }) => (
  <div style={{ position: 'absolute', right: 72, bottom: 40, fontFamily: MONO, fontSize: 17, letterSpacing: 2, textTransform: 'uppercase', color: dark ? 'rgba(243,245,249,.55)' : 'rgba(27,32,50,.45)', border: `1px solid ${dark ? 'rgba(243,245,249,.25)' : 'rgba(27,32,50,.18)'}`, padding: '6px 12px', borderRadius: 999 }}>{text}</div>
);

/* ── Pastille ── */
export const Chip = ({ children, tone = 'neutral', delay, size = 24 }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'green' | 'gold' | 'red' | 'dark'; delay?: number; size?: number }) => {
  const frame = useCurrentFrame();
  const t = { neutral: ['#e3e6ee', C.ink2], blue: [C.blueSoft, C.blueText], green: [C.greenSoft, C.greenText], gold: [C.goldSoft, C.goldText], red: ['#fde3e0', '#8a2a22'], dark: [C.ink, '#fff'] }[tone];
  const p = delay === undefined ? 1 : frame < delay ? 0 : bounce(frame, 30, delay);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: t[0], color: t[1], fontWeight: 700, fontSize: size, padding: `${size * 0.4}px ${size * 0.85}px`, borderRadius: 999, opacity: Math.min(1, p * 2), transform: `scale(${Math.min(1.08, p)})` }}>
      {delay !== undefined && <Sfx name="pop" at={delay} volume={0.5} />}{children}
    </span>
  );
};

export const useF = useCurrentFrame;
export { smooth, bounce, io, ease };
