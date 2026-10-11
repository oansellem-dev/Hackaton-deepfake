import { useCallback, useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from "react";
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
 * Une seule colonne, une carte par étape, une action principale par écran.
 * Accord → Caméra → Lumière → Geste → Fin. Le candidat ne voit jamais de score.
 * Les mesures sont simulées : le moteur vidéo de l'équipe remplace simulerLumiere / simulerGeste (integration.ts).
 */
type Etape = "accord" | "camera" | "lumiere" | "geste" | "fin" | "refus";
const ETAPES: { id: Etape; label: string; duree: string; ic: ReactNode }[] = [
  { id: "camera", label: "Caméra", duree: "10 s", ic: <IcCam /> },
  { id: "lumiere", label: "Lumière", duree: "6 s", ic: <IcSun /> },
  { id: "geste", label: "Geste", duree: "5 s", ic: <IcHand /> },
];

export function PreVerif({ token, entretienId, prenom }: { token: string; entretienId?: string; prenom?: string }) {
  // Démo : #/candidat/<jeton>?etape=lumiere ouvre directement une étape (répétition du pitch)
  const [etape, setEtape] = useState<Etape>(() => { const e = new URLSearchParams(location.hash.split("?")[1] ?? "").get("etape"); return e && ["accord", "camera", "lumiere", "geste", "fin"].includes(e) ? (e as Etape) : "accord"; });
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
  const progression = etape === "accord" ? 0 : etape === "fin" || etape === "refus" ? ETAPES.length : idx;
  return (
    <div className="cv">
      <header className="cv__top">
        <span className="cv__logo"><span className="logo-o" />oval</span>
        <span className="cv__lock"><IcLock /> Aucune vidéo enregistrée</span>
      </header>

      {etape !== "accord" && etape !== "refus" && (
        <div className="cv__progress" aria-label={`Étape ${Math.min(idx + 1, ETAPES.length)} sur ${ETAPES.length}`}>
          <div className="cv__segs" aria-hidden>{ETAPES.map((e, i) => <i key={e.id} className={i < progression ? "is-fait" : i === progression ? "is-now" : ""} />)}</div>
          <span>{etape === "fin" ? "Terminé" : <>Étape {idx + 1} sur {ETAPES.length} · <b>{ETAPES[idx].label}</b></>}</span>
        </div>
      )}

      <main className="cv__card page" key={etape}>
        {etape === "accord" && <Accord prenom={prenom} onAccepter={() => void accepter()} onRefuser={refuser} />}
        {etape === "camera" && <Camera stream={stream} sansCamera={sansCamera} tech={tech} onSuite={() => setEtape(sansCamera ? "fin" : "lumiere")} />}
        {etape === "lumiere" && <Lumiere stream={stream} onFin={finLumiere} />}
        {etape === "geste" && <Geste stream={stream} onFin={finGeste} />}
        {etape === "fin" && <Final etat="verifie" titre={`Merci${prenom ? ` ${prenom}` : ""}, c'est terminé !`} texte="Ton recruteur sait que la vérification est faite. Aucune vidéo n'a été enregistrée. Tu peux fermer cette page, à tout à l'heure." />}
        {etape === "refus" && <Final etat="neutre" titre="C'est noté." texte="Refuser ne joue pas contre toi. Le recruteur te proposera une autre solution : un entretien sans l'outil, ou en présentiel." />}
      </main>

      <footer className="cv__foot">
        <span><IcCheck /> Dans ton navigateur</span><span><IcCheck /> Aucune pièce d'identité</span><span><IcCheck /> Aucune analyse d'émotions</span>
        <span className="cv__ref">réf. {token.slice(0, 8)}</span>
      </footer>
    </div>
  );
}

/* ── 1. Accord ─────────────────────────────────────────────── */
function Accord({ prenom, onAccepter, onRefuser }: { prenom?: string; onAccepter: () => void; onRefuser: () => void }) {
  return (
    <>
      <div className="cv__manta">
        <Manta size={84} />
        <p className="cv__bulle">Bonjour{prenom ? ` ${prenom}` : ""} ! Je suis Manta. Je vérifie juste qu'une vraie personne est devant la caméra, pas qui tu es.</p>
      </div>
      <h1 className="cv__h1">Deux minutes avant ton entretien</h1>
      <ol className="cv__plan">
        {ETAPES.map((e, i) => (
          <li key={e.id}>
            <span className="cv__planIc">{e.ic}</span>
            <span className="cv__planTxt"><b>{i + 1}. {e.label}</b>{e.id === "camera" ? "J'active ta caméra et je vérifie ta connexion." : e.id === "lumiere" ? "L'écran change doucement de couleur, sans flash." : "Tu passes la main devant ton visage."}</span>
            <span className="cv__planDur">{e.duree}</span>
          </li>
        ))}
      </ol>
      <div className="cv__non">
        <span><IcX /> Pas de vidéo enregistrée</span><span><IcX /> Pas de pièce d'identité</span><span><IcX /> Pas d'analyse d'émotions</span>
      </div>
      <Btn variant="primary" size="lg" block onClick={onAccepter}>J'accepte et je commence</Btn>
      <button type="button" className="cv__link" onClick={onRefuser}>Je préfère ne pas faire cette vérification</button>
      <p className="cv__fine">Refuser ne joue pas contre toi : le recruteur te proposera une autre solution.</p>
    </>
  );
}

/* ── Viseur : la caméra dans un cadre compact, sur fond clair ── */
function Viseur({ stream, etat, badge, couleur }: { stream: MediaStream | null; etat: Parameters<typeof FaceScan>[0]["etat"]; badge?: ReactNode; couleur?: string }) {
  return (
    <div className="cv__viseur">
      <FaceScan stream={stream} etat={etat} largeur="min(210px, 48vw)" badge={badge} couleur={couleur} />
    </div>
  );
}

/* ── 2. Caméra + vérifications techniques ──────────────────── */
function Camera({ stream, sansCamera, tech, onSuite }: { stream: MediaStream | null; sansCamera: boolean; tech: MutableRefObject<Promise<SignauxTechniques> | null>; onSuite: () => void }) {
  const [t, setT] = useState<SignauxTechniques | null>(null);
  useEffect(() => {
    let vivant = true;
    (tech.current ?? relever()).then((v) => { if (vivant) setT(v); });
    return () => { vivant = false; };
  }, [tech, stream, sansCamera]);
  const pret = !!stream || sansCamera;
  return (
    <>
      <h1 className="cv__h1">{sansCamera ? "Pas de caméra, pas grave" : "Place ton visage dans l'ovale"}</h1>
      <p className="cv__sous">{sansCamera ? "Le recruteur fera les vérifications en direct pendant l'entretien." : "Rien ne quitte ton navigateur : l'analyse se fait sur ton ordinateur."}</p>
      <Viseur stream={stream} etat={sansCamera ? "off" : stream ? "idle" : "scan"} badge={sansCamera ? <><i />Caméra non disponible</> : stream ? <><i />Caméra active</> : <><i />Connexion…</>} />
      <ul className="cv__checks">
        <Check titre="Caméra" valeur={sansCamera ? "Non autorisée" : t ? t.cameras[0] ?? "Caméra du navigateur" : "…"} ok={!!stream} attente={!pret} />
        <Check titre="Fuseau horaire" valeur={t?.fuseau ?? "…"} ok={!!t} attente={!t} />
        <Check titre="Langue" valeur={t?.langue ?? "…"} ok={!!t} attente={!t} />
        <Check titre="Connexion" valeur="Relevée" ok={!!t} attente={!t} />
      </ul>
      <Btn variant="primary" size="lg" block onClick={onSuite} disabled={!pret}>{sansCamera ? "Terminer" : "Continuer"}</Btn>
    </>
  );
}
function Check({ titre, valeur, ok, attente }: { titre: string; valeur: string; ok: boolean; attente: boolean }) {
  return (
    <li className={`cv__check${ok ? " is-ok" : ""}`}>
      <span className="cv__checkIc">{attente ? <i className="cv__spin" /> : ok ? <IcCheck /> : <IcInfo />}</span>
      <span className="cv__checkTxt"><b>{titre}</b>{valeur}</span>
    </li>
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
    <>
      <h1 className="cv__h1">Test de lumière</h1>
      <p className="cv__sous">L'écran va changer de couleur pendant environ {Math.round((AMORCE + n * duree) / 1000)} secondes, en fondus doux. Jamais de flash.</p>
      <div className="cv__swatches" aria-hidden>{seq.current.map((c) => <i key={c} style={{ background: COULEURS[c].fond }} />)}</div>
      <ul className="cv__avert">
        <li><span className="cv__planIc"><IcSun /></span>Approche-toi de l'écran et monte sa luminosité.</li>
        <li><span className="cv__planIc"><IcCam /></span>Reste face à la caméra, sans bouger.</li>
        <li><span className="cv__planIc cv__planIc--gold"><IcInfo /></span>Sensible à la lumière (épilepsie, migraines) ? Passe cette étape : ça ne compte pas contre toi.</li>
      </ul>
      <Btn variant="primary" size="lg" block icon={<IcSun />} onClick={lancer}>Lancer le test</Btn>
      <button type="button" className="cv__link" onClick={() => finir(true)}>Passer cette étape</button>
    </>
  );

  const c = i >= 0 ? COULEURS[seq.current[i]] : { fond: "#0b0e1d", encre: "#ffffff", halo: "#56b4f0" };
  const reste = Math.max(1, Math.ceil(((seq.current.length - Math.max(i, 0)) * duree) / 1000));
  return (
    <div className="lum" role="dialog" aria-label="Test de lumière en cours" style={{ "--fondu": `${fondu}ms` } as CSSProperties}>
      {seq.current.map((nom, k) => <div key={k} className={`lum__layer${k <= i ? " on" : ""}`} style={{ background: COULEURS[nom].fond, zIndex: k + 1 }} />)}
      <div className="lum__ui">
        <FaceScan stream={stream} etat="lumiere" couleur={c.encre} hud={c.encre} progression={(i + 1) / seq.current.length} largeur="min(300px, 36vh)" />
        <div className="lum__bulle" aria-live="polite">
          <Manta size={48} state="lumiere" haloColor={c.halo} />
          <p>{i < 0 ? "Prêt ? Reste face à l'écran…" : <>Reste près de l'écran, encore <b>{reste} seconde{reste > 1 ? "s" : ""}</b>.</>}</p>
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
    <>
      <h1 className="cv__h1">{phase === "merci" ? "Merci, c'est noté" : phase === "analyse" ? "Je vérifie le geste…" : "Passe lentement ta main devant ton visage"}</h1>
      <p className="cv__sous">{phase === "consigne" ? "De gauche à droite, puis retire-la. Clique sur « C'est fait » quand c'est bon." : phase === "analyse" ? "Quelques secondes, dans ton navigateur." : "Dernière étape terminée."}</p>
      <Viseur stream={stream} etat={phase === "consigne" ? "geste" : phase === "analyse" ? "scan" : "ok"} badge={phase === "consigne" ? <><i />Main devant le visage</> : phase === "analyse" ? <><i />Analyse…</> : <><IcCheck />C'est noté</>} />
      {phase === "consigne" && (
        <>
          <Btn variant="primary" size="lg" block icon={<IcCheck />} onClick={() => void fait()}>C'est fait</Btn>
          <button type="button" className="cv__link" onClick={() => onFin(Promise.resolve("passe"))}>Passer cette étape</button>
        </>
      )}
    </>
  );
}

/* ── 5. Fin ou refus ───────────────────────────────────────── */
function Final({ titre, texte, etat }: { titre: string; texte: string; etat: "verifie" | "neutre" }) {
  return (
    <div className="cv__fin">
      <Manta size={120} state={etat} />
      <h1 className="cv__h1">{titre}</h1>
      <p className="cv__sous">{texte}</p>
    </div>
  );
}
