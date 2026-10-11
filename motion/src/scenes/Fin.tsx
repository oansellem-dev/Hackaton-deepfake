import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { ease, io, smooth } from '../components/anim';
import { Caption, KineticTitle, Pop, Rail, Rise, Scene, TechNote } from '../components/Base';
import { Browser, C, Gauge, Logo, Pill, SHADOW } from '../components/Ui';

/* S11 · Le score et le rapport 2:36–2:50 */
export const S11 = () => {
  const frame = useCurrentFrame();
  const score = io(frame, 40, 130, 100, 71, ease.out);
  const lines = [
    { t: 'Défi « main devant le visage » réussi', tone: 'green' as const },
    { t: 'Indicatif téléphonique ≠ pays déclaré', tone: 'gold' as const },
    { t: 'Profil GitHub introuvable : sans effet', tone: 'neutral' as const },
  ];
  return (
    <Scene>
      <Rail active={4} walls={4} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 60, paddingTop: 60 }}>
        <Rise><Browser src="captures/dash-rapport.png" url="localhost:5174/#/rapport/…" width={1000} zoom={1.15} x={120} y={0} /></Rise>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, background: '#fff', borderRadius: 28, padding: 26, boxShadow: SHADOW }}>
            <Gauge value={score} size={200} tone={C.gold} label="consultatif" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {lines.map((l, i) => <Pop key={l.t} delay={60 + i * 30}><Pill tone={l.tone} style={{ fontSize: 23 }}>{l.t}</Pill></Pop>)}
            </div>
          </div>
          <Rise delay={180}><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Poursuivre le recrutement', 'Refaire un défi au prochain échange', 'Proposer un entretien en présentiel'].map((d, i) => <div key={d} style={{ background: i === 0 ? C.ink : '#fff', color: i === 0 ? '#fff' : C.ink, fontSize: 24, fontWeight: 700, padding: '14px 26px', borderRadius: 999, boxShadow: SHADOW }}>{d}</div>)}
          </div></Rise>
          <Rise delay={240}><TechNote>seules les contradictions comptent · une absence n'a aucun effet · décision tracée (RGPD art. 22)</TechNote></Rise>
        </div>
      </AbsoluteFill>
      <Caption at={20} text="Un indice expliqué ligne par ligne. Le RH décide." />
    </Scene>
  );
};

/* S12 · Conclusion 2:50–3:00 : 4 portes → ovale → logo → fondu au blanc */
export const S12 = () => {
  const frame = useCurrentFrame();
  const gather = io(frame, 40, 110, 0, 1, ease.inOut);
  const fold = io(frame, 110, 160, 0, 1, ease.inOut);
  const logo = smooth(frame, 30, 150);
  const white = io(frame, 260, 300);
  return (
    <Scene dark fade={12}>
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* les quatre portes */}
        {[0, 1, 2, 3].map((i) => {
          const x0 = -600 + i * 400, x1 = 0;
          const x = x0 + (x1 - x0) * gather;
          return <div key={i} style={{ position: 'absolute', width: 180 - fold * 120, height: 320 - fold * 100, borderRadius: fold * 120, background: C.card, transform: `translateX(${x}px) rotate(${fold * (i - 1.5) * 90}deg)`, opacity: 1 - fold, boxShadow: SHADOW, display: 'grid', placeItems: 'center', fontSize: 60, fontWeight: 800, color: C.ink }}>{i + 1}</div>;
        })}
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, opacity: logo, transform: `scale(${0.8 + logo * 0.2})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}><Logo size={140} color="#f3f5f9" /><span style={{ fontSize: 140, fontWeight: 800, letterSpacing: -5, color: '#f3f5f9' }}>Oval</span></div>
          <div style={{ fontSize: 44, fontWeight: 600, color: 'rgba(243,245,249,.8)' }}>Un vrai visage derrière chaque écran.</div>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center', opacity: 1 - fold }}>
        <KineticTitle text="Quatre murs. Quatre solutions. Une question." size={64} align="center" width={1500} color="#f3f5f9" />
      </div>
      <Caption dark at={60} text="La personne en face de vous est-elle vraiment là ?" />
      <AbsoluteFill style={{ background: '#fff', opacity: white }} />
    </Scene>
  );
};
