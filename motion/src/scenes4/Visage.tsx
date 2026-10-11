import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { ease, io } from '../components/anim';
import { Scene } from '../components/Base';
import { C, MONO, OvalScan } from '../components/Ui';
import { BG, Call, Chip, Crop, Float, Note, Rail, Sfx, Tag, Words } from '../components/Kit';

const A = 'portraits/candidate-a.png', B = 'portraits/candidate-b.png';

/* S6 · L'environnement 1:10–1:20 — la liste des caméras, OBS barré, fuseau, IP */
export const S6 = () => {
  const frame = useCurrentFrame();
  const cams = [{ n: 'FaceTime HD Camera', ok: true }, { n: 'OBS Virtual Camera', ok: false }, { n: 'ManyCam Virtual Webcam', ok: false }];
  return (
    <Scene style={{ background: BG }} fade={0}>
      <Rail active={1} walls={1} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 90, paddingTop: 40 }}>
        <div style={{ width: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Note at={10}>navigator.mediaDevices.enumerateDevices()</Note>
          {cams.map((c, i) => {
            const at = 30 + i * 26;
            const strike = c.ok ? 0 : io(frame, at + 45, at + 60, 0, 1, ease.expo);
            return (
              <Float key={c.n} delay={at} x={0} y={0} drift={0} style={{ position: 'relative', boxShadow: '0 16px 40px rgba(27,32,50,.12)' }}>
                {!c.ok && <Sfx name="glitch" at={at + 45} volume={0.6} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: '#fff', padding: '20px 26px', borderRadius: 18, fontSize: 30, fontWeight: 600, position: 'relative', width: 760, boxSizing: 'border-box' }}>
                  <span style={{ width: 14, height: 14, borderRadius: 7, background: c.ok ? C.green : C.red }} />
                  <span style={{ flex: 1 }}>{c.n}</span>
                  <span style={{ fontSize: 21, color: c.ok ? C.greenText : C.goldText, fontWeight: 700 }}>{c.ok ? 'vraie caméra' : 'virtuelle · refusée'}</span>
                  {!c.ok && <div style={{ position: 'absolute', left: 58, top: '50%', height: 4, width: 400 * strike, background: C.red, borderRadius: 2 }} />}
                </div>
              </Float>
            );
          })}
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <Chip tone="blue" delay={140}>Fuseau horaire · Europe/Paris</Chip>
            <Chip tone="blue" delay={158}>Adresse IP · pays déclaré</Chip>
          </div>
          <Note at={190}>motifs : OBS · ManyCam · DeepFaceLive · Snap Camera</Note>
        </div>
        <Float delay={16} x={0} y={0} rot={3} style={{ position: 'relative' }}><Crop src="captures/cand-visage.png" sx={640} sy={60} sw={640} sh={670} w={560} /></Float>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center' }}>
        <Words text="Caméra virtuelle remplacée ou refusée." start={40} step={3} size={40} weight={700} width={1500} accent={['refusée']} sfx={false} />
      </div>
    </Scene>
  );
};

/* S7 · Le visage 1:20–1:38 — l'ovale, le maillage, la main qui passe, l'écran scindé vrai / substitué */
const MESH = Array.from({ length: 140 }, (_, i) => {
  const a = (i / 140) * Math.PI * 2, r = 0.5 + ((i * 37) % 17) / 36;
  return { x: 0.5 + Math.cos(a) * r * 0.2 * (0.7 + ((i * 13) % 7) / 20), y: 0.46 + Math.sin(a) * r * 0.33 };
});
const Mesh = ({ p }: { p: number }) => (
  <svg viewBox="0 0 160 90" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
    {MESH.slice(0, 70).map((q, i) => { const r = MESH[(i * 7 + 3) % MESH.length]; return <line key={`l${i}`} x1={q.x * 160} y1={q.y * 90} x2={r.x * 160} y2={r.y * 90} stroke={C.green} strokeWidth={0.18} opacity={Math.max(0, Math.min(0.55, p * 70 - i))} />; })}
    {MESH.map((q, i) => <circle key={i} cx={q.x * 160} cy={q.y * 90} r={0.55} fill={C.green} opacity={Math.max(0, Math.min(1, p * 160 - i))} />)}
  </svg>
);
/* Silhouette de main (paume + cinq doigts), qui traverse le cadre de gauche à droite */
const Hand = ({ p }: { p: number }) => (
  <svg viewBox="0 0 200 260" style={{ position: 'absolute', left: `${-50 + p * 130}%`, top: '2%', width: '44%', height: '96%', filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.5))', transform: `rotate(${-14 + p * 10}deg)` }}>
    <defs><linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#efc7ab" /><stop offset="1" stopColor="#c98f6c" /></linearGradient></defs>
    <rect x="34" y="60" width="26" height="130" rx="13" fill="url(#skin)" transform="rotate(-18 47 190)" />
    <rect x="58" y="22" width="28" height="160" rx="14" fill="url(#skin)" />
    <rect x="92" y="8" width="28" height="172" rx="14" fill="url(#skin)" />
    <rect x="126" y="24" width="27" height="156" rx="13" fill="url(#skin)" />
    <rect x="156" y="62" width="25" height="120" rx="12" fill="url(#skin)" transform="rotate(14 168 182)" />
    <path d="M52 130 C50 100 170 100 172 130 L178 210 C180 245 150 258 110 258 C70 258 44 245 46 210 Z" fill="url(#skin)" />
  </svg>
);
export const S7 = () => {
  const frame = useCurrentFrame();
  const oval = io(frame, 10, 70, 0, 1, ease.inOut);
  const mesh = io(frame, 60, 160);
  const split = io(frame, 240, 280, 0, 1, ease.expo);
  const hand = io(frame, 300, 420, 0, 1, ease.inOut);
  const tear = io(frame, 350, 395, 0, 1, ease.expo);
  return (
    <Scene style={{ background: BG }} fade={0}>
      <Rail active={2} walls={1} />
      <Sfx name="whoosh" at={240} volume={0.6} />
      <Sfx name="crack" at={352} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 50, paddingTop: 30 }}>
        {/* la capture dans l'ovale */}
        <div style={{ position: 'relative', transform: `translateX(${split * -80}px) scale(${1 - split * 0.18})`, borderRadius: 24, boxShadow: '0 40px 90px rgba(27,32,50,.22)' }}>
          <Call src={A} name="Camille R." w={900} mesh={<Mesh p={mesh} />}>{hand > 0 && <Hand p={hand} />}</Call>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -52%)' }}><OvalScan progress={oval} size={330} /></div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: -70, display: 'flex', justifyContent: 'center', gap: 10 }}>
            <Chip tone="green" delay={150} size={22}>Tête à droite</Chip><Chip tone="green" delay={185} size={22}>Tête à gauche</Chip><Chip tone="gold" delay={220} size={22}>Main devant</Chip>
          </div>
        </div>
        {/* écran scindé */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, opacity: split, transform: `translateX(${(1 - split) * 200}px)` }}>
          <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 60px rgba(27,32,50,.2)' }}>
            <Call src={A} name="Vrai visage" w={560}>{hand > 0 && <Hand p={hand} />}</Call>
          </div>
          <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 60px rgba(27,32,50,.2)' }}>
            <Call src={B} name="Visage substitué" w={560}>
              {/* le masque reste dessiné sous la main : il se déchire */}
              <Img src={staticFile(A)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(${18 + tear * 6}% ${30 - tear * 10}% ${22 + tear * 10}% ${30 + tear * 14}% round 50%)`, filter: 'saturate(.8) contrast(1.1)', transform: `translateX(${tear * 26}px) rotate(${tear * 6}deg)`, opacity: 1 - tear * 0.3 }} />
              {hand > 0 && <Hand p={hand} />}
            </Call>
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 72, bottom: 126 }}><Note at={100}>MediaPipe FaceLandmarker · 478 repères · HandLandmarker · 21 par main · dans le navigateur</Note></div>
      <Tag text="Illustration" />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center' }}>
        <Words text="La main traverse le masque." start={360} step={4} size={44} weight={700} width={1500} accent={['masque']} sfx={false} />
      </div>
    </Scene>
  );
};
