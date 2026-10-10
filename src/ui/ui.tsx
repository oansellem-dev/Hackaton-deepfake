import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { Couleur } from "../store/types";
import { IcCheck, IcX } from "./icons";
import { useToasts } from "./toast";
import "./ui.css";

/* ── Boutons ─────────────────────────────────────────────────── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "blue" | "ghost" | "inset"; size?: "sm" | "md" | "lg"; block?: boolean; href?: string; icon?: ReactNode };
export function Btn({ variant = "secondary", size = "md", block, href, icon, className = "", children, ...rest }: BtnProps) {
  const cls = `btn btn--${variant} ${size !== "md" ? `btn--${size}` : ""} ${block ? "btn--block" : ""} ${className}`;
  if (href) return <a className={cls} href={href} onClick={rest.onClick as never}>{icon}{children}</a>;
  return <button type="button" className={cls} {...rest}>{icon}{children}</button>;
}
export function ICirc({ size, active, inset, badge, label, href, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "lg"; active?: boolean; inset?: boolean; badge?: number; label: string; href?: string }) {
  const cls = `icirc ${size ? `icirc--${size}` : ""} ${active ? "icirc--active" : ""} ${inset ? "icirc--inset" : ""} ${className}`;
  const inner = <>{children}{badge ? <span className="icirc__badge">{badge}</span> : null}</>;
  if (href) return <a className={cls} href={href} aria-label={label} title={label}>{inner}</a>;
  return <button type="button" className={cls} aria-label={label} title={label} {...rest}>{inner}</button>;
}

/* ── Pilules ─────────────────────────────────────────────────── */
export type Ton = "neutral" | "green" | "violet" | "blue" | "gold" | "navy" | "soft-green" | "soft-violet" | "soft-blue" | "soft-gold" | "glass" | "today";
export function Pill({ ton = "neutral", dot, icon, className = "", children }: { ton?: Ton; dot?: boolean; icon?: ReactNode; className?: string; children: ReactNode }) {
  return <span className={`pill ${ton !== "neutral" ? `pill--${ton}` : ""} ${className}`}>{dot && <i className="pill__dot" />}{icon}{children}</span>;
}

/* ── Barre de statut ────────────────────────────────────────── */
export function Bar({ ton, icon, label, chip, attention, style, onClick, title, className = "" }: { ton: "green" | "violet" | "blue" | "gold" | "navy"; icon?: ReactNode; label: string; chip?: string; attention?: boolean; style?: CSSProperties; onClick?: () => void; title?: string; className?: string }) {
  return (
    <button type="button" className={`bar bar--${ton} ${attention ? "bar--attention" : ""} ${className}`} style={style} onClick={onClick} title={title ?? label}>
      {icon && <span className="bar__ic">{icon}</span>}
      <span className="bar__label">{label}</span>
      {chip && <span className="pill pill--glass">• {chip}</span>}
    </button>
  );
}

/* ── Onglets à indicateur glissant ─────────────────────────── */
export interface TabItem { id: string; label: ReactNode; count?: number; icon?: ReactNode }
export function Tabs({ items, value, onChange, raised }: { items: TabItem[]; value: string; onChange: (id: string) => void; raised?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number; ok: boolean }>({ x: 0, w: 0, ok: false });
  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(value)}"]`);
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth, ok: true });
  }, [value, items.length]);
  useEffect(() => {
    const ro = new ResizeObserver(() => { const el = wrap.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(value)}"]`); if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth, ok: true }); });
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value]);
  return (
    <div ref={wrap} className={`tabs ${raised ? "tabs--raised" : ""}`} role="tablist">
      <span className="tabs__ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w, opacity: ind.ok ? 1 : 0 }} aria-hidden />
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" data-id={t.id} className="tabs__tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}>
          {t.icon}{t.label}{t.count !== undefined && <span className="tabs__count">· {t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Champs ─────────────────────────────────────────────────── */
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field__label">{label}</span>{children}{error ? <span className="field__error" role="alert">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}</label>;
}
export const Input = ({ error, className = "", ...p }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) => <input className={`field__ctl ${error ? "field__ctl--error" : ""} ${className}`} {...p} />;
export const Select = ({ className = "", ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={`field__ctl ${className}`} {...p} />;
export const Textarea = ({ className = "", ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={`field__ctl ${className}`} {...p} />;

/* ── Avatars ─────────────────────────────────────────────────── */
export function Avatar({ initiales, couleur, size, title }: { initiales: string; couleur: Couleur; size?: "sm" | "lg" | "xl"; title?: string }) {
  return <span className={`avatar avatar--${couleur} ${size ? `avatar--${size}` : ""}`} title={title} aria-label={title}>{initiales}</span>;
}
export function Avatars({ children }: { children: ReactNode }) { return <span className="avatars">{children}</span>; }

/* ── Modale ──────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`panel modal pop ${wide ? "modal--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} style={wide ? { width: "min(880px, 100%)" } : undefined}>
        <div className="modal__head"><h2 className="t-h2">{title}</h2><ICirc size="sm" label="Fermer" onClick={onClose}><IcX /></ICirc></div>
        {children}
      </div>
    </div>
  );
}

/* ── Messages discrets ──────────────────────────────────────── */
export function Toaster() {
  const liste = useToasts();
  return (
    <div className="toaster" aria-live="polite">
      {liste.map((t) => <div key={t.id} className={`toast toast--${t.ton}`}><span className="toast__ic"><IcCheck /></span>{t.texte}</div>)}
    </div>
  );
}

/* ── État vide ───────────────────────────────────────────────── */
export function Vide({ titre, texte, action }: { titre: string; texte?: string; action?: ReactNode }) {
  return <div className="empty"><strong>{titre}</strong>{texte && <p className="t-small">{texte}</p>}{action}</div>;
}

/** Transition de vue (réorganisation en douceur). Repli : exécution directe. */
export function transition(fn: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => void };
  if (d.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) d.startViewTransition(fn); else fn();
}
