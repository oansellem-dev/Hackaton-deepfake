import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { ease, io, smooth } from '../components/anim';
import { Scene } from '../components/Base';
import { C, Gauge, LOGO } from '../components/Ui';
import { BG, Chip, Crop, Float, IconMorph, Note, Rail, Sfx, Words } from '../components/Kit';

/* S11 · Le score et le rapport 2:36–2:50 — le rapport s'agrandit, la jauge se remplit, trois décisions */
export const S11 = () => {
  const frame = useCurrentFrame();
  const grow = io(frame, 6, 40, 0, 1, ease.expo);
  const score = io(frame, 60, 140, 100, 71, ease.out);
  const lines = [{ t: 'Défi « main devant le visage » réussi', tone: 'green' as const }, { t: 'Indicatif téléphonique ≠ pays déclaré', tone: 'gold' as const }, { t: 'Profil GitHub introuvable : sans effet', tone: 'neutral' as const }];
  return (
    <Scene style={{ background: BG }} fade={0}>
      <Rail active={4} walls={4} />
      <Sfx name="whoosh" at={6} volume={0.6} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 60, paddingTop: 40 }}>
        <div style={{ transform: `scale(${0.4 + grow * 0.6})`, opacity: grow, borderRadius: 24, boxShadow: '0 40px 90px rgba(27,32,50,.22)' }}>
          <Crop src="captures/dash-rapport.png" sx={126} sy={26} sw={1630} sh={1010} w={1000} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'flex-start' }}>
          <Float delay={50} drift={4} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, background: '#fff', borderRadius: 28, padding: 24 }}>
              <Gauge value={score} size={190} tone={C.gold} label="consultatif" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{lines.map((l, i) => <Chip key={l.t} tone={l.tone} delay={70 + i * 26} size={22}>{l.t}</Chip>)}</div>
            </div>
          </Float>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Poursuivre le recrutement', 'Refaire un défi au prochain échange', 'Proposer un entretien en présentiel'].map((d, i) => (
              <Float key={d} delay={190 + i * 16} drift={0} sfx={i === 0} style={{ position: 'relative', boxShadow: '0 12px 30px rgba(27,32,50,.12)' }}>
                <div style={{ background: i === 0 ? C.ink : '#fff', color: i === 0 ? '#fff' : C.ink, fontSize: 23, fontWeight: 700, padding: '14px 26px', borderRadius: 999 }}>{d}</div>
              </Float>
            ))}
          </div>
          <Sfx name="click" at={300} />
          <Note at={250}>seules les contradictions comptent · une absence n'a aucun effet · décision tracée (RGPD art. 22)</Note>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center' }}>
        <Words text="Un indice expliqué ligne par ligne. Le RH décide." start={30} step={3} size={40} weight={700} width={1500} accent={['RH', 'décide']} sfx={false} />
      </div>
    </Scene>
  );
};

/* S12 · Conclusion 2:50–3:00 — quatre portes → icône → Oval, fondu au blanc */
export const S12 = () => {
  const frame = useCurrentFrame();
  const gather = io(frame, 30, 90, 0, 1, ease.inOut);
  const fold = io(frame, 90, 130, 0, 1, ease.inOut);
  const white = io(frame, 262, 300);
  return (
    <Scene style={{ background: BG }} fade={0}>
      {[0, 1, 2, 3].map((i) => <Sfx key={i} name="pop" at={6 + i * 8} volume={0.5} />)}
      <Sfx name="whoosh" at={90} volume={0.6} />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2, 3].map((i) => {
          const p = frame < 6 + i * 8 ? 0 : smooth(frame, 30, 6 + i * 8);
          const x0 = -570 + i * 380, x = x0 * (1 - gather);
          return <div key={i} style={{ position: 'absolute', width: 180, height: 320, borderRadius: 28 + fold * 100, background: C.ink, transform: `translateX(${x}px) scale(${p * (1 - fold * 0.6)}) rotate(${fold * (i - 1.5) * 60}deg)`, opacity: Math.min(1, p) * (1 - fold), display: 'grid', placeItems: 'center', fontSize: 64, fontWeight: 800, color: C.gold, boxShadow: '0 30px 70px rgba(27,32,50,.25)' }}>{i + 1}</div>;
        })}
        <div style={{ position: 'absolute', opacity: io(frame, 125, 135) }}><IconMorph at={130} size={260} /></div>
        <div style={{ position: 'absolute', top: 700, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <Words text="Un vrai visage derrière chaque écran." start={200} step={4} size={52} weight={700} width={1500} accent={['vrai']} />
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 140, display: 'flex', justifyContent: 'center', opacity: 1 - fold }}>
        <Words text="Quatre murs. Quatre solutions. Une question." start={10} step={5} size={64} width={1500} accent={['Une', 'question']} />
      </div>
      <AbsoluteFill style={{ background: '#fff', opacity: white }} />
    </Scene>
  );
};
