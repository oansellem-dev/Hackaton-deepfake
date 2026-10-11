import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { ease, io, smooth } from '../components/anim';
import { Badge, Caption, Pop, Rail, Rise, Scene, TechNote } from '../components/Base';
import { Browser, C, MONO, OvalScan, Pill, SHADOW } from '../components/Ui';

/* S6 · L'environnement 1:10–1:20 : enumerateDevices(), OBS barré, fuseau, IP */
export const S6 = () => {
  const frame = useCurrentFrame();
  const cams = [
    { n: 'FaceTime HD Camera', ok: true },
    { n: 'OBS Virtual Camera', ok: false },
    { n: 'ManyCam Virtual Webcam', ok: false },
  ];
  return (
    <Scene>
      <Rail active={1} walls={1} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 80, paddingTop: 60 }}>
        <div style={{ width: 760, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Rise><div style={{ fontFamily: MONO, fontSize: 24, color: C.ink3 }}>navigator.mediaDevices.enumerateDevices()</div></Rise>
          {cams.map((c, i) => {
            const at = 30 + i * 28;
            const strike = c.ok ? 0 : io(frame, at + 40, at + 60, 0, 1, ease.out);
            return (
              <Rise key={c.n} delay={at}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: '#fff', padding: '20px 26px', borderRadius: 18, boxShadow: SHADOW, fontSize: 30, fontWeight: 600, position: 'relative' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 8, background: c.ok ? C.green : C.red }} />
                  <span style={{ flex: 1 }}>{c.n}</span>
                  <span style={{ fontSize: 22, color: c.ok ? C.greenText : C.goldText, fontWeight: 700 }}>{c.ok ? 'vraie caméra' : 'virtuelle · refusée'}</span>
                  {!c.ok && <div style={{ position: 'absolute', left: 60, top: '50%', height: 4, width: 420 * strike, background: C.red, borderRadius: 2 }} />}
                </div>
              </Rise>
            );
          })}
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            <Pop delay={140}><Pill tone="blue">Fuseau horaire · Europe/Paris</Pill></Pop>
            <Pop delay={160}><Pill tone="blue">Adresse IP · pays déclaré</Pill></Pop>
          </div>
          <Rise delay={190}><TechNote>motifs : OBS · ManyCam · DeepFaceLive · Snap Camera</TechNote></Rise>
        </div>
        <Rise delay={20}><Browser src="captures/cand-visage.png" url="oval-moteur.onrender.com/check/…" width={820} zoom={1.3} x={300} y={0} /></Rise>
      </AbsoluteFill>
      <Caption at={20} text="Caméra virtuelle remplacée ou refusée. Fuseau et adresse IP relevés." />
    </Scene>
  );
};

/* S7 · Le visage 1:20–1:38 : ovale, maillage, main, écran scindé vrai / substitué */
const MESH = Array.from({ length: 120 }, (_, i) => {
  const a = (i / 120) * Math.PI * 2, r = 0.55 + ((i * 37) % 17) / 40;
  return { x: 0.5 + Math.cos(a) * r * 0.36 * (0.7 + ((i * 13) % 7) / 20), y: 0.5 + Math.sin(a) * r * 0.42 };
});
const Face = ({ src, w, torn = 0, meshP = 0, hand = 0 }: { src: string; w: number; torn?: number; meshP?: number; hand?: number }) => (
  <div style={{ width: w, height: w * 1.25, borderRadius: 28, overflow: 'hidden', position: 'relative', background: '#0f1322', boxShadow: SHADOW }}>
    <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', transform: `scale(1.3) translateX(${torn * 18}px)`, clipPath: torn > 0 ? `polygon(0 0, 100% 0, 100% ${45 - torn * 10}%, ${50 + torn * 30}% ${50 + torn * 8}%, 100% ${58 + torn * 8}%, 100% 100%, 0 100%)` : undefined }} />
    {torn > 0 && <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', transform: `scale(1.3) translateX(${-torn * 30}px)`, filter: 'hue-rotate(40deg) saturate(.5)', clipPath: `polygon(0 ${45 - torn * 10}%, 100% ${45 - torn * 10}%, ${50 + torn * 30}% ${50 + torn * 8}%, 100% ${58 + torn * 8}%, 0 ${58 + torn * 8}%)`, opacity: torn }} />}
    <svg viewBox="0 0 100 125" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      {MESH.map((p, i) => <circle key={i} cx={p.x * 100} cy={p.y * 125} r={0.7} fill={C.green} opacity={Math.max(0, Math.min(1, meshP * 140 - i))} />)}
      {MESH.slice(0, 60).map((p, i) => { const q = MESH[(i * 7 + 3) % MESH.length]; return <line key={`l${i}`} x1={p.x * 100} y1={p.y * 125} x2={q.x * 100} y2={q.y * 125} stroke={C.green} strokeWidth={0.25} opacity={Math.max(0, Math.min(0.6, meshP * 60 - i)) * 0.8} />; })}
    </svg>
    {hand > 0 && (
      <div style={{ position: 'absolute', left: `${-40 + hand * 120}%`, top: '30%', width: '60%', height: '50%', borderRadius: '45% 45% 40% 40%', background: 'linear-gradient(180deg,#e8b89a,#c98f6c)', boxShadow: '0 20px 40px rgba(0,0,0,.4)', transform: `rotate(${-20 + hand * 10}deg)` }} />
    )}
  </div>
);
export const S7 = () => {
  const frame = useCurrentFrame();
  const oval = io(frame, 10, 70, 0, 1, ease.inOut);
  const meshP = io(frame, 60, 150);
  const hand = io(frame, 300, 420, 0, 1, ease.inOut);
  const torn = io(frame, 350, 400, 0, 1, ease.out);
  const split = io(frame, 240, 290, 0, 1, ease.inOut);
  const pixel = io(frame, 500, 540, 0, 1);
  return (
    <Scene style={{ filter: pixel > 0 ? `blur(${pixel * 14}px) contrast(${1 + pixel})` : undefined }}>
      <Rail active={2} walls={1} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 60, paddingBottom: 90 }}>
        {/* gauche : l'ovale de cadrage sur le vrai candidat */}
        <div style={{ position: 'relative', transform: `translateX(${split * -120}px)` }}>
          <Face src="avatars/camille.webp" w={440} meshP={meshP} hand={hand} />
          <div style={{ position: 'absolute', left: -40, top: -30 }}><OvalScan progress={oval} size={520} /></div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: -70, display: 'flex', justifyContent: 'center', gap: 10 }}>
            {['Tête à droite', 'Tête à gauche', 'Main devant'].map((t, i) => <Pop key={t} delay={160 + i * 40}><Pill tone={i === 2 ? 'gold' : 'green'} style={{ fontSize: 22 }}>{t}</Pill></Pop>)}
          </div>
        </div>
        {/* droite : écran scindé vrai / substitué */}
        <div style={{ display: 'flex', gap: 24, opacity: split, transform: `translateX(${(1 - split) * 200}px)` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}><Face src="avatars/camille.webp" w={330} hand={hand} /><Pill tone="green">Vrai visage</Pill></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}><Face src="avatars/leo.webp" w={330} hand={hand} torn={torn} /><Pill tone="red">Visage substitué</Pill></div>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 96, bottom: 140 }}><TechNote delay={100}>MediaPipe FaceLandmarker · 478 repères · HandLandmarker · 21 par main · dans le navigateur</TechNote></div>
      <Badge text="Illustration" pos="tr" />
      <Caption at={20} text="La main traverse le masque. Tout est analysé dans le navigateur." />
    </Scene>
  );
};
