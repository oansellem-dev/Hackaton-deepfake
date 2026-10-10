const fmtHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtJour = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

export const heure = (iso: string) => fmtHeure.format(new Date(iso)).replace(":", "h");

export function quand(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const meme = d.toDateString() === now.toDateString();
  const demain = new Date(now); demain.setDate(now.getDate() + 1);
  const hier = new Date(now); hier.setDate(now.getDate() - 1);
  const h = heure(iso);
  if (meme) return `Aujourd'hui, ${h}`;
  if (d.toDateString() === demain.toDateString()) return `Demain, ${h}`;
  if (d.toDateString() === hier.toDateString()) return `Hier, ${h}`;
  return `${fmtJour.format(d)}, ${h}`;
}
