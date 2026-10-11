import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { ease, io, typed } from '../components/anim';
import { Scene } from '../components/Base';
import { C, MONO } from '../components/Ui';
import { BG, Chip, Crop, Float, Laptop, Note, Rail, Sfx, Words } from '../components/Kit';

/* S4 · Le lien 0:40–0:52 — l'ordi s'ouvre sur le planning, les cartes sortent de l'écran, l'e-mail part */
export const S4 = () => {
  const frame = useCurrentFrame();
  const open = io(frame, 4, 36, 0, 1, ease.expo);
  const away = io(frame, 210, 250, 0, 1, ease.expo); // l'ordi s'écarte, l'e-mail arrive
  const token = 'kvhwHIJn9vBi8ASGC9D9DTPr6z9lZHm2';
  return (
    <Scene style={{ background: BG }} fade={0}>
      <Rail active={0} walls={0} />
      <Sfx name="whoosh" at={4} volume={0.6} />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 50 }}>
        <div style={{ position: 'relative', transform: `translateX(${away * -380}px) scale(${1 - away * 0.22})` }}>
          <Laptop w={1120} open={open} tilt={8} src="captures/dash-calendrier.png">
            {/* cartes qui sortent de l'écran */}
            <Float delay={70} x={-300} y={120} rot={-6} depth={1.2}><Crop src="captures/dash-calendrier-fiche.png" sx={575} sy={318} sw={345} sh={226} w={400} /></Float>
            <Float delay={95} x={860} y={-40} rot={5} depth={0.9}><Crop src="captures/dash-accueil.png" sx={268} sy={478} sw={790} sh={125} w={520} /></Float>
            <Float delay={120} x={900} y={330} rot={-3} depth={1}><Crop src="captures/dash-nouvel-entretien.png" sx={692} sy={76} sw={508} sh={430} w={360} /></Float>
          </Laptop>
        </div>
        {/* l'e-mail */}
        <div style={{ position: 'absolute', right: 100, top: 230, width: 720, opacity: away, transform: `translateX(${(1 - away) * 240}px)` }}>
          <div style={{ background: '#fff', borderRadius: 28, boxShadow: '0 40px 90px rgba(27,32,50,.2)', padding: 34, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: C.ink3 }}><span>De : Oval · Jules Espy</span><span>À : camille.royer@…</span></div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>Deux minutes avant votre entretien</div>
            <div style={{ fontSize: 22, color: C.ink2, lineHeight: 1.4 }}>Bonjour Camille, Secure Horizons vous propose une courte vérification avant l'entretien de jeudi à 10:00.</div>
            <div style={{ background: C.ink, color: '#fff', borderRadius: 999, padding: '16px 26px', fontWeight: 700, fontSize: 24, alignSelf: 'flex-start' }}>Commencer la vérification (2 min)</div>
            <div style={{ fontFamily: MONO, fontSize: 19, color: C.blueText, wordBreak: 'break-all', minHeight: 26 }}>/check/{typed(token, frame, 255, 44)}</div>
          </div>
          <div style={{ position: 'absolute', right: -24, top: -36, transform: 'rotate(-8deg)' }}>
            <Chip tone="red" delay={330} size={22}><span style={{ fontFamily: MONO, letterSpacing: 1 }}>USAGE UNIQUE · 24 H</span></Chip>
          </div>
        </div>
      </AbsoluteFill>
      {Array.from({ length: 8 }, (_, i) => <Sfx key={i} name="tick" at={255 + i * 4} volume={0.25} />)}
      <div style={{ position: 'absolute', left: 72, bottom: 150 }}><Note at={270}>jeton 32 caractères · CANDIDATE_LINK_TTL_HOURS = 24 · une seule ouverture</Note></div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center' }}>
        <Words text="Le RH crée l'entretien. Le candidat reçoit un lien unique." start={30} step={3} size={40} weight={700} width={1500} accent={['unique']} sfx={false} />
      </div>
    </Scene>
  );
};
