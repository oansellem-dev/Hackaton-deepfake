import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { ease, io, smooth, typed } from '../components/anim';
import { Badge, Caption, KineticTitle, Rail, Rise, Scene, STEPS, TechNote } from '../components/Base';
import { C, FONT, Logo, Manta, MONO, Pill, SHADOW } from '../components/Ui';

/** Cadre de visio : une vignette de candidat avec nom et micro. */
const Visio = ({ src, name, w = 900, glitch = 0, children }: { src: string; name: string; w?: number; glitch?: number; children?: React.ReactNode }) => (
  <div style={{ width: w, height: (w * 9) / 16, borderRadius: 28, overflow: 'hidden', position: 'relative', background: '#0f1322', boxShadow: SHADOW }}>
    <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', transform: 'scale(1.15)' }} />
    {glitch > 0 && (
      <>
        <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', transform: `scale(1.15) translateX(${glitch * 10}px)`, mixBlendMode: 'screen', opacity: 0.7, filter: 'url(#r)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: `${30 + glitch * 20}%`, height: 24 * glitch, background: 'rgba(52,99,234,.35)', transform: `translateX(${glitch * 40}px)` }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: `${62 - glitch * 10}%`, height: 10 * glitch, background: 'rgba(226,87,76,.4)', transform: `translateX(${-glitch * 60}px)` }} />
      </>
    )}
    <div style={{ position: 'absolute', left: 24, bottom: 20, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,.45)', color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 22, fontWeight: 600 }}>
      <i style={{ width: 10, height: 10, borderRadius: 5, background: C.green }} />{name}
    </div>
    {children}
  </div>
);

/* S1 · Accroche 0:00–0:12 */
export const S1 = () => {
  const frame = useCurrentFrame();
  const lines = ['Il a le CV parfait.', 'Il répond à tout.', 'Il sourit au bon moment.', "Il n'existe pas."];
  const glitch = frame > 250 ? Math.max(0, Math.sin(frame * 1.7)) * io(frame, 250, 300) : 0;
  const tear = io(frame, 330, 360, 0, 1, ease.in);
  return (
    <Scene dark>
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 120px' }}>
        <div style={{ transform: `translateX(${tear * -400}px) skewX(${tear * -8}deg)`, opacity: 1 - tear }}>
          <Visio src="avatars/leo.webp" name="Candidat · Développeur" glitch={glitch} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, width: 640 }}>
          {lines.map((l, i) => {
            const at = 20 + i * 70;
            const p = smooth(frame, 30, at);
            const last = i === 3;
            return <div key={l} style={{ fontSize: last ? 64 : 48, fontWeight: last ? 800 : 600, color: last ? C.gold : '#f3f5f9', opacity: p, transform: `translateY(${(1 - p) * 30}px)`, letterSpacing: -1 }}>{l}</div>;
          })}
        </div>
      </AbsoluteFill>
      <Badge text="Reconstitution" dark />
    </Scene>
  );
};

/* S2 · Le problème 0:12–0:25 */
export const S2 = () => {
  const frame = useCurrentFrame();
  const peel = io(frame, 40, 130, 0, 1, ease.inOut);
  const badge = io(frame, 180, 330, 0, 1, ease.inOut);
  return (
    <Scene dark>
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 100, padding: '0 120px' }}>
        <div style={{ position: 'relative', width: 820, height: 461 }}>
          <div style={{ position: 'absolute', inset: 0 }}><Visio src="avatars/hugo.webp" name="Celui qui parle vraiment" w={820} /></div>
          {/* le masque : le visage affiché se décolle */}
          <div style={{ position: 'absolute', inset: 0, transformOrigin: 'left center', transform: `perspective(1600px) rotateY(${peel * -70}deg) translateX(${peel * -40}px)`, opacity: 1 - peel * 0.6, boxShadow: peel > 0 ? '20px 0 60px rgba(0,0,0,.5)' : 'none', borderRadius: 28 }}>
            <Visio src="avatars/leo.webp" name="Celui qu'on voit" w={820} />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: -70, display: 'flex', justifyContent: 'center', opacity: io(frame, 120, 140) }}><Pill tone="gold">Deepfake en direct</Pill></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34, width: 700 }}>
          <KineticTitle text="Un autre visage. Vos accès. Vos données." size={66} delay={10} color="#f3f5f9" width={700} />
          <Rise delay={150}>
            <div style={{ position: 'relative', height: 120 }}>
              <div style={{ position: 'absolute', left: badge * 420, top: 0, display: 'flex', alignItems: 'center', gap: 14, background: '#fff', color: C.ink, padding: '16px 24px', borderRadius: 18, fontWeight: 700, fontSize: 26, boxShadow: SHADOW }}>
                <span style={{ width: 44, height: 44, borderRadius: 10, background: C.blueSoft, display: 'grid', placeItems: 'center', color: C.blueText, fontFamily: MONO }}>ID</span>Badge d'accès
              </div>
            </div>
          </Rise>
          <Rise delay={250}><div style={{ fontSize: 40, fontWeight: 700, color: C.gold }}>Le KYC existe partout… sauf en visio.</div></Rise>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

/* S3 · Oval en une phrase 0:25–0:40 */
export const S3 = () => {
  const frame = useCurrentFrame();
  const nodes = ['Dashboard RH', 'Lien', 'Infos', 'Visage', 'Visio', 'Rapport'];
  const railUp = io(frame, 380, 440, 0, 1, ease.inOut);
  return (
    <Scene>
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44, opacity: 1 - railUp }}>
        <Rise delay={0} style={{ display: 'flex', alignItems: 'center', gap: 24 }}><Logo size={110} /><span style={{ fontSize: 110, fontWeight: 800, letterSpacing: -4 }}>Oval</span></Rise>
        <KineticTitle text="Une présence humaine, pas une identité." size={68} delay={14} align="center" width={1500} />
        <Rise delay={70}><Manta frame={frame} say="Avant l'entretien, puis pendant. Le RH décide." /></Rise>
        {/* parcours */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 20 }}>
          {nodes.map((n, i) => {
            const p = smooth(frame, 30, 150 + i * 16);
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ opacity: p, transform: `scale(${0.6 + p * 0.4})`, background: i === 0 ? C.ink : '#fff', color: i === 0 ? '#fff' : C.ink, fontWeight: 700, fontSize: 28, padding: '18px 30px', borderRadius: 999, boxShadow: SHADOW }}>{n}</div>
                {i < nodes.length - 1 && <div style={{ width: 70, height: 6, background: C.blue, borderRadius: 3, transformOrigin: 'left', transform: `scaleX(${io(frame, 158 + i * 16, 170 + i * 16)})` }} />}
              </div>
            );
          })}
        </div>
        <Rise delay={280}><TechNote>pré-vérification 2 min · widget sur Meet, Zoom, Teams · décision tracée</TechNote></Rise>
      </AbsoluteFill>
      {/* le rail se fixe en haut */}
      <div style={{ opacity: railUp }}><Rail active={-1} walls={0} y={(1 - railUp) * 300} /></div>
    </Scene>
  );
};
