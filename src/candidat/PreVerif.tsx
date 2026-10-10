import { useCallback, useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import type { PreVerification, Resultat, SequenceLumiere, SignauxTechniques } from "../store/types";
import { actions, getEtat, parId, useEtat } from "../store/store";
import { relever, signauxDepuis, simulerGeste, simulerLumiere } from "../store/integration";
import { Manta } from "../manta/Manta";
import { FaceScan } from "../ui/FaceScan";
import { Btn } from "../ui/ui";
import { IcCam, IcCheck, IcHand, IcInfo, IcLock, IcSun, IcX } from "../ui/icons";
import "./candidat.css";

/**
 * PAGE CANDIDAT — lien de pré-vérification (deux minutes).
 * Accord → Caméra → Lumière → Geste → Fin. Le candidat ne voit jamais de score.
 * Les mesures (lumière, geste) sont simulées : le moteur vidéo de l'équipe remplace
 * simulerLumiere / simulerGeste dans integration.ts.
 */
type Etape = "accord" | "camera" | "lumiere" | "geste" | "fin" | "refus";
const ETAPES: { id: Etape; label: string }[] = [{ id: "accord", label: "Accord" }, { id: "camera", label: "Caméra" }, { id: "lumiere", label: "Lumière" }, { id: "geste", label: "Geste" }, { id: "fin", label: "Fin" }];

export function PreVerif({ token, entretienId, prenom }: { token: string; entretienId?: string; prenom?: string }) {
  // Démo : #/candidat/<jeton>?etape=lumiere ouvre directement une étape (répétition du pitch)
  const [etape, setEtape] = useState<Etape>(() => { const e = new URLSearchParams(location.hash.split("?")[1] ?? "").get("etape"); return e && ETAPES.some((x) => x.id === e) ? (e as Etape) : "accord"; });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sansCamera, setSansCamera] = useState(false);
  const lumiereP = useRef<Promise<Resultat>>(Promise.resolve("passe"));
  const gesteP = useRef<Promise<Resultat>>(Promise.resolve("passe"));
  const tech = useRef<Promise<SignauxTechniques> | null>(null);
  const noter = (e: Partial<PreVerification["etapes"]>) => { if (entretienId) actions.preVerifEtape(entretienId, e); };

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const accepter = async () => {
    noter({ accord: true });
    setEtape("camera");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
      setStream(s);
      noter({ camera: true });
    } catch {
      setSansCamera(true);
      noter({ camera: false });
    }
    tech.current = relever();
  };
  const refuser = () => { if (entretienId) actions.preVerifRefusee(entretienId); setEtape("refus"); };
  const finLumiere = useCallback((seq: SequenceLumiere) => { lumiereP.current = simulerLumiere(seq); setEtape("geste"); }, []);
  const finGeste = (p: Promise<Resultat>) => { gesteP.current = p; setEtape("fin"); };

  // Fin du parcours : le dashboard du recruteur passe à « Pré-vérification faite »
  const enregistre = useRef(false);
  useEffect(() => {
    if (etape !== "fin" || enregistre.current) return;
    enregistre.current = true;
    const camera = !!stream;
    stream?.getTracks().forEach((t) => t.stop());
    if (!entretienId) return;
    void (async () => {
      const [lumiere, geste, t] = await Promise.all([lumiereP.current, gesteP.current, tech.current ?? relever()]);
      actions.preVerifEtape(entretienId, { accord: true, camera, lumiere, geste });
      actions.preVerifFaite(entretienId, signauxDepuis(t, parId(getEtat(), entretienId)?.candidat.villeDeclaree));
    })();
  }, [etape]); // eslint-disable-line

  const idx = ETAPES.findIndex((e) => e.id === etape);
  return (
    <div className="cand-app">
      <div className="shell cand">
        <header className="cand__head">
          <span className="cand__logo"><span className="logo-o" />oval</span>
          <nav className="cand__steps" aria-label="Étapes">
            {ETAPES.map((e, i) => <span key={e.id} className={`cand__step${i < idx ? " is-fait" : ""}${i === idx ? " is-now" : ""}`} aria-current={i === idx ? "step" : undefined}>{i < idx && <IcCheck />}{e.label}</span>)}
          </nav>
          <span className="cand__secure"><IcLock /> Aucune vidéo enregistrée</span>
        </header>
        <div className="cand__body page" key={etape}>
          {etape === "accord" && <Accord prenom={prenom} onAccepter={() => void accepter()} onRefuser={refuser} />}
          {etape === "camera" && <Camera stream={stream} sansCamera={sansCamera} tech={tech} onSuite={() => setEtape(sansCamera ? "fin" : "lumiere")} />}
          {etape === "lumiere" && <Lumiere stream={stream} onFin={finLumiere} />}
          {etape === "geste" && <Geste stream={stream} onFin={finGeste} />}
          {etape === "fin" && <Final prenom={prenom} titre={`C'est terminé, à tout à l'heure${prenom ? ` ${prenom}` : ""} !`} texte="Ton recruteur sait que la vérification technique est faite. Aucune vidéo n'a été enregistrée. Tu peux fermer cette page." />}
          {etape === "refus" && <Final titre="C'est noté." texte="Refuser ne joue pas contre toi. Le recruteur te proposera une autre solution : un entretien sans l'outil, ou en présentiel." neutre />}
        </div>
        <p className="cand__ref">Lien personnel · référence {token.slice(0, 8)}</p>
      </div>
    </div>
  );
}

/* ── 1. Accord ─────────────────────────────────────────────── */
function Accord({ prenom, onAccepter, onRefuser }: { prenom?: string; onAccepter: () => void; onRefuser: () => void }) {
  return (
    <>
      <div className="cand__hero">
        <Manta size={150} />
        <h1>Bonjour{prenom ? ` ${prenom}` : ""}, deux minutes avant ton entretien</h1>
        <p className="muted">Je suis Manta. Je vérifie qu'il y a bien une vraie personne derrière la caméra.</p>
      </div>
      <div className="cand__cols">
        <section className="card cand__box">
          <h2 className="t-h3">Ce que je vérifie</h2>
          <ul className="cand__list">
            <li><span className="cand__ic cand__ic--ok"><IcCam /></span>Ta caméra et ta connexion</li>
            <li><span className="cand__ic cand__ic--ok"><IcSun /></span>La lumière sur ton visage, quelques secondes, sans flash</li>
            <li><span className="cand__ic cand__ic--ok"><IcHand /></span>Un geste simple de la main</li>
          </ul>
        </section>
        <section className="card cand__box">
          <h2 className="t-h3">Ce que je ne fais pas</h2>
          <ul className="cand__list">
            <li><span className="cand__ic"><IcX /></span>Aucune vidéo enregistrée</li>
            <li><span className="cand__ic"><IcX /></span>Pas de pièce d'identité</li>
            <li><span className="cand__ic"><IcX /></span>Pas d'analyse de tes émotions</li>
          </ul>
        </section>
      </div>
      <div className="cand__actions">
        <Btn variant="primary" size="lg" onClick={onAccepter}>J'accepte et je commence</Btn>
        <button type="button" className="cand__refus" onClick={onRefuser}>Je préfère ne pas faire cette vérification</button>
        <p className="t-small faint">Refuser ne joue pas contre toi. Le recruteur te proposera une autre solution.</p>
      </div>
    </>
  );
}

/* ── 2. Caméra + signaux techniques ────────────────────────── */
function Camera({ stream, sansCamera, tech, onSuite }: { stream: MediaStream | null; sansCamera: boolean; tech: MutableRefObject<Promise<SignauxTechniques> | null>; onSuite: () => void }) {
  const [t, setT] = useState<SignauxTechniques | null>(null);
  useEffect(() => {
    let vivant = true;
    (tech.current ?? relever()).then((v) => { if (vivant) setT(v); });
    return () => { vivant = false; };
  }, [tech, stream, sansCamera]);
  const pret = !!stream || sansCamera;
  return (
    <div className="cand__stage">
      <div className="cand__hud"><i className="cand__live" />{sansCamera ? "Caméra non disponible" : stream ? "Analyse locale · rien ne quitte ton navigateur" : "Connexion à la caméra…"}</div>
      <FaceScan stream={stream} etat={sansCamera ? "off" : stream ? "idle" : "scan"} largeur="min(290px, 60vw)"
        badge={sansCamera ? <><i />Pas de caméra</> : stream ? <><i />Place ton visage dans l'ovale</> : <><i />Connexion…</>} />
      <div className="cand__checks">
        <Check titre="Caméra" valeur={sansCamera ? "Non autorisée, pas grave" : t ? t.cameras[0] ?? "Caméra du navigateur" : "…"} ok={!!stream} attente={!pret} />
        <Check titre="Fuseau horaire" valeur={t?.fuseau ?? "…"} ok={!!t} attente={!t} />
        <Check titre="Langue" valeur={t?.langue ?? "…"} ok={!!t} attente={!t} />
        <Check titre="Connexion" valeur="Relevée côté serveur" ok={!!t} attente={!t} />
      </div>
      {sansCamera && <p className="cand__note">Pas de caméra ? Ce n'est pas un problème : le recruteur fera les vérifications en direct pendant l'entretien.</p>}
      <Btn variant="glass" size="lg" onClick={onSuite} disabled={!pret}>{sansCamera ? "Terminer" : "Continuer"}</Btn>
    </div>
  );
}
function Check({ titre, valeur, ok, attente }: { titre: string; valeur: string; ok: boolean; attente: boolean }) {
  return (
    <div className={`cand__check${ok ? " is-ok" : ""}`}>
      <span className="cand__checkIc">{attente ? <i className="cand__spin" /> : ok ? <IcCheck /> : <IcInfo />}</span>
      <span className="cand__checkTxt"><b>{titre}</b>{valeur}</span>
    </div>
  );
}

/* ── 3. Test de lumière : fondus, jamais de flash, on peut passer ── */
const COULEURS = {
  blanc: { fond: "#ffffff", encre: "#1b2032", halo: "#dfe8ff" },
  bleu: { fond: "#2f5df5", encre: "#ffffff", halo: "#56b4f0" },
  rouge: { fond: "#de5a4f", encre: "#ffffff", halo: "#f4a259" },
  vert: { fond: "#2fbf71", encre: "#1b2032", halo: "#5fd39c" },
  noir: { fond: "#05070d", encre: "#ffffff", halo: "#8a8fa8" },
} as const;
type Couleur = keyof typeof COULEURS;
const melanger = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const AMORCE = 900;

function Lumiere({ stream, onFin }: { stream: MediaStream | null; onFin: (s: SequenceLumiere) => void }) {
  const r = useEtat().reglages.lumiere;
  const duree = Math.min(1500, Math.max(800, r.dureeMs));
  const fondu = Math.max(300, r.fonduMs);
  const n = Math.min(5, Math.max(4, r.etapes));
  const [phase, setPhase] = useState<"avert" | "test">("avert");
  const [i, setI] = useState(-1);
  const seq = useRef<Couleur[]>(melanger(Object.keys(COULEURS) as Couleur[]).slice(0, n));
  const stamps = useRef<number[]>([]);
  const timers = useRef<number[]>([]);
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => stop, []);
  const finir = (passe: boolean) => { stop(); onFin({ couleurs: seq.current, horodatages: stamps.current, passe }); };
  const lancer = () => {
    setPhase("test");
    seq.current.forEach((_, k) => timers.current.push(window.setTimeout(() => { stamps.current.push(performance.now()); setI(k); }, AMORCE + k * duree)));
    timers.current.push(window.setTimeout(() => finir(false), AMORCE + seq.current.length * duree + 250));
  };

  if (phase === "avert") return (
    <div className="cand__stage">
      <Manta size={110} state="lumiere" haloColor="#56b4f0" />
      <h2 className="cand__stageTitre">Test de lumière</h2>
      <ul className="cand__avert">
        <li><IcSun />L'écran va changer de couleur pendant environ {Math.round((AMORCE + n * duree) / 1000)} secondes, en fondus doux. Jamais de flash.</li>
        <li><IcCam />Approche-toi de l'écran et monte sa luminosité.</li>
        <li><IcInfo />Si les changements de lumière te gênent (sensibilité à la lumière, épilepsie), passe cette étape : ça ne compte pas contre toi.</li>
      </ul>
      <div className="cand__duo">
        <Btn variant="glass" size="lg" icon={<IcSun />} onClick={lancer}>Lancer le test</Btn>
        <Btn variant="ghost" className="cand__ghost" onClick={() => finir(true)}>Passer cette étape</Btn>
      </div>
    </div>
  );

  const c = i >= 0 ? COULEURS[seq.current[i]] : { fond: "#0b0e1d", encre: "#ffffff", halo: "#56b4f0" };
  const reste = Math.max(1, Math.ceil(((seq.current.length - Math.max(i, 0)) * duree) / 1000));
  return (
    <div className="lum" role="dialog" aria-label="Test de lumière en cours" style={{ "--fondu": `${fondu}ms` } as CSSProperties}>
      {seq.current.map((nom, k) => <div key={k} className={`lum__layer${k <= i ? " on" : ""}`} style={{ background: COULEURS[nom].fond, zIndex: k + 1 }} />)}
      <div className="lum__ui">
        <FaceScan stream={stream} etat="lumiere" couleur={c.encre} hud={c.encre} progression={(i + 1) / seq.current.length} largeur="min(300px, 36vh)" />
        <div className="cand__bulle" aria-live="polite">
          <Manta size={48} state="lumiere" haloColor={c.halo} />
          <p>{i < 0 ? "Prêt ? Reste face à l'écran…" : <>J'éclaire ton visage avec quelques couleurs. Reste près de l'écran, encore <b>{reste} seconde{reste > 1 ? "s" : ""}</b>.</>}</p>
        </div>
        <div className="lum__dots" aria-hidden>{seq.current.map((_, k) => <i key={k} className={k <= i ? "on" : ""} />)}</div>
      </div>
      <Btn className="lum__skip" variant="glass" onClick={() => finir(true)}>Passer cette étape</Btn>
    </div>
  );
}

/* ── 4. Défi gestuel ───────────────────────────────────────── */
function Geste({ stream, onFin }: { stream: MediaStream | null; onFin: (p: Promise<Resultat>) => void }) {
  const [phase, setPhase] = useState<"consigne" | "analyse" | "merci">("consigne");
  const fait = async () => {
    setPhase("analyse");
    const p = simulerGeste(stream);
    await p;
    setPhase("merci");
    window.setTimeout(() => onFin(p), 1100);
  };
  return (
    <div className="cand__stage">
      <div className="cand__hud"><i className="cand__live" />Défi gestuel · analyse dans ton navigateur</div>
      <FaceScan stream={stream} etat={phase === "consigne" ? "geste" : phase === "analyse" ? "scan" : "ok"} largeur="min(290px, 60vw)"
        badge={phase === "consigne" ? <><i />Passe ta main devant ton visage</> : phase === "analyse" ? <><i />Je vérifie le geste…</> : <><IcCheck />Merci, c'est noté</>} />
      <h2 className="cand__stageTitre">{phase === "merci" ? "Merci, c'est noté." : "Passe lentement ta main devant ton visage, puis retire-la."}</h2>
      {phase === "consigne" && (
        <div className="cand__duo">
          <Btn variant="glass" size="lg" icon={<IcCheck />} onClick={() => void fait()}>C'est fait</Btn>
          <Btn variant="ghost" className="cand__ghost" onClick={() => onFin(Promise.resolve("passe"))}>Passer cette étape</Btn>
        </div>
      )}
    </div>
  );
}

/* ── 5. Fin ou refus ───────────────────────────────────────── */
function Final({ titre, texte, neutre }: { prenom?: string; titre: string; texte: string; neutre?: boolean }) {
  return (
    <div className="cand__hero cand__hero--fin">
      <Manta size={150} state={neutre ? "neutre" : "verifie"} />
      <h1>{titre}</h1>
      <p className="muted">{texte}</p>
    </div>
  );
}
