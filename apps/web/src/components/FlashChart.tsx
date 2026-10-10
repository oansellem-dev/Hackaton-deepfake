import { FLASH_CSS, FLASH_LAGS_MS, type FlashAnalysis, type FlashRun } from '@kyc/shared';

const LINE = ['#d63031', '#00a36c', '#0984e3'];
const LABEL = ['rouge', 'vert', 'bleu'];

// Retire d'une série la moyenne et une courbe lente (t, t²) : on garde ce qui change d'une couleur à l'autre.
function withoutDrift(values: number[], times: number[]): number[] {
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const span = Math.max(1, Math.max(...times) - Math.min(...times));
  const x = times.map((t) => (t - mean) / span);
  const out = [...values];
  const basis: number[][] = [];
  for (const raw of [x.map(() => 1), x, x.map((v) => v * v)]) {
    const w = [...raw];
    for (const b of basis) {
      const d = w.reduce((s, v, i) => s + v * b[i], 0);
      for (let i = 0; i < w.length; i++) w[i] -= d * b[i];
    }
    const norm = Math.sqrt(w.reduce((s, v) => s + v * v, 0));
    if (norm < 1e-9) continue;
    const unit = w.map((v) => v / norm);
    basis.push(unit);
    const d = out.reduce((s, v, i) => s + v * unit[i], 0);
    for (let i = 0; i < out.length; i++) out[i] -= d * unit[i];
  }
  return out;
}

// En haut, les couleurs affichées par l'écran ; en dessous, la teinte mesurée sur le visage (rouge, vert, bleu),
// recalée du retard de la caméra. Un vrai visage : les courbes montent et descendent avec les bandes.
export function FlashTimeline({ run, analysis }: { run: FlashRun; analysis: FlashAnalysis }) {
  const W = 640;
  const H = 200;
  const PAD = 8;
  const BAND = 26;
  const t0 = run.shownAt[0];
  const t1 = run.endAt;
  const x = (t: number) => PAD + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * PAD);

  const points = run.samples
    .filter((s) => s.face && s.rgb[0] + s.rgb[1] + s.rgb[2] > 1e-4)
    .map((s) => {
      const sum = s.rgb[0] + s.rgb[1] + s.rgb[2];
      return { t: s.t - analysis.lagMs, c: [s.rgb[0] / sum, s.rgb[1] / sum, s.rgb[2] / sum] };
    })
    .filter((p) => p.t >= t0 && p.t <= t1);

  const times = points.map((p) => p.t);
  const series = points.length >= 4 ? [0, 1, 2].map((c) => withoutDrift(points.map((p) => p.c[c]), times)) : [];
  const maxAbs = Math.max(1e-6, ...series.flat().map(Math.abs));
  const top = PAD * 2 + BAND;
  const mid = top + (H - top - PAD) / 2;
  const y = (v: number) => mid - (v / maxAbs) * ((H - top - PAD) / 2);

  return (
    <figure className="flash-figure">
      <svg viewBox={`0 0 ${W} ${H}`} className="flash-chart" role="img" aria-label="Couleurs affichées et teinte mesurée">
        {run.segments.map((s, i) => {
          const end = i + 1 < run.segments.length ? run.shownAt[i + 1] : run.endAt;
          return <rect key={i} x={x(run.shownAt[i])} y={PAD} width={Math.max(0, x(end) - x(run.shownAt[i]))} height={BAND} fill={FLASH_CSS[s.color]} />;
        })}
        <line x1={PAD} x2={W - PAD} y1={mid} y2={mid} className="flash-axis" />
        {series.map((values, c) => (
          <polyline
            key={c}
            fill="none"
            stroke={LINE[c]}
            strokeWidth={1.6}
            points={values.map((v, i) => `${x(times[i]).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
          />
        ))}
      </svg>
      <figcaption className="muted">
        Bandes : couleurs affichées. Courbes : part de {LABEL.join(', ')} mesurée sur le visage, recalée de{' '}
        {analysis.lagMs} ms, dérive lente retirée. Un vrai visage suit les bandes ; une image injectée reste plate ou
        bouge sans rapport.
      </figcaption>
    </figure>
  );
}

// Accord selon le retard supposé de la caméra. La ligne pointillée : ce qu'atteint 1 % des suites prises au hasard.
export function FlashLagCurve({ analysis }: { analysis: FlashAnalysis }) {
  const W = 640;
  const H = 150;
  const PAD = 24;
  const maxLag = FLASH_LAGS_MS[FLASH_LAGS_MS.length - 1];
  const x = (lag: number) => PAD + (lag / maxLag) * (W - 2 * PAD);
  const y = (c: number) => PAD + ((1 - c) / 2) * (H - 2 * PAD);
  const pts = analysis.lagCurve.filter((p) => p.correlation !== null) as { lagMs: number; correlation: number }[];
  return (
    <figure className="flash-figure">
      <svg viewBox={`0 0 ${W} ${H}`} className="flash-chart" role="img" aria-label="Accord selon le retard de la caméra">
        <line x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} className="flash-axis" />
        <line x1={PAD} x2={W - PAD} y1={y(analysis.nullThreshold)} y2={y(analysis.nullThreshold)} className="flash-null" />
        <text x={W - PAD} y={y(analysis.nullThreshold) - 4} textAnchor="end" className="flash-label">
          hasard (1 %)
        </text>
        <polyline
          fill="none"
          stroke="#6c5ce7"
          strokeWidth={2}
          points={pts.map((p) => `${x(p.lagMs).toFixed(1)},${y(p.correlation).toFixed(1)}`).join(' ')}
        />
        {pts.length > 0 && <circle cx={x(analysis.lagMs)} cy={y(analysis.correlation)} r={4.5} fill="#6c5ce7" />}
        <text x={PAD} y={H - 6} className="flash-label">0 ms</text>
        <text x={W - PAD} y={H - 6} textAnchor="end" className="flash-label">{maxLag} ms</text>
        <text x={PAD} y={PAD - 8} className="flash-label">accord +1</text>
        <text x={PAD + 4} y={y(-1) - 4} className="flash-label">−1</text>
      </svg>
      <figcaption className="muted">
        Accord entre la suite affichée et la teinte mesurée, selon le retard supposé de la caméra. Un vrai visage dépasse
        nettement la ligne du hasard.
      </figcaption>
    </figure>
  );
}
