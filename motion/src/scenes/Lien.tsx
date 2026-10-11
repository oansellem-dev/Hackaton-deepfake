import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { ease, io, typed } from '../components/anim';
import { Caption, Pop, Rail, Rise, Scene, TechNote } from '../components/Base';
import { Browser, C, MONO, Pill, SHADOW } from '../components/Ui';

/* S4 · Le lien 0:40–0:52 : dashboard, planning, création, e-mail tamponné */
export const S4 = () => {
  const frame = useCurrentFrame();
  const swap = io(frame, 120, 150);
  const slide = io(frame, 200, 240, 0, 1, ease.inOut);
  const token = 'kvhwHIJn9vBi8ASGC9D9DTPr6z9lZHm2';
  return (
    <Scene>
      <Rail active={0} walls={0} />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
        <div style={{ position: 'relative', width: 1500, height: 844, transform: `translateX(${-slide * 420}px) scale(${1 - slide * 0.25})`, transformOrigin: 'left center' }}>
          <Rise><Browser src="captures/dash-calendrier.png" url="localhost:5174/#/" zoom={1 + io(frame, 0, 120, 0, 0.12)} x={io(frame, 0, 120, 0, 80)} y={io(frame, 0, 120, 0, 40)} /></Rise>
          <div style={{ position: 'absolute', inset: 0, opacity: swap }}><Browser src="captures/dash-nouvel-entretien.png" url="localhost:5174/#/" zoom={1.1} x={120} y={0} /></div>
        </div>
        {/* l'e-mail part */}
        <div style={{ position: 'absolute', right: 120, top: 240, width: 760, opacity: slide, transform: `translateX(${(1 - slide) * 200}px)` }}>
          <div style={{ background: '#fff', borderRadius: 28, boxShadow: SHADOW, padding: 36, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: C.ink3 }}><span>De : Oval · Jules Espy</span><span>À : camille.royer@…</span></div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Deux minutes avant votre entretien</div>
            <div style={{ fontSize: 24, color: C.ink2, lineHeight: 1.4 }}>Bonjour Camille, Secure Horizons vous propose une courte vérification avant l'entretien de jeudi à 10:00.</div>
            <div style={{ background: C.ink, color: '#fff', borderRadius: 999, padding: '18px 28px', fontWeight: 700, fontSize: 26, alignSelf: 'flex-start' }}>Commencer la vérification (2 min)</div>
            <div style={{ fontFamily: MONO, fontSize: 20, color: C.blueText, wordBreak: 'break-all' }}>/check/{typed(token, frame, 250, 40)}</div>
          </div>
          {/* tampon */}
          <Pop delay={330} style={{ position: 'absolute', right: -30, top: -40, transform: 'rotate(-8deg)' }}>
            <div style={{ border: `5px solid ${C.red}`, color: C.red, fontFamily: MONO, fontWeight: 800, fontSize: 26, padding: '10px 18px', borderRadius: 12, background: 'rgba(255,255,255,.85)', letterSpacing: 1 }}>USAGE UNIQUE · 24 H</div>
          </Pop>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 96, bottom: 150 }}><TechNote delay={260}>jeton 32 caractères · CANDIDATE_LINK_TTL_HOURS = 24 · une seule ouverture</TechNote></div>
      <Caption at={20} text="Le RH crée l'entretien. Le candidat reçoit un lien unique." />
    </Scene>
  );
};
