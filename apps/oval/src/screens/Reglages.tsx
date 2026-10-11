import { useEffect, useRef, useState, type CSSProperties } from "react";
import { actions, recruteur, useEtat } from "../store/store";
import { seed } from "../store/seed";
import { composerEmail } from "../store/email";
import { apercuEmail } from "../store/envoi";
import { plusJours } from "../store/format";
import { moteurDisponible } from "../store/moteur";
import { Avatar, Btn, Field, Input, Modal, Pill, Select, Textarea } from "../ui/ui";
import { BouncyAccordion } from "../ui/BouncyAccordion";
import { toast } from "../ui/toast";
import { IcCheck, IcDot, IcGear, IcHalf, IcHand, IcMail, IcPlay, IcRefresh, IcSun } from "../ui/icons";
import { LANGUES, changerLangue, langue, t, type Langue } from "../i18n";
import "./pages.css";

const APERCU = ["#ffffff", "#2f5df5", "#de5a4f", "#2fbf71", "#05070d"];
const REGLES = [
  t("Tout se passe dans le navigateur. Aucune vidéo n'est enregistrée."),
  t("On vérifie qu'un humain réel est présent, pas qui il est. Aucune comparaison avec une pièce d'identité."),
  t("Ni analyse d'émotions, ni collecte de photos."),
  t("L'absence d'information ne baisse jamais le score : seules les contradictions comptent."),
  t("Le score est consultatif. Le recruteur décide."),
];

export function Reglages() {
  const etat = useEtat();
  const r = etat.reglages;
  const l = r.lumiere;
  const [envoi, setEnvoi] = useState<{ configure: boolean; test: boolean } | "inconnu" | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [moteur, setMoteur] = useState<boolean | null>(null);
  useEffect(() => { void moteurDisponible().then(setMoteur); }, []);
  useEffect(() => { fetch("/api/email").then((x) => x.json()).then(setEnvoi, () => setEnvoi("inconnu")); }, []);
  const setL = (p: Partial<typeof l>) => actions.reglages({ lumiere: { ...l, ...p } });
  const setT = (p: Partial<typeof r.textesLien>) => actions.reglages({ textesLien: { ...r.textesLien, ...p } });
  const fondu = Math.max(300, l.fonduMs);
  const n = Math.min(5, Math.max(4, l.etapes));
  const voirEmail = () => apercuEmail(composerEmail({ prenom: "Camille", to: "camille.royer@exemple.fr", poste: "Développeuse front-end", date: plusJours(new Date(), 1).toISOString(), recruteur: recruteur(etat, etat.moi).nom, token: "apercu", relance: false, objet: r.textesLien.objet, intro: r.textesLien.intro }));
  const retablir = () => { actions.reglages({ textesLien: seed().reglages.textesLien }); toast(t("Texte d'origine rétabli")); };
  return (
    <div className="pages">
      <header className="page-head rise" style={{ "--i": 1 } as CSSProperties}>
        <div><h1 className="t-display">{t("Réglages")}</h1><p className="muted">{t("Données, langue, test de lumière, e-mail, équipe et démo.")}</p></div>
      </header>
      <div className="reglages rise" style={{ "--i": 2 } as CSSProperties}>
        <BouncyAccordion className="bacc--large" ouvertParDefaut="donnees" items={[
          { id: "donnees", icone: <IcGear />, titre: t("Données"), contenu: <>
            <div className="row" style={{ justifyContent: "flex-end" }}>{moteur === null ? <Pill dot>{t("Vérification…")}</Pill> : moteur ? <Pill ton="soft-green" icon={<IcCheck />}>{t("Moteur en ligne (8787)")}</Pill> : <Pill ton="soft-gold" dot>{t("Moteur injoignable")}</Pill>}</div>
            <Field label={t("Source des entretiens")} hint={r.donnees === "moteur" ? t("Les nouveaux entretiens sont créés sur le serveur de l'équipe ; le lien candidat mène à la vraie pré-vérification.") : t("Tout reste dans ce navigateur, avec les données d'exemple. Les résultats sont simulés.")}>
              <Select value={r.donnees ?? "demo"} onChange={(e) => { actions.reglages({ donnees: e.target.value as "demo" | "moteur" }); toast(e.target.value === "moteur" ? t("Mode moteur : les nouveaux entretiens passent par le serveur") : t("Mode démo : tout en local")); }}>
                <option value="moteur">{t("Moteur (serveur de l'équipe)")}</option>
                <option value="demo">{t("Démo (données d'exemple)")}</option>
              </Select>
            </Field>
            <Field label={t("Entreprise qui recrute")} hint={t("Responsable du traitement, indiqué au candidat sur la page de pré-vérification.")}>
              <Input value={r.entreprise ?? ""} placeholder={t("Ex. Secure Horizons")} onChange={(e) => actions.reglages({ entreprise: e.target.value })} />
            </Field>
            <p className="t-small faint">{t("Les entretiens déjà reliés au moteur restent synchronisés toutes les 4 secondes. Les données d'exemple ne sont jamais envoyées au serveur.")}</p>
          </> },
          { id: "langue", icone: <IcHalf />, titre: t("Langue"), contenu: <>
            <Field label={t("Langue de l'interface")} hint={t("La page se recharge avec la langue choisie.")}>
              <Select value={langue} onChange={(e) => changerLangue(e.target.value as Langue)}>{LANGUES.map((lg) => <option key={lg.id} value={lg.id}>{lg.nom}</option>)}</Select>
            </Field>
          </> },
          { id: "lumiere", icone: <IcSun />, titre: t("Test de lumière"), contenu: <>
            <div className="row" style={{ justifyContent: "flex-end" }}><Pill ton="soft-blue" icon={<IcSun />}>≈ {Math.round((900 + n * l.dureeMs) / 1000)} s</Pill></div>
            <Curseur label={t("Durée par couleur")} valeur={l.dureeMs} min={800} max={1500} pas={100} unite="ms" onChange={(v) => setL({ dureeMs: v })} />
            <Curseur label={t("Fondu entre deux couleurs")} valeur={fondu} min={300} max={600} pas={50} unite="ms" aide={t("Jamais en dessous de 0,3 s : aucun flash.")} onChange={(v) => setL({ fonduMs: Math.max(300, v) })} />
            <Field label={t("Nombre de couleurs")}><Select value={n} onChange={(e) => setL({ etapes: Number(e.target.value) })}><option value={4}>4</option><option value={5}>{t("5 (recommandé)")}</option></Select></Field>
            <ApercuLumiere duree={l.dureeMs} fondu={fondu} n={n} />
            <p className="t-small faint">{t("Couleurs tirées au hasard à chaque test, rouge adouci. Le candidat est prévenu avant et peut toujours passer cette étape.")}</p>
          </> },
          { id: "email", icone: <IcMail />, titre: t("E-mail envoyé au candidat"), contenu: <>
            <Field label={t("Objet")}><Input value={r.textesLien.objet} onChange={(e) => setT({ objet: e.target.value })} /></Field>
            <Field label={t("Texte d'introduction")} hint={t("{prenom} est remplacé par le prénom du candidat.")}><Textarea rows={4} value={r.textesLien.intro} onChange={(e) => setT({ intro: e.target.value })} /></Field>
            <div className="row wrap" style={{ gap: 10 }}>
              <Btn icon={<IcMail />} onClick={voirEmail}>{t("Voir l'e-mail")}</Btn>
              <Btn variant="ghost" icon={<IcRefresh />} onClick={retablir}>{t("Rétablir le texte d'origine")}</Btn>
            </div>
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span className="t-small" style={{ fontWeight: 700 }}>{t("Envoi")}</span>
              {envoi === null ? <Pill dot>{t("Vérification…")}</Pill> : envoi === "inconnu" ? <Pill dot>{t("Serveur d'envoi absent")}</Pill> : envoi.test ? <Pill ton="soft-violet" dot>{t("Mode test")}</Pill> : envoi.configure ? <Pill ton="soft-green" icon={<IcCheck />}>{t("Envoi automatique actif")}</Pill> : <Pill dot>{t("Envoi manuel")}</Pill>}
            </div>
            <p className="t-small muted">
              {envoi !== null && envoi !== "inconnu" && envoi.configure && !envoi.test ? t("Les liens partent directement dans la boîte du candidat.") : envoi !== null && envoi !== "inconnu" && envoi.test ? t("Rien ne part : chaque e-mail est enregistré dans le dossier outbox/.") : t("Sans identifiants SMTP, Oval rédige l'e-mail et l'ouvre dans votre messagerie : il reste à cliquer sur Envoyer.")}
              {" "}{t("Pour l'envoi automatique, copiez le modèle (")}<span className="kbd">cp .env.example .env</span>{t("), renseignez votre serveur SMTP et relancez")} <span className="kbd">npm run dev</span>.
            </p>
          </> },
          { id: "equipe", icone: <IcHand />, titre: t("Équipe de recrutement"), contenu: <>
            <ul className="equipe">{etat.recruteurs.map((p) => <li key={p.id}><Avatar initiales={p.initiales} couleur={p.couleur} photo={p.photo} size="sm" /><span className="grow">{p.nom}</span>{p.id === etat.moi && <Pill ton="soft-blue">{t("Vous")}</Pill>}</li>)}</ul>
          </> },
          { id: "regles", icone: <IcCheck />, titre: t("Ce que l'outil fait, et ne fait pas"), contenu: <>
            <ul className="regles">{REGLES.map((regle) => <li key={regle}><span className="regles__ic"><IcCheck /></span>{regle}</li>)}</ul>
          </> },
          { id: "demo", icone: <IcDot />, titre: t("Démo"), contenu: <>
            <p className="t-small muted">{t("Les dates des données d'exemple sont calculées au chargement. Réinitialisez juste avant le pitch pour que l'entretien d'Emma soit « dans 20 min ».")}</p>
            <div><Btn icon={<IcRefresh />} onClick={() => setConfirmer(true)}>{t("Réinitialiser la démo")}</Btn></div>
          </> },
        ]} />
      </div>

      <Modal open={confirmer} onClose={() => setConfirmer(false)} title={t("Réinitialiser la démo ?")}>
        <p className="muted">{t("Les entretiens créés, les défis menés et les décisions prises seront remplacés par les données d'exemple.")}</p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <Btn variant="ghost" onClick={() => setConfirmer(false)}>{t("Annuler")}</Btn>
          <Btn variant="primary" icon={<IcRefresh />} onClick={() => { actions.reinitialiser(); setConfirmer(false); toast(t("Démo réinitialisée : données d'exemple rechargées")); }}>{t("Réinitialiser")}</Btn>
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
      <Btn size="sm" variant="glass" icon={<IcPlay />} onClick={jouer} className="apercu-lum__btn">{i === -1 ? t("Aperçu de la séquence") : t("Lecture…")}</Btn>
    </div>
  );
}
