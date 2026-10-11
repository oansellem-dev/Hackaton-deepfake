import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { ease, io, smooth } from '../components/anim';
import { Scene } from '../components/Base';
import { C, Manta } from '../components/Ui';
import { BG, Call, Chip, Float, IconMorph, Laptop, Note, Rail, Sfx, Tag, Wipe, Words } from '../components/Kit';

const A = 'portraits/candidate-a.png', B = 'portraits/candidate-b.png';

/* S1 · Accroche 0:00–0:12 — l'ordinateur s'ouvre sur une visio, les mots claquent, le glitch trahit */
export const S1 = () => {
  const frame = useCurrentFrame();
  const open = io(frame, 6, 40, 0, 1, ease.expo);
  const glitch = frame > 250 && frame < 300 ? Math.abs(Math.sin(frame * 1.9)) * io(frame, 250, 262) : 0;
  const lift = io(frame, 40, 80, 0, 1, ease.expo);
  return (
    <Scene style={{ background: BG }} fade={0}>
      <Sfx name="whoosh" at={6} volume={0.6} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 90, padding: '0 110px' }}>
        <div style={{ transform: `translateY(${(1 - lift) * 40}px)` }}>
          <Laptop w={980} open={open} tilt={6} screen={<Call src={A} name="Camille R. · Candidate" w={980 - 24} glitch={glitch} style={{ borderRadius: 0, width: '100%', height: '100%' }} />} />
        </div>
        <div style={{ width: 640, display: 'flex', flexDirection: 'column', gap: 30 }}>
          <Words text="Il a le CV parfait." start={60} size={62} width={640} align="left" weight={700} />
          <Words text="Il répond à tout." start={125} size={62} width={640} align="left" weight={700} />
          <Words text="Il sourit au bon moment." start={190} size={62} width={640} align="left" weight={700} />
        </div>
      </AbsoluteFill>
      {glitch > 0 && <Sfx name="glitch" at={250} />}
      {/* Il n'existe pas : aplat navy qui balaie, phrase en or */}
      <Wipe color={C.ink} at={300} dur={14} from="bottom">
        <Words text="Il n'existe pas." start={312} step={6} size={150} color="#fff" accent={["n'existe"]} accentColor={C.gold} />
      </Wipe>
      <Tag text="Reconstitution" />
    </Scene>
  );
};

/* S2 · Le problème 0:12–0:25 — le visage se décolle, blocs de couleur, « sauf en visio » */
export const S2 = () => {
  const frame = useCurrentFrame();
  const peel = io(frame, 50, 120, 0, 1, ease.inOut);
  const slide = io(frame, 200, 240, 0, 1, ease.expo);
  return (
    <Scene style={{ background: C.ink }} fade={0}>
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 110px' }}>
        <div style={{ position: 'relative', width: 880, height: 495, transform: `translateX(${slide * -120}px) scale(${1 - slide * 0.12})` }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden', boxShadow: '0 40px 90px rgba(0,0,0,.45)' }}><Call src={B} name="Celui qui parle vraiment" w={880} /></div>
          <div style={{ position: 'absolute', inset: 0, transformOrigin: 'left center', transform: `perspective(1800px) rotateY(${peel * -75}deg)`, opacity: 1 - peel * 0.5, borderRadius: 24, overflow: 'hidden', boxShadow: peel > 0 ? '30px 0 80px rgba(0,0,0,.6)' : 'none' }}><Call src={A} name="Celui qu'on voit" w={880} /></div>
          <Sfx name="whoosh" at={50} volume={0.5} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: -64, display: 'flex', justifyContent: 'center' }}><Chip tone="gold" delay={110} size={26}>Deepfake en direct</Chip></div>
        </div>
        <div style={{ width: 620, display: 'flex', flexDirection: 'column', gap: 36 }}>
          <Words text="Un autre visage." start={20} size={64} width={620} align="left" color="#fff" />
          <Words text="Vos accès. Vos données." start={140} size={64} width={620} align="left" color="#fff" accent={['accès', 'données']} accentColor={C.gold} />
        </div>
      </AbsoluteFill>
      <Wipe color={C.blue} at={250} dur={14} from="left">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
          <Words text="Le KYC existe partout…" start={262} size={100} color="#fff" />
          <Words text="sauf en visio." start={300} step={6} size={130} color="#fff" accent={['visio']} accentColor={C.gold} />
        </div>
      </Wipe>
    </Scene>
  );
};

/* S3 · Oval 0:25–0:40 — icône → logo, promesse, parcours qui se dessine, rail qui s'installe */
export const S3 = () => {
  const frame = useCurrentFrame();
  const nodes = ['Dashboard RH', 'Lien', 'Infos', 'Visage', 'Visio', 'Rapport'];
  const dock = io(frame, 400, 440, 0, 1, ease.expo);
  return (
    <Scene style={{ background: BG }} fade={0}>
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 46, opacity: 1 - dock }}>
        <IconMorph at={8} size={220} />
        <Words text="Une présence humaine, pas une identité." start={80} size={76} width={1500} accent={['humaine']} />
        <div style={{ opacity: io(frame, 150, 165), transform: `translateY(${(1 - smooth(frame, 30, 150)) * 20}px)` }}><Manta frame={frame} size={96} say="Avant l'entretien, puis pendant. Le RH décide." /></div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
          {nodes.map((n, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
              <Chip tone={i === 0 ? 'dark' : 'neutral'} delay={210 + i * 14} size={26}>{n}</Chip>
              {i < nodes.length - 1 && <div style={{ width: 60, height: 5, margin: '0 6px', background: C.blue, borderRadius: 3, transformOrigin: 'left', transform: `scaleX(${io(frame, 218 + i * 14, 228 + i * 14)})` }} />}
            </div>
          ))}
        </div>
        <Note at={320}>pré-vérification 2 min · widget sur Meet, Zoom, Teams · décision tracée</Note>
      </AbsoluteFill>
      <div style={{ opacity: dock, transform: `translateY(${(1 - dock) * -60}px)` }}><Rail active={-1} walls={0} /></div>
      <Sfx name="whoosh" at={400} volume={0.5} />
    </Scene>
  );
};
