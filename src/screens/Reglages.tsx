import { useEffect, useRef, useState, type CSSProperties } from "react";
import { actions, recruteur, useEtat } from "../store/store";
import { seed } from "../store/seed";
import { composerEmail } from "../store/email";
import { apercuEmail } from "../store/envoi";
import { plusJours } from "../store/format";
import { Avatar, Btn, Field, Input, Modal, Pill, Select, Textarea } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcCheck, IcMail, IcPlay, IcRefresh, IcSun } from "../ui/icons";
import "./pages.css";

const APERCU = ["#ffffff", "#2f5df5", "#de5a4f", "#2fbf71", "#05070d"];
const REGLES = [
  "Tout se passe dans le navigateur. Aucune vidéo n'est enregistrée.",
  "On vérifie qu'un humain réel est présent, pas qui il est. Aucune comparaison avec une pièce d'identité.",
  "Ni analyse d'émotions, ni collecte de photos.",
  "L'absence d'information ne baisse jamais le score : seules les contradictions comptent.",
  "Le score est consultatif. Le recruteur décide.",
];

export function Reglages() {
  const etat = useEtat();
  const r = etat.reglages;
  const l = r.lumiere;
  const [envoi, setEnvoi] = useState<{ configure: boolean; test: boolean } | "inconnu" | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  useEffect(() => { fetch("/api/email").then((x) => x.json()).then(setEnvoi, () => setEnvoi("inconnu")); }, []);
  const setL = (p: Partial<typeof l>) => actions.reglages({ lumiere: { ...l, ...p } });
  const setT = (p: Partial<typeof r.textesLien>) => actions.reglages({ textesLien: { ...r.textesLien, ...p } });
  const fondu = Math.max(300, l.fonduMs);
  const n = Math.min(5, Math.max(4, l.etapes));
  const voirEmail = () => apercuEmail(composerEmail({ prenom: "Camille", to: "camille.royer@exemple.fr", poste: "Développeuse front-end", date: plusJours(new Date(), 1).toISOString(), recruteur: recruteur(etat, etat.moi).nom, token: "apercu", relance: false, objet: r.textesLien.objet, intro: r.textesLien.intro }));
  const retablir = () => { actions.reglages({ textesLien: seed().reglages.textesLien }); toast("Texte d'origine rétabli"); };
  return (
    <div className="pages">
      <header className="page-head rise" style={{ "--i": 1 } as CSSProperties}>
        <div><h1 className="t-display">Réglages</h1><p className="muted">Test de lumière, e-mail envoyé aux candidats, équipe et démo.</p></div>
      </header>
      <div className="reglages-grid">
        <section className="panel bloc rise" style={{ "--i": 2 } as CSSProperties}>
          <div className="bloc__head"><h2 className="t-h2">Test de lumière</h2><Pill ton="soft-blue" icon={<IcSun />}>≈ {Math.round((900 + n * l.dureeMs) / 1000)} s</Pill></div>
          <Curseur label="Durée par couleur" valeur={l.dureeMs} min={800} max={1500} pas={100} unite="ms" onChange={(v) => setL({ dureeMs: v })} />
          <Curseur label="Fondu entre deux couleurs" valeur={fondu} min={300} max={600} pas={50} unite="ms" aide="Jamais en dessous de 0,3 s : aucun flash." onChange={(v) => setL({ fonduMs: Math.max(300, v) })} />
          <Field label="Nombre de couleurs"><Select value={n} onChange={(e) => setL({ etapes: Number(e.target.value) })}><option value={4}>4</option><option value={5}>5 (recommandé)</option></Select></Field>
          <ApercuLumiere duree={l.dureeMs} fondu={fondu} n={n} />
          <p className="t-small faint">Couleurs tirées au hasard à chaque test, rouge adouci. Le candidat est prévenu avant et peut toujours passer cette étape.</p>
        </section>

        <section className="panel bloc rise" style={{ "--i": 3 } as CSSProperties}>
          <h2 className="t-h2">E-mail envoyé au candidat</h2>
          <Field label="Objet"><Input value={r.textesLien.objet} onChange={(e) => setT({ objet: e.target.value })} /></Field>
          <Field label="Texte d'introduction" hint="{prenom} est remplacé par le prénom du candidat."><Textarea rows={4} value={r.textesLien.intro} onChange={(e) => setT({ intro: e.target.value })} /></Field>
          <div className="row wrap" style={{ gap: 10 }}>
            <Btn icon={<IcMail />} onClick={voirEmail}>Voir l'e-mail</Btn>
            <Btn variant="ghost" icon={<IcRefresh />} onClick={retablir}>Rétablir le texte d'origine</Btn>
          </div>
        </section>

        <section className="panel bloc rise" style={{ "--i": 4 } as CSSProperties}>
          <div className="bloc__head">
            <h2 className="t-h2">Envoi des e-mails</h2>
            {envoi === null ? <Pill dot>Vérification…</Pill> : envoi === "inconnu" ? <Pill dot>Serveur d'envoi absent</Pill> : envoi.test ? <Pill ton="soft-violet" dot>Mode test</Pill> : envoi.configure ? <Pill ton="soft-green" icon={<IcCheck />}>Envoi automatique actif</Pill> : <Pill dot>Envoi manuel</Pill>}
          </div>
          <p className="t-small muted">
            {envoi !== null && envoi !== "inconnu" && envoi.configure && !envoi.test ? "Les liens partent directement dans la boîte du candidat." : envoi !== null && envoi !== "inconnu" && envoi.test ? "Rien ne part : chaque e-mail est enregistré dans le dossier outbox/." : "Sans identifiants SMTP, Oval rédige l'e-mail et l'ouvre dans votre messagerie : il reste à cliquer sur Envoyer."}
          </p>
          <p className="t-small muted">Pour l'envoi automatique, copiez le modèle puis renseignez votre serveur SMTP (Gmail : mot de passe d'application) et relancez <span className="kbd">npm run dev</span>.</p>
          <code className="code">cp .env.example .env</code>
        </section>

        <section className="panel bloc rise" style={{ "--i": 5 } as CSSProperties}>
          <h2 className="t-h2">Ce que l'outil fait, et ne fait pas</h2>
          <ul className="regles">{REGLES.map((t) => <li key={t}><span className="regles__ic"><IcCheck /></span>{t}</li>)}</ul>
        </section>

        <section className="panel bloc rise" style={{ "--i": 6 } as CSSProperties}>
          <h2 className="t-h2">Équipe de recrutement</h2>
          <ul className="equipe">{etat.recruteurs.map((p) => <li key={p.id}><Avatar initiales={p.initiales} couleur={p.couleur} size="sm" /><span className="grow">{p.nom}</span>{p.id === etat.moi && <Pill ton="soft-blue">Vous</Pill>}</li>)}</ul>
        </section>

        <section className="panel bloc rise" style={{ "--i": 7 } as CSSProperties}>
          <h2 className="t-h2">Démo</h2>
          <p className="t-small muted">Les dates des données d'exemple sont calculées au chargement. Réinitialisez juste avant le pitch pour que l'entretien d'Emma soit « dans 20 min ».</p>
          <Btn icon={<IcRefresh />} onClick={() => setConfirmer(true)}>Réinitialiser la démo</Btn>
        </section>
      </div>

      <Modal open={confirmer} onClose={() => setConfirmer(false)} title="Réinitialiser la démo ?">
        <p className="muted">Les entretiens créés, les défis menés et les décisions prises seront remplacés par les données d'exemple.</p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <Btn variant="ghost" onClick={() => setConfirmer(false)}>Annuler</Btn>
          <Btn variant="primary" icon={<IcRefresh />} onClick={() => { actions.reinitialiser(); setConfirmer(false); toast("Démo réinitialisée : données d'exemple rechargées"); }}>Réinitialiser</Btn>
        </div>
      </Modal>
    </div>
  );
}

function Curseur({ label, valeur, min, max, pas, unite, aide, onChange }: { label: string; valeur: number; min: number; max: number; pas: number; unite: string; aide?: string; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span className="field__label curseur__tete">{label}<b className="num">{valeur} {unite}</b></span>
      <input className="curseur" type="range" min={min} max={max} step={pas} value={valeur} onChange={(e) => onChange(Number(e.target.value))} />
      {aide && <span className="field__hint">{aide}</span>}
    </label>
  );
}

/** Aperçu dans un petit cadre, avec les mêmes fondus (jamais de flash). */
function ApercuLumiere({ duree, fondu, n }: { duree: number; fondu: number; n: number }) {
  const [i, setI] = useState(-1);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const jouer = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setI(-1);
    for (let k = 0; k <= n; k++) timers.current.push(window.setTimeout(() => setI(k < n ? k : -1), 200 + k * duree));
  };
  return (
    <div className="apercu-lum" style={{ "--fondu": `${fondu}ms` } as CSSProperties}>
      {APERCU.slice(0, n).map((c, k) => <i key={c} className={i >= k && i !== -1 ? "on" : ""} style={{ background: c, zIndex: k + 1 }} />)}
      <Btn size="sm" variant="glass" icon={<IcPlay />} onClick={jouer} className="apercu-lum__btn">{i === -1 ? "Aperçu de la séquence" : "Lecture…"}</Btn>
    </div>
  );
}
