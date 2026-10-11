import { useEffect, useState } from "react";
import { nomComplet, parId, recruteur, useEtat } from "../store/store";
import { abonnerPanneau, emettre } from "../store/integration";
import { DEFI_NOMS } from "../store/texts";
import { FaceScan, type ScanEtat } from "../ui/FaceScan";
import { Avatar, Btn } from "../ui/ui";
import { IcArrowL, IcCam, IcCamOff, IcHangup, IcLock, IcMic, IcMicOff } from "../ui/icons";
import { PanelOval } from "../panel/PanelOval";
import "./visio.css";

/**
 * Page de visio Oval (le « plan B » du contexte) : l'appel à gauche, le panneau à droite.
 * La caméra locale sert de flux candidat pour la démo. Rien n'est enregistré.
 */
export function Visio({ id }: { id: string }) {
  const etat = useEtat();
  const x = parId(etat, id);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cam, setCam] = useState<"off" | "demande" | "on" | "refusee">("off");
  const [micro, setMicro] = useState(true);
  const [scan, setScan] = useState<{ etat: ScanEtat; label: string }>({ etat: "idle", label: "Cadre Oval prêt" });
  const [debut] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  useEffect(() => abonnerPanneau((ev) => {
    if (ev.type === "defi_propose") setScan({ etat: "idle", label: `Défi proposé : ${DEFI_NOMS[ev.defi.type].toLowerCase()}` });
    if (ev.type === "defi_en_cours") setScan({ etat: "scan", label: "Analyse du geste…" });
    if (ev.type === "defi_resultat") setScan(ev.defi.resultat === "a_verifier" ? { etat: "signal", label: "Signal à vérifier" } : ev.defi.resultat === "reussi" ? { etat: "ok", label: ev.defi.detail ?? "Geste exécuté" } : { etat: "idle", label: "Défi passé" });
    if (ev.type === "entretien_termine") setScan({ etat: "idle", label: "Entretien terminé" });
  }), []);

  const activer = async () => {
    setCam("demande");
    try { const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); setStream(s); setCam("on"); }
    catch { setCam("refusee"); }
  };
  const couper = () => { stream?.getTracks().forEach((t) => t.stop()); setStream(null); setCam("off"); };

  if (!x) return <div className="visio-app"><div className="shell visio visio--vide"><p>Entretien introuvable.</p><Btn href="#/">Tableau de bord</Btn></div></div>;
  const moi = recruteur(etat, etat.moi);
  const s = Math.floor((now - debut) / 1000);
  const chrono = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="visio-app">
      <div className="shell visio">
        <section className="visio__call">
          <header className="visio__head">
            <a className="visio__icon" href="#/" aria-label="Retour au tableau de bord"><IcArrowL /></a>
            <span className="visio__titre">Entretien · {nomComplet(x)} · <span className="num">{chrono}</span></span>
            <span className="visio__rec"><IcLock /> Aucun enregistrement</span>
          </header>
          <div className="visio__stage">
            <div className="visio__main">
              <span className="visio__oval">Cadre Oval · visible par vous seul</span>
              <FaceScan stream={stream} etat={cam === "refusee" ? "off" : scan.etat} largeur="min(300px, 32vh)" badge={<><i />{cam === "refusee" ? "Caméra non disponible" : scan.label}</>} />
              {cam !== "on" && (
                <button type="button" className="visio__activer" onClick={() => void activer()} disabled={cam === "demande"}>
                  <IcCam /> {cam === "refusee" ? "Caméra refusée : réessayer" : cam === "demande" ? "Autorisation…" : "Activer la caméra de démo"}
                </button>
              )}
              <span className="visio__nom">{nomComplet(x)}{!micro && " · micro coupé"}</span>
            </div>
            <div className="visio__side">
              <div className="visio__vous"><Avatar initiales={moi.initiales} couleur={moi.couleur} size="lg" /><span>vous</span></div>
              <p className="visio__aide">Raccourcis démo dans le panneau : 2 défi, 3 résultat, 4 fin, B visage substitué, R remise à zéro.</p>
            </div>
          </div>
          <footer className="visio__ctrl">
            <button type="button" className={`visio__btn${micro ? "" : " is-off"}`} aria-pressed={!micro} aria-label={micro ? "Couper le micro" : "Rétablir le micro"} onClick={() => setMicro((m) => !m)}>{micro ? <IcMic /> : <IcMicOff />}</button>
            <button type="button" className={`visio__btn${cam === "on" ? "" : " is-off"}`} aria-label={cam === "on" ? "Couper la caméra" : "Activer la caméra"} onClick={cam === "on" ? couper : () => void activer()}>{cam === "on" ? <IcCam /> : <IcCamOff />}</button>
            <button type="button" className="visio__btn visio__btn--fin" aria-label="Raccrocher et terminer l'entretien" onClick={() => emettre({ type: "entretien_termine" })}><IcHangup /></button>
          </footer>
        </section>
        <aside className="visio__panel"><PanelOval entretienId={x.id} embedded /></aside>
      </div>
    </div>
  );
}
