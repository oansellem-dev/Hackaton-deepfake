import { useEffect } from "react";
import { actions, getEtat } from "./store";
import { demarrerSynchro, moteurDisponible } from "./moteur";

/**
 * Au chargement : « moteur » si le serveur répond (sauf choix déjà fait dans Réglages), sinon « démo ».
 * Puis synchronisation toutes les 4 s des entretiens reliés au moteur.
 */
export function useMoteur(): void {
  useEffect(() => {
    let arreter: (() => void) | undefined;
    let vivant = true;
    void (async () => {
      if (getEtat().reglages.donnees === undefined) actions.reglages({ donnees: (await moteurDisponible()) ? "moteur" : "demo" });
      if (vivant) arreter = demarrerSynchro();
    })();
    return () => { vivant = false; arreter?.(); };
  }, []);
}
