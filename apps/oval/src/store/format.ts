const fmtHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtJourCourt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const fmtJourLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export const heure = (iso: string) => fmtHeure.format(new Date(iso)).replace(":", ":");
export const jourCourt = (iso: string | Date) => fmtJourCourt.format(typeof iso === "string" ? new Date(iso) : iso).replace(".", "");
export const jourLong = (iso: string | Date) => fmtJourLong.format(typeof iso === "string" ? new Date(iso) : iso);

const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** « Aujourd'hui · 14:00 », « Demain · 10:00 », « Lun 12 oct. · 14:00 » */
export function quand(iso: string, ref: Date = new Date()): string {
  const d = new Date(iso);
  const demain = new Date(ref); demain.setDate(ref.getDate() + 1);
  const hier = new Date(ref); hier.setDate(ref.getDate() - 1);
  const h = heure(iso);
  if (memeJour(d, ref)) return `Auj. · ${h}`;
  if (memeJour(d, demain)) return `Demain · ${h}`;
  if (memeJour(d, hier)) return `Hier · ${h}`;
  return `${jourCourt(d)} · ${h}`;
}

/** « Dans 15 min », « Dans 2 h », « Il y a 2 j » */
export function relatif(iso: string, ref: Date = new Date()): string {
  const ms = new Date(iso).getTime() - ref.getTime();
  const min = Math.round(ms / 60000);
  const abs = Math.abs(min);
  const futur = min >= 0;
  const txt = abs < 60 ? `${abs} min` : abs < 60 * 36 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} j`;
  return futur ? `Dans ${txt}` : `Il y a ${txt}`;
}

export const plage = (iso: string, dureeMin: number) => { const d = new Date(iso); const f = new Date(d.getTime() + dureeMin * 60000); return `${fmtHeure.format(d)} – ${fmtHeure.format(f)}`; };

/** Lundi de la semaine qui contient `d`. */
export function lundi(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); const j = (x.getDay() + 6) % 7; x.setDate(x.getDate() - j); return x; }
export const plusJours = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const fmtMois = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const fmtNomJour = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
/** « 5 octobre » */
export const semaineDu = (d: Date) => fmtMois.format(d);
/** « Lun », « Mar »… */
export const jourNom = (d: Date) => { const s = fmtNomJour.format(d).replace(".", ""); return s.charAt(0).toUpperCase() + s.slice(1); };
export const estWE = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
export const debutJour = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
/** « 2026-10-12 » en heure locale (pour les champs date). */
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
