import { Composition, Sequence } from 'remotion';
import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { S1, S2, S3 } from './scenes/Intro';
import { S4 } from './scenes/Lien';
import { S6, S7 } from './scenes/Visage';
import { S10, S5, S8, S9 } from './scenes/Murs';
import { S11, S12 } from './scenes/Fin';

loadManrope('normal', { weights: ['400', '600', '700', '800'], subsets: ['latin', 'latin-ext'] });
loadMono('normal', { weights: ['400', '700', '800'], subsets: ['latin'] });

export const FPS = 30;
/** Storyboard V3 : 12 scènes, 180 s = 5 400 images. */
export const SCENES: { id: string; start: number; dur: number; C: React.FC }[] = [
  { id: 'S1 Accroche', start: 0, dur: 12, C: S1 },
  { id: 'S2 Problème', start: 12, dur: 13, C: S2 },
  { id: 'S3 Oval', start: 25, dur: 15, C: S3 },
  { id: 'S4 Lien', start: 40, dur: 12, C: S4 },
  { id: 'S5 Mur 1 LinkedIn', start: 52, dur: 18, C: S5 },
  { id: 'S6 Environnement', start: 70, dur: 10, C: S6 },
  { id: 'S7 Visage', start: 80, dur: 18, C: S7 },
  { id: 'S8 Mur 2 Photo', start: 98, dur: 20, C: S8 },
  { id: 'S9 Mur 3 Lumière', start: 118, dur: 18, C: S9 },
  { id: 'S10 Mur 4 Swap', start: 136, dur: 20, C: S10 },
  { id: 'S11 Rapport', start: 156, dur: 14, C: S11 },
  { id: 'S12 Conclusion', start: 170, dur: 10, C: S12 },
];
export const TOTAL = SCENES.reduce((n, s) => n + s.dur, 0) * FPS; // 5400

const OvalV3 = () => (
  <>
    {SCENES.map((s) => (
      <Sequence key={s.id} name={s.id} from={s.start * FPS} durationInFrames={s.dur * FPS}>
        <s.C />
      </Sequence>
    ))}
  </>
);

export const Root = () => (
  <>
    <Composition id="OvalV3" component={OvalV3} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    {SCENES.map((s) => (
      <Composition key={s.id} id={s.id.replace(/[^A-Za-z0-9]/g, '')} component={s.C} durationInFrames={s.dur * FPS} fps={FPS} width={1920} height={1080} />
    ))}
  </>
);
