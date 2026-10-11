import { Easing, interpolate, spring } from 'remotion';

export const FPS = 30;
export const s = (sec: number) => Math.round(sec * FPS);

/** Interpolation bornée, avec une courbe douce par défaut. */
export const io = (frame: number, from: number, to: number, a = 0, b = 1, easing: (t: number) => number = Easing.inOut(Easing.cubic)) =>
  interpolate(frame, [from, to], [a, b], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

/** Entrée puis sortie : 0 → 1 (sur `inDur`), plateau, 1 → 0 (sur `outDur`) ; `len` = durée totale. */
export const kf = (frame: number, len: number, inDur = 12, outDur = 12) =>
  Math.min(io(frame, 0, inDur), io(frame, len - outDur, len, 1, 0));

/** Ressort doux (apparition). */
export const smooth = (frame: number, fps = FPS, delay = 0) => spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 120, mass: 0.8 } });
/** Ressort rebondi (pastilles, compteur). */
export const bounce = (frame: number, fps = FPS, delay = 0) => spring({ frame: frame - delay, fps, config: { damping: 9, stiffness: 180, mass: 0.6 } });

/** Texte tapé caractère par caractère. */
export const typed = (text: string, frame: number, start: number, cps = 28) => text.slice(0, Math.max(0, Math.floor(((frame - start) / FPS) * cps)));

export const ease = { out: Easing.out(Easing.cubic), in: Easing.in(Easing.cubic), inOut: Easing.inOut(Easing.cubic), expo: Easing.out(Easing.exp) };
