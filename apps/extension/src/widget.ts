/**
 * Widget flottant Oval (script de contenu, sans dépendance) : une bulle ronde posée sur la page de visio, que l'on
 * glisse où l'on veut ; un clic l'ouvre en carte avec le panneau recruteur (page /panel du site, dans un cadre).
 * Le cadre fait toute l'analyse (MediaPipe + ONNX) et renvoie ici le score pour l'anneau de la bulle.
 * Design Oval : blanc coussin, Manrope, bleu « maintenant », vert / doré pour les niveaux.
 */
const WEB_BASE: string = import.meta.env.VITE_WEB_URL ?? 'http://localhost:5173';
const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const LOGO = 'M120 4A116 116 0 0 1 208.9 194.6C192.8 213.8 154 218 154 240C154 262 192.8 266.2 208.9 285.4A116 116 0 0 1 120 476A116 116 0 0 1 31.1 285.4C47.2 266.2 86 262 86 240C86 218 47.2 213.8 31.1 194.6A116 116 0 0 1 120 4Z';

type Niveau = 'none' | 'green' | 'orange' | 'red';
interface Etat { sessionId: string; recruiterKey?: string; open: boolean; x: number; y: number; score: number | null; niveau: Niveau; live: boolean }

/* ── Stockage : chrome.storage dans l'extension, localStorage en aperçu ── */
const store = {
  async get(): Promise<Partial<Etat>> {
    try {
      if (globalThis.chrome?.storage?.local) return (await chrome.storage.local.get(['sessionId', 'recruiterKey', 'ovalWidget'])) as Partial<Etat> & { ovalWidget?: Partial<Etat> };
    } catch { /* aperçu */ }
    try { return JSON.parse(localStorage.getItem('ovalWidget') ?? '{}'); } catch { return {}; }
  },
  async set(p: Partial<Etat>) {
    try {
      if (globalThis.chrome?.storage?.local) {
        const { sessionId, recruiterKey, ...reste } = p;
        const prev = ((await chrome.storage.local.get('ovalWidget')).ovalWidget ?? {}) as Partial<Etat>;
        await chrome.storage.local.set({ ...(sessionId !== undefined ? { sessionId } : {}), ...(recruiterKey !== undefined ? { recruiterKey } : {}), ovalWidget: { ...prev, ...reste } });
        return;
      }
    } catch { /* aperçu */ }
    try { localStorage.setItem('ovalWidget', JSON.stringify({ ...JSON.parse(localStorage.getItem('ovalWidget') ?? '{}'), ...p })); } catch { /* ignore */ }
  },
};

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.w { position: fixed; z-index: 2147483000; font-family: "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif; color: #1b2032; font-size: 14px; line-height: 1.4; -webkit-font-smoothing: antialiased; user-select: none; }
.w * { font-family: inherit; }
/* Bulle */
.b { position: relative; width: 64px; height: 64px; border-radius: 50%; background: #f9fafd; display: grid; place-items: center; cursor: grab; border: 0; padding: 0;
  box-shadow: inset 1px 1px 0 rgba(255,255,255,.85), 6px 8px 24px rgba(62,74,110,.18), 1px 2px 5px rgba(62,74,110,.06); transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s; }
.b:hover { transform: translateY(-2px); box-shadow: inset 1px 1px 0 rgba(255,255,255,.85), 10px 14px 34px rgba(62,74,110,.22), 2px 3px 8px rgba(62,74,110,.08); }
.b.is-drag { cursor: grabbing; transform: scale(1.04); }
.b svg.logo { width: 22px; height: 42px; fill: #222; position: relative; z-index: 1; }
.b svg.ring { position: absolute; inset: 0; width: 64px; height: 64px; transform: rotate(-90deg); }
.b .ring circle { fill: none; stroke-width: 4; stroke-linecap: round; }
.b .ring .bg { stroke: rgba(27,32,50,.08); }
.b .ring .val { stroke: #3463ea; transition: stroke-dasharray .9s cubic-bezier(.2,.8,.2,1); }
.b.n-green .ring .val { stroke: #4cc792; } .b.n-orange .ring .val, .b.n-red .ring .val { stroke: #f0b63f; }
.b .dot { position: absolute; right: 2px; top: 2px; width: 14px; height: 14px; border-radius: 50%; background: #c3c9d8; box-shadow: 0 0 0 3px #f9fafd; }
.b.is-live .dot { background: #3fc088; animation: ping 1.8s ease-out infinite; }
@keyframes ping { 0% { box-shadow: 0 0 0 3px #f9fafd, 0 0 0 3px rgba(63,192,136,.5); } 100% { box-shadow: 0 0 0 3px #f9fafd, 0 0 0 12px rgba(63,192,136,0); } }
.b .badge { position: absolute; left: 50%; bottom: -8px; transform: translateX(-50%); padding: 2px 8px; border-radius: 999px; background: #1b2032; color: #fff; font-size: 11px; font-weight: 700; white-space: nowrap; }
.b.n-green .badge { background: #0f6b45; } .b.n-orange .badge, .b.n-red .badge { background: #5c3a00; }
/* Carte */
.c { width: 390px; height: min(640px, calc(100vh - 32px)); border-radius: 26px; background: #f3f5f9; display: flex; flex-direction: column; overflow: hidden;
  box-shadow: inset 1.5px 1.5px 0 rgba(255,255,255,.95), 20px 28px 64px rgba(62,74,110,.24), 4px 6px 14px rgba(62,74,110,.09); animation: pop .35s cubic-bezier(.22,1,.36,1) both; transform-origin: bottom right; }
@keyframes pop { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
.h { display: flex; align-items: center; gap: 10px; padding: 12px 12px 10px 16px; cursor: grab; }
.h.is-drag { cursor: grabbing; }
.h .logo { width: 12px; height: 24px; fill: #222; }
.h b { font-weight: 800; font-size: 16px; letter-spacing: -.02em; margin-right: auto; }
.h code { font-size: 11px; padding: 4px 8px; border-radius: 999px; background: #e8ebf2; color: #46506b; box-shadow: inset 2px 2px 6px rgba(62,74,110,.16), inset -1px -1px 0 rgba(255,255,255,.9); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.i { width: 34px; height: 34px; border-radius: 50%; border: 0; display: grid; place-items: center; background: #f9fafd; color: #1b2032; cursor: pointer; box-shadow: inset 1px 1px 0 rgba(255,255,255,.85), 6px 8px 24px rgba(62,74,110,.10), 1px 2px 5px rgba(62,74,110,.04); transition: transform .3s cubic-bezier(.22,1,.36,1); }
.i:hover { transform: translateY(-1.5px); } .i svg { width: 15px; height: 15px; }
.f { flex: 1; width: 100%; border: 0; background: #fff; border-radius: 22px 22px 0 0; }
/* Choix de l'entretien */
.s { flex: 1; display: grid; align-content: start; gap: 12px; padding: 8px 16px 18px; }
.s h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.02em; }
.s p { margin: 0; color: #46506b; font-size: 13.5px; }
.s input { width: 100%; padding: 12px 14px; border: 0; border-radius: 14px; background: #e8ebf2; color: #1b2032; font-size: 14px; font-weight: 500; box-shadow: inset 2px 2px 6px rgba(62,74,110,.16), inset -1px -1px 0 rgba(255,255,255,.9); outline: 0; }
.s input:focus { box-shadow: inset 2px 2px 6px rgba(62,74,110,.16), 0 0 0 2px #3463ea; background: #fff; }
.p { width: 100%; padding: 13px 18px; border: 0; border-radius: 999px; background: linear-gradient(135deg, #2a3147 0%, #161b2b 100%); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 10px 24px rgba(27,32,50,.32); transition: transform .3s cubic-bezier(.22,1,.36,1); }
.p:hover { transform: translateY(-1.5px); } .p:disabled { opacity: .5; cursor: default; transform: none; }
.g { width: 100%; padding: 12px 18px; border: 0; border-radius: 999px; background: #f9fafd; color: #1b2032; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: inset 1px 1px 0 rgba(255,255,255,.85), 6px 8px 24px rgba(62,74,110,.10); }
.or { display: flex; align-items: center; gap: 10px; color: #5e6880; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; } .or::before, .or::after { content: ""; flex: 1; height: 1px; background: rgba(27,32,50,.08); }
.err { color: #5c3a00; background: #fdf0c6; border-radius: 12px; padding: 8px 12px; font-size: 12.5px; }
.s a { color: #1f45b8; font-weight: 600; font-size: 13px; text-decoration: none; }
`;

const svg = (path: string, cls = '') => `<svg class="${cls}" viewBox="0 0 240 480" aria-hidden><path d="${path}"/></svg>`;
const ICO = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  min: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 12h12"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>',
};

class Widget {
  etat: Etat = { sessionId: '', open: false, x: -1, y: -1, score: null, niveau: 'none', live: false };
  host = document.createElement('div');
  root = this.host.attachShadow({ mode: 'open' });
  box = document.createElement('div');

  async init() {
    this.host.id = 'oval-widget';
    const style = document.createElement('style'); style.textContent = CSS;
    this.box.className = 'w';
    this.root.append(style, this.box);
    if (!document.querySelector('link[href*="Manrope"]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap'; document.head.append(l);
    }
    const saved = await store.get();
    const w = (saved as { ovalWidget?: Partial<Etat> }).ovalWidget ?? saved;
    this.etat = { ...this.etat, sessionId: saved.sessionId ?? '', recruiterKey: saved.recruiterKey, open: !!w.open, x: w.x ?? -1, y: w.y ?? -1 };
    document.body.append(this.host);
    addEventListener('message', (e) => this.onMessage(e));
    addEventListener('resize', () => this.placer());
    try { chrome.runtime?.onMessage?.addListener((m: { type?: string }) => { if (m?.type === 'oval:toggle') this.basculer(); }); } catch { /* aperçu */ }
    this.rendre();
  }

  placer() {
    const r = this.box.getBoundingClientRect();
    const x = this.etat.x < 0 ? innerWidth - r.width - 24 : Math.min(Math.max(8, this.etat.x), innerWidth - r.width - 8);
    const y = this.etat.y < 0 ? innerHeight - r.height - 24 : Math.min(Math.max(8, this.etat.y), innerHeight - r.height - 8);
    this.box.style.left = `${x}px`; this.box.style.top = `${y}px`; this.box.style.right = 'auto'; this.box.style.bottom = 'auto';
  }

  basculer(open = !this.etat.open) { this.etat.open = open; void store.set({ open }); this.rendre(); }

  /** Glisser : sur la bulle (un clic sans mouvement ouvre) et sur l'en-tête de la carte. */
  draggable(el: HTMLElement, onClick?: () => void) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = this.box.getBoundingClientRect(); const ox = e.clientX - r.left, oy = e.clientY - r.top; let moved = false;
      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
        moved = true; el.classList.add('is-drag');
        this.etat.x = ev.clientX - ox; this.etat.y = ev.clientY - oy; this.placer();
      };
      const up = () => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up); el.classList.remove('is-drag');
        if (moved) { const b = this.box.getBoundingClientRect(); this.etat.x = b.left; this.etat.y = b.top; void store.set({ x: b.left, y: b.top }); } else onClick?.();
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
  }

  onMessage(e: MessageEvent) {
    const d = e.data as { type?: string; value?: number; level?: string; evidence?: number; live?: boolean };
    if (d?.type === 'oval:toggle-local') { this.basculer(); return; }
    if (!d || d.type !== 'oval:score') return;
    const verified = (d.evidence ?? 0) > 0 || (d.level && d.level !== 'green');
    this.etat.score = verified && typeof d.value === 'number' ? d.value : null;
    this.etat.niveau = verified ? ((d.level as Niveau) ?? 'none') : 'none';
    this.etat.live = !!d.live;
    if (!this.etat.open) this.rendre();
  }

  panelUrl() { const { sessionId, recruiterKey } = this.etat; return `${WEB_BASE}/panel/${sessionId}${recruiterKey ? `?key=${recruiterKey}&` : '?'}widget=1`; }

  rendre() {
    const { open, sessionId, score, niveau, live } = this.etat;
    this.box.innerHTML = '';
    if (!open) {
      const b = document.createElement('button'); b.className = `b n-${niveau}${live ? ' is-live' : ''}`; b.title = 'Oval : ouvrir le panneau de vérification';
      const C = 2 * Math.PI * 28;
      b.innerHTML = `<svg class="ring" viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="28"/><circle class="val" cx="32" cy="32" r="28" stroke-dasharray="${score === null ? 0 : (score / 100) * C} ${C}"/></svg>${svg(LOGO, 'logo')}<i class="dot"></i>${score !== null ? `<span class="badge">${score}</span>` : ''}`;
      this.draggable(b, () => this.basculer(true));
      this.box.append(b);
    } else {
      const c = document.createElement('div'); c.className = 'c';
      const h = document.createElement('div'); h.className = 'h';
      h.innerHTML = `${svg(LOGO, 'logo')}<b>Oval</b>${sessionId ? `<code title="Entretien">${sessionId}</code><button class="i" title="Changer d'entretien">${ICO.swap}</button>` : ''}<button class="i" title="Réduire en bulle">${ICO.min}</button>`;
      this.draggable(h);
      h.querySelector('[title="Changer d\'entretien"]')?.addEventListener('click', () => { this.etat.sessionId = ''; this.etat.recruiterKey = undefined; this.etat.score = null; this.etat.niveau = 'none'; void store.set({ sessionId: '', recruiterKey: undefined }); this.rendre(); });
      h.querySelector('[title="Réduire en bulle"]')?.addEventListener('click', () => this.basculer(false));
      c.append(h);
      if (sessionId) {
        const f = document.createElement('iframe'); f.className = 'f'; f.src = this.panelUrl(); f.title = 'Panneau recruteur Oval'; f.allow = 'display-capture; camera; microphone';
        c.append(f);
      } else c.append(this.choix());
      this.box.append(c);
    }
    this.placer();
  }

  /** Aucun entretien choisi : coller le code donné par Oval, ou en créer un rapide. */
  choix(): HTMLElement {
    const s = document.createElement('div'); s.className = 's';
    s.innerHTML = `<h2>Quel entretien ?</h2><p>Collez le code donné par Oval (fiche de l'entretien → « Code extension »).</p>
      <input placeholder="identifiant:clé" autofocus /><button class="p" disabled>Ouvrir le panneau</button>
      <div class="or"><span>ou</span></div><button class="g">Créer un entretien rapide</button>
      <a href="http://localhost:5174/#/" target="_blank" rel="noreferrer">Ouvrir le tableau de bord Oval ↗</a><div class="err" hidden></div>`;
    const input = s.querySelector('input')!, ouvrir = s.querySelector<HTMLButtonElement>('.p')!, creer = s.querySelector<HTMLButtonElement>('.g')!, err = s.querySelector<HTMLElement>('.err')!;
    const choisir = (code: string) => { const [id, key] = code.trim().split(':'); if (!id) return; this.etat.sessionId = id; this.etat.recruiterKey = key; void store.set({ sessionId: id, recruiterKey: key }); this.rendre(); };
    input.addEventListener('input', () => { ouvrir.disabled = !input.value.includes(':'); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.includes(':')) choisir(input.value); });
    ouvrir.addEventListener('click', () => choisir(input.value));
    creer.addEventListener('click', async () => {
      err.hidden = true; creer.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateLabel: 'Candidat' }) });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as { id: string; recruiterKey: string }; choisir(`${j.id}:${j.recruiterKey}`);
      } catch { err.textContent = `Serveur Oval injoignable (${API_BASE}). Lancez npm run dev.`; err.hidden = false; creer.disabled = false; }
    });
    return s;
  }
}

if (!document.getElementById('oval-widget')) void new Widget().init();
else window.postMessage({ type: 'oval:toggle-local' }, '*');
