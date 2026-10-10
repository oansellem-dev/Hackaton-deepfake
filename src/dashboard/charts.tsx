/* Courbe et jauge en SVG, réutilisées par le dashboard, le rapport et le panneau. */

export function Courbe({ serie, serie2, serie3, mois = ["Juin", "Sept.", "Déc."], height = 250 }: { serie: number[]; serie2: number[]; serie3: number[]; mois?: string[]; height?: number }) {
  const W = 300, H = height, padL = 8, padR = 60, padT = 26, padB = 22;
  const max = 40;
  const x = (i: number, n: number) => padL + (i * (W - padL - padR)) / (n - 1);
  const y = (v: number) => H - padB - (v / max) * (H - padT - padB);
  const path = (s: number[]) => {
    const pts = s.map((v, i) => [x(i, s.length), y(v)] as const);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      d += ` C${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  };
  const last = serie.length - 1;
  const lx = x(last, serie.length), ly = y(serie[last]);
  const mx = mois.map((_, i) => x(Math.round((i * (serie.length - 1)) / (mois.length - 1)), serie.length));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <defs>
        <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f9e27a" stopOpacity=".9" /><stop offset="1" stopColor="#f9e27a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {mx.map((vx, i) => <line key={i} x1={vx} x2={vx} y1={padT + 6} y2={H - padB} stroke="rgba(0,0,0,.08)" />)}
      {mois.map((m, i) => <text key={m} x={mx[i]} y={14} fontSize="10.5" fill="#8f8f8f" fontFamily="Lexend" fontWeight="300">{m}</text>)}
      {[20, 40].map((v) => <line key={v} x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="rgba(0,0,0,.18)" strokeDasharray="1.5 4" />)}
      {[0, 20, 40].map((v) => <text key={v} x={W - padR + 8} y={y(v) + 3.5} fontSize="10" fill="#8f8f8f" fontFamily="Lexend" fontWeight="300">{v}</text>)}
      <text x={padL} y={H - 4} fontSize="10" fill="#8f8f8f" fontFamily="Lexend" fontWeight="300">12</text>
      <path d={`M${lx} ${ly} L${W + 40} ${ly - 90} L${W + 40} ${ly + 90} Z`} fill="url(#glow)" />
      <path d={path(serie3)} fill="none" stroke="rgba(0,0,0,.16)" strokeWidth="1.2" />
      <path d={path(serie2)} fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="1.2" />
      <path d={path(serie)} fill="none" stroke="#1b1b1b" strokeWidth="1.8" strokeLinecap="round" style={{ strokeDasharray: 900, strokeDashoffset: 900, animation: "draw 1.6s cubic-bezier(.2,.7,.2,1) .3s forwards" }} />
      <circle cx={lx} cy={ly} r="12" fill="#fff" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.12))" }} />
      <circle cx={lx} cy={ly} r="3" fill="#1b1b1b" />
      <style>{`@keyframes draw { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}

export function Jauge({ valeur, labels = ["À vérifier", "Non concluant", "Cohérent", "Vérifiée"], max = 100, compact = false }: { valeur: number; labels?: string[]; max?: number; compact?: boolean }) {
  const W = 320, H = 200, cx = 160, cy = 176, r = 126;
  const p = Math.max(0, Math.min(1, valeur / max));
  const ang = (t: number) => Math.PI + t * Math.PI;
  const pt = (t: number, rr = r) => [cx + rr * Math.cos(ang(t)), cy + rr * Math.sin(ang(t))] as const;
  const arc = (t0: number, t1: number, rr = r) => { const [x0, y0] = pt(t0, rr), [x1, y1] = pt(t1, rr); return `M${x0} ${y0} A${rr} ${rr} 0 ${t1 - t0 > .5 ? 1 : 0} 1 ${x1} ${y1}`; };
  const wedge = (t0: number, t1: number) => { const [x0, y0] = pt(t0, r + 4), [x1, y1] = pt(t1, r + 4); return `M${cx} ${cy} L${x0} ${y0} A${r + 4} ${r + 4} 0 0 1 ${x1} ${y1} Z`; };
  const [nx, ny] = pt(p, r + 6), [tx, ty] = pt(p, r + 40);
  return (
    <div className={`gauge ${compact ? "gauge--compact" : ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <defs><radialGradient id="wedge" cx="50%" cy="95%" r="75%"><stop offset="0" stopColor="#f9e27a" stopOpacity=".95" /><stop offset="1" stopColor="#f9e27a" stopOpacity="0" /></radialGradient></defs>
        <path d={wedge(Math.max(0, p - .2), Math.min(1, p + .05))} fill="url(#wedge)" />
        <path d={arc(0, 1)} fill="none" stroke="rgba(0,0,0,.3)" strokeWidth="1.5" strokeDasharray="1.5 5" />
        <path d={arc(0, 1, r - 16)} fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="1" strokeDasharray="1 4" />
        {!compact && labels.map((l, i) => { const t = (i + .5) / labels.length; const [x, y] = pt(t, r + 22); return <text key={l} className="gauge__label" x={x} y={y} textAnchor="middle" transform={`rotate(${t * 180 - 90} ${x} ${y})`}>{l}</text>; })}
        <line x1={nx} y1={ny} x2={tx} y2={ty} stroke="#1b1b1b" strokeWidth="1.5" />
        <circle cx={nx} cy={ny} r="13" fill="#fff" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.14))" }} />
        <circle cx={nx} cy={ny} r="3" fill="#1b1b1b" />
      </svg>
      <div className="gauge__num"><span className="dot-num">{valeur}</span><small>/{max}</small></div>
    </div>
  );
}
