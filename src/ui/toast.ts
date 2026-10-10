import { useSyncExternalStore } from "react";

/** Messages discrets. `toast("Lien envoyé")` depuis n'importe où. */
export interface Toast { id: number; texte: string; ton: "ok" | "info" }
let liste: Toast[] = [];
const abonnes = new Set<() => void>();
let n = 0;
const notifier = () => abonnes.forEach((cb) => cb());

export function toast(texte: string, ton: Toast["ton"] = "ok") {
  const id = ++n;
  liste = [...liste.slice(-2), { id, texte, ton }];
  notifier();
  window.setTimeout(() => { liste = liste.filter((t) => t.id !== id); notifier(); }, 3200);
}
export function useToasts(): Toast[] {
  return useSyncExternalStore((cb) => { abonnes.add(cb); return () => { abonnes.delete(cb); }; }, () => liste, () => liste);
}
