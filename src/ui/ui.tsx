import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { flushSync } from "react-dom";
import type { Couleur } from "../store/types";
import { IcCheck, IcInfo, IcX } from "./icons";
import { useToasts } from "./toast";
import "./ui.css";

/* ── Boutons ─────────────────────────────────────────────────── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "now" | "glass" | "ghost" | "inset"; size?: "sm" | "md" | "lg"; block?: boolean; href?: string; newTab?: boolean; icon?: ReactNode };
export function Btn({ variant = "secondary", size = "md", block, href, newTab, icon, className = "", children, ...rest }: BtnProps) {
  const cls = `btn btn--${variant}${size !== "md" ? ` btn--${size}` : ""}${block ? " btn--block" : ""} ${className}`;
  if (href) return <a className={cls} href={href} target={newTab ? "_blank" : undefined} rel={newTab ? "noreferrer" : undefined} onClick={rest.onClick as never} aria-label={rest["aria-label"]}>{icon}{children}</a>;
  return <button type="button" className={cls} {...rest}>{icon}{children}</button>;
}
export function ICirc({ size, active, inset, badge, label, href, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "lg"; active?: boolean; inset?: boolean; badge?: number; label: string; href?: string }) {
  const cls = `icirc${size ? ` icirc--${size}` : ""}${active ? " icirc--active" : ""}${inset ? " icirc--inset" : ""} ${className}`;
  const inner = <>{children}{badge ? <span className="icirc__badge">{badge}</span> : null}</>;
  if (href) return <a className={cls} href={href} aria-label={label} title={label}>{inner}</a>;
  return <button type="button" className={cls} aria-label={label} title={label} {...rest}>{inner}</button>;
}

/* ── Pilules ─────────────────────────────────────────────────── */
export type Ton = "neutral" | "green" | "violet" | "blue" | "gold" | "navy" | "today" | "white" | "glass" | "soft-green" | "soft-violet" | "soft-blue" | "soft-gold";
export function Pill({ ton = "neutral", dot, icon, className = "", children }: { ton?: Ton; dot?: boolean; icon?: ReactNode; className?: string; children: ReactNode }) {
  return <span className={`pill${ton !== "neutral" ? ` pill--${ton}` : ""} ${className}`}>{dot && <i className="pill__dot" />}{icon}{children}</span>;
}

/* ── Barre de statut ────────────────────────────────────────── */
export type BarTon = "green" | "violet" | "blue" | "gold" | "navy" | "now" | "neutral";
export function Bar({ ton, icon, label, chip, attention, mode = "full", style, onClick, title, className = "" }: { ton: BarTon; icon?: ReactNode; label: string; chip?: string; attention?: boolean; mode?: "icon" | "label" | "full"; style?: CSSProperties; onClick?: () => void; title?: string; className?: string }) {
  const t = title ?? (chip ? `${label} · ${chip}` : label);
  return (
    <button type="button" className={`bar bar--${ton}${attention ? " bar--attention" : ""}${mode === "icon" ? " bar--compact" : ""} ${className}`} style={style} onClick={onClick} title={t} aria-label={t}>
      {icon && <span className="bar__ic">{icon}</span>}
      {mode !== "icon" && <span className="bar__label">{label}</span>}
      {mode === "full" && chip && <span className="pill pill--glass">• {chip}</span>}
    </button>
  );
}

/* ── Onglets à indicateur glissant ─────────────────────────── */
export interface TabItem { id: string; label: ReactNode; count?: number; icon?: ReactNode }
export function Tabs({ items, value, onChange, raised, pills }: { items: TabItem[]; value: string; onChange: (id: string) => void; raised?: boolean; pills?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ x: 0, w: 0 });
  const [pret, setPret] = useState(false);
  const mesurer = useCallback(() => {
    const el = value ? wrap.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(value)}"]`) : null;
    setInd(el ? { x: el.offsetLeft, w: el.offsetWidth } : { x: 0, w: 0 });
  }, [value]);
  useLayoutEffect(() => { mesurer(); }, [mesurer, items.length]);
  useEffect(() => {
    const r = requestAnimationFrame(() => setPret(true));
    const ro = new ResizeObserver(() => mesurer());
    if (wrap.current) ro.observe(wrap.current);
    document.fonts?.ready.then(() => mesurer());
    return () => { cancelAnimationFrame(r); ro.disconnect(); };
  }, [mesurer]);
  return (
    <div ref={wrap} className={`tabs${raised ? " tabs--raised" : ""}${pills ? " tabs--pills" : ""}${pret ? " is-ready" : ""}`} role="tablist">
      <span className="tabs__ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w, opacity: ind.w ? 1 : 0 }} aria-hidden />
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" data-id={t.id} className="tabs__tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}>
          {t.icon}{t.label}{t.count !== undefined && <span className="tabs__count">· {t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Menu déroulant ─────────────────────────────────────────── */
export function Pop({ button, children, align = "left", up, width }: { button: (p: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; up?: boolean; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div className="popw" ref={ref}>
      {button({ open, toggle: () => setOpen((o) => !o) })}
      {open && <div className={`panel popw__menu popw__menu--${align}${up ? " popw__menu--up" : ""} pop`} style={width ? { width } : undefined}>{children(close)}</div>}
    </div>
  );
}

/* ── Champs ─────────────────────────────────────────────────── */
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field__label">{label}</span>{children}{error ? <span className="field__error" role="alert"><IcInfo />{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}</label>;
}
export const Input = ({ error, className = "", ...p }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) => <input className={`field__ctl${error ? " field__ctl--error" : ""} ${className}`} aria-invalid={error || undefined} {...p} />;
export const Select = ({ className = "", ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={`field__ctl ${className}`} {...p} />;
export const Textarea = ({ className = "", ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={`field__ctl ${className}`} {...p} />;

/* ── Avatars ─────────────────────────────────────────────────── */
export function Avatar({ initiales, couleur, size, title }: { initiales: string; couleur: Couleur; size?: "sm" | "lg" | "xl"; title?: string }) {
  return <span className={`avatar avatar--${couleur}${size ? ` avatar--${size}` : ""}`} title={title} aria-label={title}>{initiales}</span>;
}
export function Avatars({ children }: { children: ReactNode }) { return <span className="avatars">{children}</span>; }

/* ── Modale ──────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, width }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel modal pop" role="dialog" aria-modal="true" aria-label={title} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <div className="modal__head"><h2 className="t-h2">{title}</h2><ICirc size="sm" label="Fermer" onClick={onClose}><IcX /></ICirc></div>
        {children}
      </div>
    </div>
  );
}

/* ── Messages discrets ──────────────────────────────────────── */
export function Toaster() {
  const liste = useToasts();
  return <div className="toaster" aria-live="polite">{liste.map((t) => <div key={t.id} className="toast"><span className="toast__ic"><IcCheck /></span>{t.texte}</div>)}</div>;
}

/* ── État vide ───────────────────────────────────────────────── */
export function Vide({ titre, texte, action }: { titre: string; texte?: string; action?: ReactNode }) {
  return <div className="empty"><strong>{titre}</strong>{texte && <p className="t-small">{texte}</p>}{action}</div>;
}

/** Réorganisation en douceur (View Transitions). Repli : exécution directe. */
export function transition(fn: () => void) {
  type VT = { ready?: Promise<unknown>; finished?: Promise<unknown>; updateCallbackDone?: Promise<unknown> };
  const d = document as Document & { startViewTransition?: (cb: () => void) => VT };
  if (!d.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { fn(); return; }
  const vt = d.startViewTransition(() => flushSync(fn));
  // Une transition sautée (deux clics rapides) rejette ses promesses : sans gravité, on l'ignore.
  [vt?.ready, vt?.finished, vt?.updateCallbackDone].forEach((p) => p?.catch(() => {}));
}
