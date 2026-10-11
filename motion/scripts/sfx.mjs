// Bruitages synthétisés (WAV 48 kHz mono) : clic, pop, whoosh, tic, impact, ding. Aucune voix, aucune musique.
import { writeFileSync } from 'node:fs';
const SR = 48000;
const wav = (samples) => {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767, 44 + i * 2);
  return buf;
};
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
// filtre passe-bas 1 pôle
const lp = (xs, fc) => { const a = 1 - Math.exp(-2 * Math.PI * fc / SR); let y = 0; return xs.map((x) => (y += a * (x - y))); };
const hp = (xs, fc) => { const l = lp(xs, fc); return xs.map((x, i) => x - l[i]); };
const gen = (dur, f) => Array.from({ length: Math.round(SR * dur) }, (_, i) => f(i / SR));

// clic UI : bruit très court + petite résonance
const click = gen(0.09, (t) => rnd() * env(t, 0.001, 0.008) * 0.9 + Math.sin(2 * Math.PI * 1800 * t) * env(t, 0.001, 0.015) * 0.5);
writeFileSync('public/sfx/click.wav', wav(lp(click, 6000).map((x) => x * 0.8)));
// clic doux (mots qui apparaissent)
const tick = gen(0.06, (t) => Math.sin(2 * Math.PI * 2400 * t) * env(t, 0.001, 0.012) * 0.5 + rnd() * env(t, 0.001, 0.004) * 0.3);
writeFileSync('public/sfx/tick.wav', wav(tick.map((x) => x * 0.7)));
// pop : sinus qui descend, pour les pastilles et cartes
const pop = gen(0.18, (t) => Math.sin(2 * Math.PI * (900 - 600 * Math.min(1, t * 10)) * t) * env(t, 0.004, 0.05));
writeFileSync('public/sfx/pop.wav', wav(pop.map((x) => x * 0.75)));
// whoosh : bruit filtré avec balayage, pour les transitions et aplats
const whoosh = (() => { const n = gen(0.55, (t) => rnd() * Math.sin(Math.PI * Math.min(1, t / 0.55)) ** 1.5); const out = []; let y = 0; for (let i = 0; i < n.length; i++) { const t = i / SR; const fc = 300 + 5000 * Math.sin(Math.PI * t / 0.55); const a = 1 - Math.exp(-2 * Math.PI * fc / SR); y += a * (n[i] - y); out.push(y); } return hp(out, 120); })();
writeFileSync('public/sfx/whoosh.wav', wav(whoosh.map((x) => x * 1.4)));
// impact sourd : mur qui arrive
const thud = gen(0.5, (t) => Math.sin(2 * Math.PI * (70 + 40 * Math.exp(-t * 30)) * t) * env(t, 0.003, 0.14) + rnd() * env(t, 0.001, 0.02) * 0.4);
writeFileSync('public/sfx/thud.wav', wav(lp(thud, 900).map((x) => x * 0.9)));
// ding : validation (deux harmoniques)
const ding = gen(0.7, (t) => (Math.sin(2 * Math.PI * 1320 * t) + 0.5 * Math.sin(2 * Math.PI * 1980 * t)) * env(t, 0.002, 0.22) * 0.45);
writeFileSync('public/sfx/ding.wav', wav(ding));
// craquement : fissure du mur
const crack = gen(0.35, (t) => rnd() * env(t, 0.002, 0.03) * (t < 0.05 ? 1 : 0.4) + rnd() * (Math.sin(t * 90) > 0.95 ? 0.8 : 0) * 0.6);
writeFileSync('public/sfx/crack.wav', wav(hp(lp(crack, 5000), 400).map((x) => x * 0.8)));
// glitch : bruit numérique haché
const glitch = gen(0.25, (t) => (Math.floor(t * 60) % 2 ? rnd() : Math.sign(Math.sin(2 * Math.PI * 220 * t))) * env(t, 0.001, 0.12) * 0.5);
writeFileSync('public/sfx/glitch.wav', wav(glitch));
// porte qui s'ouvre : whoosh grave + aération
const door = gen(0.8, (t) => rnd() * Math.sin(Math.PI * Math.min(1, t / 0.8)) ** 2 * 0.6);
writeFileSync('public/sfx/door.wav', wav(lp(door, 700).map((x) => x * 1.6)));
console.log('sfx ok');
