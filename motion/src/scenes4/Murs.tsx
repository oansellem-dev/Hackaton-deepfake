import type { ReactNode } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { bounce, ease, io } from '../components/anim';
import { Scene } from '../components/Base';
import { C, Gauge, Manta, MONO } from '../components/Ui';
import { BG, Call, Chip, Crop, Float, Note, Rail, Sfx, Tag, Words } from '../components/Kit';

const A = 'portraits/candidate-a.png', B = 'portraits/candidate-b.png';

/**
 * Le mur, version V4 : un aplat navy balaie l'écran (impact), le titre claque mot à mot, une fissure dorée se trace
 * (craquement), puis les deux battants s'ouvrent en porte (souffle) sur la scène. Même dessin pour les 4 murs,
 * ouverture de plus en plus rapide.
 */
const Wall = ({ title, openAt, openDur, accent, children, tag }: { title: string; openAt: number; openDur: number; accent?: string[]; children: ReactNode; tag: ReactNode }) => {
  const frame = useCurrentFrame();
  const arrive = io(frame, 0, 14, 0, 1, ease.expo);
  const crack = io(frame, 40, 75, 0, 1, ease.out);
  const open = io(frame, openAt, openAt + openDur * 30, 0, 1, ease.inOut);
  const shake = frame > openAt - 8 && frame < openAt ? Math.sin(frame * 3) * 5 : 0;
  return (
    <AbsoluteFill>
      <Sfx name="thud" at={2} />
      <Sfx name="crack" at={40} />
      <Sfx name="door" at={openAt} />
      <AbsoluteFill style={{ opacity: io(frame, openAt + 4, openAt + openDur * 30, 0, 1) }}>{children}</AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', background: C.ink, transformOrigin: 'left center', transform: `translateY(${(1 - arrive) * 100}%) translateX(${shake}px) perspective(2400px) rotateY(${open * -100}deg)`, boxShadow: '12px 0 48px rgba(0,0,0,.35)' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', background: C.ink, transformOrigin: 'right center', transform: `translateY(${(1 - arrive) * 100}%) translateX(${-shake}px) perspective(2400px) rotateY(${open * 100}deg)`, boxShadow: '-12px 0 48px rgba(0,0,0,.35)' }} />
      <svg viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 1 - open * 2, pointerEvents: 'none' }}>
        <path d="M960 0 L950 140 L985 260 L940 420 L975 540 L930 700 L970 860 L950 1080" fill="none" stroke={C.gold} strokeWidth="6" strokeLinecap="round" strokeDasharray="1400" strokeDashoffset={1400 * (1 - crack)} style={{ filter: 'drop-shadow(0 0 18px rgba(240,182,63,.9))' }} />
      </svg>
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 1 - open * 1.8, transform: `scale(${1 + open * 0.25})` }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
          {tag}
          <Words text={title} start={14} step={5} size={100} color="#fff" width={1500} accent={accent} accentColor={C.gold} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const WallTag = ({ n, children }: { n: number; children?: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, color: C.gold, border: `3px solid ${C.gold}`, padding: '8px 18px', borderRadius: 12, letterSpacing: 2 }}>MUR {n}</span>{children}
  </div>
);

/* S5 · Mur 1 : LinkedIn 0:52–1:10 */
export const S5 = () => {
  const frame = useCurrentFrame();
  const OPEN = 95;
  const sources = ['Wikipédia FR / EN', 'GitHub', 'ORCID', 'Recherche web (Brave)'];
  return (
    <Scene style={{ background: BG }} fade={0}>
      <Wall title="Scraper LinkedIn est interdit." openAt={OPEN} openDur={1.2} accent={['interdit']} tag={<WallTag n={1}><span style={{ width: 54, height: 54, borderRadius: 12, background: '#0a66c2', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 30, position: 'relative' }}>in<span style={{ position: 'absolute', left: -6, right: -6, top: '50%', height: 6, background: C.red, transform: 'rotate(-30deg)', borderRadius: 3 }} /></span></WallTag>}>
        <AbsoluteFill style={{ background: BG }}>
          <Rail active={1} walls={1} wallAt={470} />
          <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 80, paddingTop: 40 }}>
            <Float delay={OPEN + 20} x={0} y={0} rot={-3} style={{ position: 'relative' }}><Crop src="captures/cand-identite.png" sx={640} sy={60} sw={640} sh={400} w={620} /></Float>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 700 }}>
              <Note at={OPEN + 30}>sources publiques officielles, API ouvertes</Note>
              {sources.map((s, i) => (
                <Float key={s} delay={OPEN + 50 + i * 18} drift={0} style={{ position: 'relative', boxShadow: '0 16px 40px rgba(27,32,50,.12)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: '#fff', padding: '18px 26px', borderRadius: 18, fontSize: 30, fontWeight: 600, width: 700, boxSizing: 'border-box' }}>
                    <span style={{ width: 14, height: 14, borderRadius: 7, background: C.green, boxShadow: `0 0 ${12 * Math.min(1, bounce(frame, 30, OPEN + 60 + i * 18))}px ${C.green}` }} />{s}
                  </div>
                </Float>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <Chip tone="gold" delay={OPEN + 170}>E-mail jetable</Chip>
                <Chip tone="gold" delay={OPEN + 192}>Indicatif ≠ pays déclaré</Chip>
                <Chip tone="neutral" delay={OPEN + 214}>LinkedIn : montré, jamais aspiré</Chip>
              </div>
            </div>
          </AbsoluteFill>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center' }}>
            <Words text="On vérifie la cohérence. Ne rien trouver ne pénalise jamais." start={OPEN + 240} step={3} size={40} weight={700} width={1600} accent={['jamais']} sfx={false} />
          </div>
        </AbsoluteFill>
      </Wall>
    </Scene>
  );
};

/* S8 · Mur 2 : la photo 1:38–1:58 */
const NUMS = Array.from({ length: 128 }, (_, i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1).toFixed(3).replace('-0', '-').slice(0, 6));
export const S8 = () => {
  const frame = useCurrentFrame();
  const OPEN = 95;
  const dissolve = io(frame, OPEN + 40, OPEN + 160, 0, 1, ease.inOut);
  const toVault = io(frame, OPEN + 210, OPEN + 300, 0, 1, ease.inOut);
  const timer = io(frame, OPEN + 320, OPEN + 440, 24, 0);
  return (
    <Scene style={{ background: BG }} fade={0}>
      <Wall title="Une photo de visage est une donnée biométrique." openAt={OPEN} openDur={1.05} accent={['biométrique']} tag={<WallTag n={2}><span style={{ fontFamily: MONO, fontSize: 24, color: '#fff', opacity: 0.8 }}>RGPD · art. 9</span></WallTag>}>
        <AbsoluteFill style={{ background: BG }}>
          <Rail active={2} walls={2} wallAt={560} />
          <Sfx name="whoosh" at={OPEN + 40} volume={0.5} />
          <Sfx name="click" at={OPEN + 300} />
          <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 60, paddingTop: 30 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 560, borderRadius: 24, overflow: 'hidden', boxShadow: '0 30px 70px rgba(27,32,50,.2)', opacity: 1 - dissolve * 0.85, filter: `blur(${dissolve * 12}px)` }}><Call src={A} name="Camille R." w={560} /></div>
              <div style={{ position: 'absolute', left: -20, top: 120, transform: 'rotate(-10deg)' }}><Chip tone="red" delay={OPEN + 170} size={22}><span style={{ fontFamily: MONO, letterSpacing: 1 }}>JAMAIS ENVOYÉE</span></Chip></div>
            </div>
            <div style={{ fontSize: 60, color: C.ink3, opacity: dissolve }}>→</div>
            <div style={{ position: 'relative', width: 520, height: 440, transform: `scale(${1 - toVault * 0.35})`, opacity: 1 - toVault * 0.5 }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px 8px', fontFamily: MONO, fontSize: 16, color: C.blueText }}>
                {NUMS.map((n, i) => <span key={i} style={{ opacity: Math.max(0, Math.min(1, dissolve * 160 - i)) }}>{n}</span>)}
              </div>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', fontSize: 26, fontWeight: 700, opacity: io(frame, OPEN + 150, OPEN + 170) }}>128 nombres + proportions du visage</div>
            </div>
            <Float delay={OPEN + 190} drift={4} style={{ position: 'relative' }}>
              <div style={{ width: 330, height: 410, borderRadius: 30, background: C.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#fff' }}>
                <div style={{ width: 110, height: 110, borderRadius: 55, border: '10px solid rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontSize: 40 }}>🔒</div>
                <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700 }}>AES-256-GCM</div>
                <div style={{ fontSize: 21, color: 'rgba(255,255,255,.7)' }}>sans nom ni e-mail</div>
                <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 42, fontWeight: 800, color: C.gold, opacity: io(frame, OPEN + 320, OPEN + 335) }}>{Math.ceil(timer)} h</div>
                <div style={{ fontSize: 19, color: 'rgba(255,255,255,.7)', opacity: io(frame, OPEN + 320, OPEN + 335) }}>effacé à la décision, au plus tard</div>
              </div>
            </Float>
          </AbsoluteFill>
          <div style={{ position: 'absolute', left: 72, bottom: 126 }}><Note at={OPEN + 240}>SFace · ONNX Runtime Web · consentement explicite · alternative sans biométrie, sans pénalité</Note></div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center' }}>
            <Words text="Jamais d'image. Des nombres pour comparer, chiffrés, effacés." start={OPEN + 60} step={3} size={40} weight={700} width={1600} accent={["d'image"]} sfx={false} />
          </div>
        </AbsoluteFill>
      </Wall>
    </Scene>
  );
};

/* S9 · Mur 3 : des deepfakes trop bons 1:58–2:16 — l'écran change de couleur, le reflet suit ou non */
const COLORS = ['#ffffff', '#3463ea', '#d9534f', '#4cc792', '#111111'];
export const S9 = () => {
  const frame = useCurrentFrame();
  const OPEN = 95;
  const t = Math.max(0, frame - (OPEN + 40));
  const idx = Math.min(4, Math.floor(t / 30));
  const cur = t < 150 ? COLORS[idx] : '#111111';
  const curve = (drop: boolean) => Array.from({ length: 60 }, (_, i) => { const x = i / 59, k = Math.floor(x * 5); let y = [0.2, 0.7, 0.55, 0.65, 0.1][Math.min(4, k)]; if (drop && k >= 2) y = 0.4 + Math.sin(i) * 0.03; return `${x * 560},${120 - y * 100}`; }).map((p, i) => (i === 0 ? 'M' : 'L') + p).join(' ');
  const drawn = io(t, 0, 150);
  return (
    <Scene style={{ background: C.ink }} fade={0}>
      <Wall title="À l'œil nu, on ne voit plus rien." openAt={OPEN} openDur={0.9} accent={['rien']} tag={<WallTag n={3} />}>
        <AbsoluteFill style={{ background: C.ink }}>
          <Rail active={2} walls={3} wallAt={500} dark />
          {[0, 1, 2, 3, 4].map((i) => <Sfx key={i} name="click" at={OPEN + 40 + i * 30} volume={0.5} />)}
          <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 70, paddingTop: 30 }}>
            <div style={{ position: 'relative', width: 760, height: 470, borderRadius: 28, background: cur, boxShadow: `0 0 140px ${cur}66`, display: 'grid', placeItems: 'center' }}>
              <div style={{ width: 560, borderRadius: 20, overflow: 'hidden', position: 'relative', boxShadow: `inset 0 0 80px ${cur}` }}>
                <Call src={A} name="Camille R." w={560} />
                <div style={{ position: 'absolute', inset: 0, background: cur, opacity: 0.3, mixBlendMode: 'screen' }} />
              </div>
              <div style={{ position: 'absolute', left: 22, bottom: 18, display: 'flex', gap: 8 }}>{COLORS.map((c, i) => <span key={c} style={{ width: 24, height: 24, borderRadius: 12, background: c, border: '2px solid rgba(255,255,255,.5)', opacity: i <= idx && t < 150 ? 1 : 0.3 }} />)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, width: 620 }}>
              {[{ l: 'Vraie peau : le reflet suit', c: C.green, d: false }, { l: 'Deepfake : en retard, ou décroche', c: C.gold, d: true }].map((k, i) => (
                <div key={k.l} style={{ background: C.navy2, borderRadius: 22, padding: 20 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: k.c, marginBottom: 8 }}>{k.l}</div>
                  <svg width="560" height="130" viewBox="0 0 560 130">
                    <path d={curve(false)} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" strokeDasharray="6 6" />
                    <path d={curve(k.d)} fill="none" stroke={k.c} strokeWidth="5" strokeLinecap="round" strokeDasharray="1200" strokeDashoffset={1200 * (1 - drawn)} transform={i ? 'translate(40 0)' : undefined} />
                  </svg>
                </div>
              ))}
              <Note dark at={OPEN + 200}>5 couleurs au hasard · 1 s chacune · fondu 0,3 s · jamais de flash · étape facultative</Note>
            </div>
          </AbsoluteFill>
          <Tag text="Illustration" dark />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center' }}>
            <Words text="La physique : un reflet qu'un deepfake doit inventer." start={OPEN + 60} step={3} size={40} weight={700} width={1600} color="#fff" accent={['physique']} accentColor={C.gold} sfx={false} />
          </div>
        </AbsoluteFill>
      </Wall>
    </Scene>
  );
};

/* S10 · Mur 4 : le vrai humain qui triche ensuite 2:16–2:36 */
export const S10 = () => {
  const frame = useCurrentFrame();
  const OPEN = 95;
  const swapAt = OPEN + 230;
  const sim = frame < swapAt ? 0.97 : io(frame, swapAt, swapAt + 40, 0.97, 0.05, ease.out);
  const swapped = io(frame, swapAt, swapAt + 14);
  return (
    <Scene style={{ background: BG }} fade={0}>
      <Wall title="Vrai visage avant, deepfake pendant ?" openAt={OPEN} openDur={0.8} accent={['pendant']} tag={<WallTag n={4} />}>
        <AbsoluteFill style={{ background: BG }}>
          <Rail active={3} walls={4} wallAt={540} />
          <Sfx name="glitch" at={swapAt} />
          <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 60, paddingTop: 30 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 60px rgba(27,32,50,.2)' }}><Call src={A} name="Pré-vérification" w={420} /></div>
                </div>
                <Gauge value={sim * 100} size={220} tone={sim > 0.4 ? C.green : C.red} label="similarité" />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 60px rgba(27,32,50,.2)' }}>
                    <Call src={A} name="En visio · toutes les 2 s" w={420} />
                    <Img src={staticFile(B)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: swapped }} />
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 800, color: sim > 0.4 ? C.greenText : C.red }}>{sim.toFixed(2)}</div>
              <Chip tone="red" delay={swapAt + 30} size={27}>Visage différent de la pré-vérification</Chip>
              <Note at={OPEN + 60}>même personne ≥ 0,40 · différente ≤ 0,25 · mesuré : 0,97 et 0,05 · proportions ≥ 12 % = différent</Note>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
              <Float delay={OPEN + 20} rot={2} style={{ position: 'relative' }}><Crop src="captures/panel.png" sx={750} sy={0} sw={420} sh={700} w={300} /></Float>
              <div style={{ opacity: io(frame, OPEN + 120, OPEN + 135) }}><Manta frame={frame} size={80} say="Pouvez-vous passer la main devant votre visage ?" /></div>
            </div>
          </AbsoluteFill>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center' }}>
            <Words text="Même empreinte du début à la fin, sur Teams, Meet ou Zoom." start={OPEN + 60} step={3} size={40} weight={700} width={1600} accent={['empreinte']} sfx={false} />
          </div>
        </AbsoluteFill>
      </Wall>
    </Scene>
  );
};
