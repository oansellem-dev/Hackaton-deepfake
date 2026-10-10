import { useEffect, useState } from "react";

/** Routeur par hash : "#/rapport/e-noah?x=1" → { parts: ["rapport","e-noah"], query: {x:"1"} } */
export interface Route { path: string; parts: string[]; query: Record<string, string> }
const lire = (): Route => {
  const h = location.hash.replace(/^#/, "") || "/";
  const [p, q = ""] = h.split("?");
  return { path: p, parts: p.split("/").filter(Boolean), query: Object.fromEntries(new URLSearchParams(q)) };
};
export function useRoute(): Route {
  const [r, setR] = useState(lire);
  useEffect(() => { const f = () => setR(lire()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return r;
}
export const aller = (hash: string) => { location.hash = hash; };
