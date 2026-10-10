import { useEffect, useState } from "react";

/** Routeur minimal par hash : "#/rapport/e6" → { path: "/rapport/e6", parts: ["rapport","e6"] } */
export function useRoute() {
  const lire = () => {
    const h = location.hash.replace(/^#/, "") || "/";
    return { path: h, parts: h.split("/").filter(Boolean) };
  };
  const [route, setRoute] = useState(lire);
  useEffect(() => {
    const f = () => setRoute(lire());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return route;
}

export const aller = (path: string) => { location.hash = path; };
