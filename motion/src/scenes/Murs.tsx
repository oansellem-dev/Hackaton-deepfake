import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { ease, io, smooth } from '../components/anim';
import { Badge, Caption, Pop, Rail, Rise, Scene, TechNote } from '../components/Base';
import { Browser, C, Gauge, Manta, MONO, Pill, SHADOW, WallBreak } from '../components/Ui';

const LinkedInIcon = () => (
  <div style={{ position: 'relative', width: 120, height: 120, borderRadius: 24, background: '#0a66c2', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 64, fontWeight: 800, fontFamily: 'Georgia, serif' }}>in
    <div style={{ position: 'absolute', left: -10, right: -10, top: '50%', height: 10, background: C.red, transform: 'rotate(-30deg)', borderRadius: 5 }} />
  </div>
);

/* S5 · Mur 1 : LinkedIn 0:52–1:10 */
export const S5 = () => {
  const frame = useCurrentFrame();
  const OPEN = 90;
  const sources = ['Wikipédia FR / EN', 'GitHub', 'ORCID', 'Recherche web (Brave)'];
  return (
    <Scene>
      <WallBreak frame={frame} title="Scraper LinkedIn est interdit" icon={<LinkedInIcon />} openAt={OPEN} openDur={1.2}>
        <AbsoluteFill style={{ background: C.bg }}>
          <Rail active={1} walls={1} wallAt={480} />
          <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 70, paddingTop: 60 }}>
            <Rise delay={OPEN + 10}><Browser src="captures/cand-identite.png" url="oval-moteur.onrender.com/check/…" width={820} zoom={1.25} x={250} y={0} /></Rise>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 720 }}>
              <Rise delay={OPEN + 20}><div style={{ fontSize: 24, fontWeight: 700, color: C.ink3, textTransform: 'uppercase', letterSpacing: 3 }}>Sources publiques officielles</div></Rise>
              {sources.map((s, i) => (
                <Rise key={s} delay={OPEN + 40 + i * 22}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: '#fff', padding: '18px 26px', borderRadius: 18, boxShadow: SHADOW, fontSize: 30, fontWeight: 600 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 8, background: C.green, boxShadow: `0 0 ${12 * smooth(frame, 30, OPEN + 50 + i * 22)}px ${C.green}` }} />{s}
                  </div>
                </Rise>
              ))}
              <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                <Pop delay={OPEN + 190}><Pill tone="gold">E-mail jetable</Pill></Pop>
                <Pop delay={OPEN + 215}><Pill tone="gold">Indicatif ≠ pays déclaré</Pill></Pop>
                <Pop delay={OPEN + 240}><Pill tone="neutral">LinkedIn : montré, jamais aspiré</Pill></Pop>
              </div>
              <Rise delay={OPEN + 300}><TechNote>ne rien trouver ne pénalise jamais · seul un écart devient un signal</TechNote></Rise>
            </div>
          </AbsoluteFill>
          <Caption at={OPEN + 60} text="On vérifie la cohérence, sans aspirer LinkedIn." />
        </AbsoluteFill>
      </WallBreak>
    </Scene>
  );
};

/* S8 · Mur 2 : la photo 1:38–1:58 */
const NUMS = Array.from({ length: 128 }, (_, i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1).toFixed(3).replace('-', '-0.').slice(0, 6));
export const S8 = () => {
  const frame = useCurrentFrame();
  const OPEN = 90;
  const dissolve = io(frame, OPEN + 40, OPEN + 160, 0, 1, ease.inOut);
  const toVault = io(frame, OPEN + 200, OPEN + 300, 0, 1, ease.inOut);
  const timer = io(frame, OPEN + 320, OPEN + 440, 24, 0);
  return (
    <Scene>
      <WallBreak frame={frame} title="Une photo de visage est une donnée biométrique" icon={<div style={{ fontSize: 30, fontWeight: 800, color: C.gold, fontFamily: MONO, border: `3px solid ${C.gold}`, padding: '10px 22px', borderRadius: 14 }}>RGPD · art. 9</div>} openAt={OPEN} openDur={1.05}>
        <AbsoluteFill style={{ background: C.bg }}>
          <Rail active={2} walls={2} wallAt={560} />
          <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 60, paddingTop: 60 }}>
            {/* la photo, barrée : n'atteint jamais le serveur */}
            <div style={{ position: 'relative' }}>
              <div style={{ width: 360, height: 450, borderRadius: 28, overflow: 'hidden', boxShadow: SHADOW, opacity: 1 - dissolve * 0.85, filter: `blur(${dissolve * 10}px)` }}>
                <Img src={staticFile('avatars/camille.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
              </div>
              <Pop delay={OPEN + 170} style={{ position: 'absolute', left: -30, top: 190, transform: 'rotate(-10deg)' }}>
                <div style={{ border: `5px solid ${C.red}`, color: C.red, fontFamily: MONO, fontWeight: 800, fontSize: 24, padding: '8px 16px', borderRadius: 12, background: 'rgba(255,255,255,.9)' }}>JAMAIS ENVOYÉE</div>
              </Pop>
            </div>
            <div style={{ fontSize: 60, color: C.ink3, opacity: dissolve }}>→</div>
            {/* colonne de 128 nombres */}
            <div style={{ position: 'relative', width: 560, height: 470, transform: `scale(${1 - toVault * 0.35})`, opacity: 1 - toVault * 0.5 }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px 8px', fontFamily: MONO, fontSize: 17, color: C.blueText, alignContent: 'start' }}>
                {NUMS.map((n, i) => <span key={i} style={{ opacity: Math.max(0, Math.min(1, dissolve * 160 - i)) }}>{n}</span>)}
              </div>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', fontSize: 28, fontWeight: 700, opacity: io(frame, OPEN + 150, OPEN + 170) }}>128 nombres + proportions du visage</div>
            </div>
            {/* coffre */}
            <div style={{ position: 'relative', width: 340, height: 420, borderRadius: 32, background: C.ink, boxShadow: SHADOW, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#fff', opacity: io(frame, OPEN + 180, OPEN + 210), transform: `scale(${0.9 + toVault * 0.1})` }}>
              <div style={{ width: 120, height: 120, borderRadius: 60, border: '10px solid rgba(255,255,255,.2)', display: 'grid', placeItems: 'center', fontSize: 40, fontFamily: MONO }}>🔒</div>
              <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700 }}>AES-256-GCM</div>
              <div style={{ fontSize: 22, color: 'rgba(255,255,255,.7)' }}>sans nom ni e-mail</div>
              <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 40, fontWeight: 800, color: C.gold, opacity: io(frame, OPEN + 320, OPEN + 335) }}>{Math.ceil(timer)} h</div>
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,.7)', opacity: io(frame, OPEN + 320, OPEN + 335) }}>effacé à la décision, au plus tard</div>
            </div>
          </AbsoluteFill>
          <div style={{ position: 'absolute', left: 96, bottom: 150 }}><TechNote delay={OPEN + 240}>SFace · ONNX Runtime Web · consentement explicite · alternative sans biométrie, sans pénalité</TechNote></div>
          <Caption at={OPEN + 60} text="Jamais d'image : des nombres pour comparer, chiffrés, effacés." />
        </AbsoluteFill>
      </WallBreak>
    </Scene>
  );
};

/* S9 · Mur 3 : des deepfakes trop bons 1:58–2:16 (test de lumière) */
const COLORS = ['#ffffff', '#3463ea', '#d9534f', '#4cc792', '#111111'];
export const S9 = () => {
  const frame = useCurrentFrame();
  const OPEN = 90;
  const t = Math.max(0, frame - (OPEN + 40)); // 1 s par couleur, fondu 0,3 s
  const idx = Math.min(4, Math.floor(t / 30));
  const mix = io(t % 30, 0, 9);
  const prev = COLORS[Math.max(0, idx - 1)], cur = COLORS[idx];
  const screen = t < 150 ? (mix < 1 ? prev : cur) : '#111111';
  const curve = (lag: number, drop: boolean) => Array.from({ length: 60 }, (_, i) => {
    const x = i / 59, k = Math.floor(x * 5);
    let y = [0.2, 0.7, 0.55, 0.65, 0.1][Math.min(4, k)];
    if (drop && k >= 2) y = 0.4 + Math.sin(i) * 0.03;
    return `${x * 560},${120 - y * 100 + (drop ? 0 : 0)}`;
  }).map((p, i) => (i === 0 ? 'M' : 'L') + p).join(' ');
  const drawn = io(t, 0, 150);
  return (
    <Scene dark>
      <WallBreak frame={frame} title="À l'œil nu, on ne voit plus rien" icon={<div style={{ fontSize: 54 }}>👁</div>} openAt={OPEN} openDur={0.9}>
        <AbsoluteFill style={{ background: C.navy }}>
          <Rail active={2} walls={3} wallAt={500} dark />
          <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 70, paddingTop: 60 }}>
            {/* l'écran qui change de couleur et le visage qui le reflète */}
            <div style={{ position: 'relative', width: 640, height: 400, borderRadius: 28, background: screen, boxShadow: `0 0 120px ${screen}66`, display: 'grid', placeItems: 'center', transition: 'none' }}>
              <div style={{ width: 300, height: 300, borderRadius: 150, overflow: 'hidden', boxShadow: `inset 0 0 80px ${screen}`, position: 'relative' }}>
                <Img src={staticFile('avatars/camille.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
                <div style={{ position: 'absolute', inset: 0, background: screen, opacity: 0.35, mixBlendMode: 'screen' }} />
              </div>
              <div style={{ position: 'absolute', left: 20, bottom: 16, display: 'flex', gap: 8 }}>{COLORS.map((c, i) => <span key={c} style={{ width: 26, height: 26, borderRadius: 13, background: c, border: '2px solid rgba(255,255,255,.4)', opacity: i <= idx && t < 150 ? 1 : 0.3 }} />)}</div>
            </div>
            {/* courbes vrai / faux */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 26, width: 620 }}>
              {[{ l: 'Vraie peau : le reflet suit', c: C.green, d: false }, { l: 'Deepfake : en retard, ou décroche', c: C.gold, d: true }].map((k, i) => (
                <div key={k.l} style={{ background: C.navy2, borderRadius: 22, padding: 20 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: k.c, marginBottom: 8 }}>{k.l}</div>
                  <svg width="560" height="130" viewBox="0 0 560 130">
                    <path d={curve(0, false)} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" strokeDasharray="6 6" />
                    <path d={curve(i ? 20 : 0, k.d)} fill="none" stroke={k.c} strokeWidth="5" strokeLinecap="round" strokeDasharray="1200" strokeDashoffset={1200 * (1 - drawn)} transform={i ? 'translate(40 0)' : undefined} />
                  </svg>
                </div>
              ))}
              <TechNote dark delay={OPEN + 200}>5 couleurs au hasard · 1 s chacune · fondu 0,3 s · jamais de flash · étape facultative</TechNote>
            </div>
          </AbsoluteFill>
          <Badge text="Illustration" dark pos="tr" />
          <Caption dark at={OPEN + 60} text="La physique : un reflet qu'un deepfake doit inventer." />
        </AbsoluteFill>
      </WallBreak>
    </Scene>
  );
};

/* S10 · Mur 4 : le vrai humain qui triche ensuite 2:16–2:36 */
export const S10 = () => {
  const frame = useCurrentFrame();
  const OPEN = 90;
  const swapAt = OPEN + 220;
  const sim = frame < swapAt ? 0.97 : io(frame, swapAt, swapAt + 40, 0.97, 0.05, ease.out);
  const swapped = io(frame, swapAt, swapAt + 20);
  return (
    <Scene>
      <WallBreak frame={frame} title="Vrai visage avant, deepfake pendant ?" icon={<div style={{ fontSize: 30, fontWeight: 800, color: C.gold, fontFamily: MONO, border: `3px solid ${C.gold}`, padding: '10px 22px', borderRadius: 14 }}>MUR 4</div>} openAt={OPEN} openDur={0.8}>
        <AbsoluteFill style={{ background: C.bg }}>
          <Rail active={3} walls={4} wallAt={540} />
          <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 50, paddingTop: 60 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 26, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 260, height: 320, borderRadius: 24, overflow: 'hidden', boxShadow: SHADOW }}><Img src={staticFile('avatars/camille.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} /></div>
                  <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700, color: C.ink3 }}>Pré-vérification</div>
                </div>
                <Gauge value={sim * 100} size={240} tone={sim > 0.4 ? C.green : C.red} label="similarité" />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 260, height: 320, borderRadius: 24, overflow: 'hidden', boxShadow: SHADOW, position: 'relative' }}>
                    <Img src={staticFile('avatars/camille.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
                    <Img src={staticFile('avatars/leo.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', opacity: swapped }} />
                  </div>
                  <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700, color: C.ink3 }}>En visio, toutes les 2 s</div>
                </div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800, color: sim > 0.4 ? C.greenText : C.red }}>{sim.toFixed(2)}</div>
              <Pop delay={swapAt + 30}><Pill tone="red" style={{ fontSize: 28 }}>Visage différent de la pré-vérification</Pill></Pop>
              <Rise delay={OPEN + 60}><TechNote>même personne ≥ 0,40 · différente ≤ 0,25 · mesuré : 0,97 et 0,05 · proportions ≥ 12 % = différent</TechNote></Rise>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
              <Rise delay={OPEN + 20}><Browser src="captures/panel.png" url="oval-moteur.onrender.com/panel/…" width={560} zoom={1.9} x={210} y={0} /></Rise>
              <Rise delay={OPEN + 120}><Manta frame={frame} size={90} say="Pouvez-vous passer la main devant votre visage ?" /></Rise>
            </div>
          </AbsoluteFill>
          <Caption at={OPEN + 60} text="Même empreinte du début à la fin, sur Teams, Meet ou Zoom." />
        </AbsoluteFill>
      </WallBreak>
    </Scene>
  );
};
