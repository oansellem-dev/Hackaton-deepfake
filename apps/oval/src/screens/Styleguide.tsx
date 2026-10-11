import { useState } from "react";
import { Avatar, Avatars, Bar, Btn, Field, ICirc, Input, Modal, Pill, Select, Tabs, Textarea, transition, type BarTon } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcArrowUR, IcBell, IcCal, IcCheck, IcClock, IcDot, IcFilter, IcGear, IcHand, IcHome, IcList, IcMail, IcPlus, IcSearch, IcSpark, IcSun, IcFlag, IcPlay, IcDots } from "../ui/icons";
import { Manta, type MantaState } from "../manta/Manta";
import { BouncyAccordion } from "../ui/BouncyAccordion";
import "./styleguide.css";

const ETATS: { s: MantaState; t: string; halo?: string }[] = [
  { s: "neutre", t: "Tout va bien. Je regarde avec vous." },
  { s: "defi", t: "Demandez-lui : pouvez-vous passer la main devant votre visage ?" },
  { s: "analyse", t: "Je vérifie le geste…" },
  { s: "signal", t: "Signal à vérifier : l'image s'est déformée pendant le geste." },
  { s: "verifie", t: "Présence humaine vérifiée." },
  { s: "lumiere", t: "J'éclaire ton visage avec quelques couleurs.", halo: "#f4a259" },
];

export function Styleguide() {
  const [tab, setTab] = useState("tous");
  const [nav, setNav] = useState("accueil");
  const [modal, setModal] = useState(false);
  const [liste, setListe] = useState(["Emma Perrin", "Noah Martin", "Léo Carlier", "Ava Tessier", "Mia Roche"]);
  const [erreur, setErreur] = useState(false);
  const melanger = () => transition(() => setListe((l) => [...l].sort(() => Math.random() - .5)));

  return (
    <div className="sg-outer">
      <div className="shell sg-shell">
        <header className="sg-head rise" style={{ "--i": 0 } as React.CSSProperties}>
          <div className="row" style={{ gap: 14 }}><span className="logo-o" aria-hidden /><h1 className="t-display">Système de design Oval</h1></div>
          <p className="muted">Relief doux entre verre dépoli et néomorphisme. Trois niveaux : panneau, carte, creux. La couleur ne porte jamais le sens seule.</p>
        </header>

        {/* 1. Matière */}
        <section className="panel sg-section rise" style={{ "--i": 1 } as React.CSSProperties}>
          <h2 className="t-h2">1 · Matière et profondeur</h2>
          <div className="sg-grid-3">
            <div className="card sg-demo"><span className="t-caption">Panneau → carte</span><p>Liseré blanc en haut à gauche, ombre froide large en bas à droite.</p></div>
            <div className="inset sg-demo"><span className="t-caption">Élément en creux</span><p>Champs, onglet actif, fonds secondaires.</p></div>
            <div className="sg-demo sg-oncolor"><span className="pill pill--glass">• Pastille en verre</span><span className="pill pill--glass">• Flou + saturation</span><span className="pill pill--glass">Posée sur une couleur</span></div>
          </div>
          <div className="sg-grid-3" style={{ marginTop: 14 }}>
            <div className="card sg-demo"><span className="t-caption">Élément incliné</span><p>Un seul par écran, 2 à 3°, ombre plus forte : voir la barre « Signal à vérifier » en 5.</p></div>
            <div className="hatch sg-demo"><span className="t-caption">Week-end hachuré</span></div>
            <div className="card sg-demo lift"><span className="t-caption">Survol</span><p>Se soulève d'1,5 px, l'ombre s'élargit. Pression : s'enfonce.</p></div>
          </div>
        </section>

        {/* 2. Couleur */}
        <section className="panel sg-section rise" style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className="t-h2">2 · Couleur</h2>
          <div className="sg-swatches">
            {[["--bg-outer", "Extérieur"], ["--shell", "Coque"], ["--panel", "Panneau"], ["--card", "Carte"], ["--inset", "Creux"], ["--ink", "Texte"], ["--ink-2", "Secondaire"], ["--ink-3", "Discret"], ["--blue", "Aujourd'hui / actif"]].map(([v, l]) => (
              <div key={v} className="sg-swatch"><span className="sg-swatch__c" style={{ background: `var(${v})` }} /><span className="t-small">{l}</span><code className="t-caption">{v}</code></div>
            ))}
          </div>
          <div className="row wrap" style={{ gap: 10, marginTop: 16 }}>
            <Pill ton="green" dot>Présence vérifiée</Pill>
            <Pill ton="gold" dot>Signal à vérifier</Pill>
            <Pill ton="violet" dot>Lien envoyé</Pill>
            <Pill ton="blue" dot>À venir</Pill>
            <Pill ton="today" icon={<IcClock />}>Dans 15 min</Pill>
            <Pill ton="navy">Entretien</Pill>
            <Pill dot>Non faite</Pill>
            <Pill ton="soft-green" icon={<IcCheck />}>Faite · Cohérent</Pill>
            <Pill ton="soft-gold" dot>À vérifier</Pill>
            <Pill ton="soft-violet">… Lien envoyé</Pill>
            <Pill ton="soft-blue" icon={<IcClock />}>À venir</Pill>
          </div>
          <p className="t-small muted" style={{ marginTop: 10 }}>Vert, violet, bleu pâle, jaune doré : dégradés à deux tons, reflet interne, ombre colorée. Pas de rouge : « signal à vérifier » est doré.</p>
        </section>

        {/* 3. Typo */}
        <section className="panel sg-section rise" style={{ "--i": 3 } as React.CSSProperties}>
          <h2 className="t-h2">3 · Typographie — Manrope</h2>
          <div className="sg-type">
            <p className="t-display">Entretiens à venir <span className="faint">38 / 500</span></p>
            <p className="t-h1">Déroulé de l'entretien <span className="faint">30 / 500</span></p>
            <p className="t-h2">Signaux relevés <span className="faint">22 / 600</span></p>
            <p className="t-h3">Ce que je vérifie <span className="faint">16 / 700</span></p>
            <p className="t-body">Trois défis sur quatre sont réussis et l'environnement est cohérent. <span className="faint">15 / 500</span></p>
            <p className="t-small muted">Développeur full-stack · Lun 12 oct., 14:00 · 42 min <span className="faint">13 / 500</span></p>
            <p className="t-caption">PRÉ-VÉRIFICATION · 12 / 600</p>
          </div>
        </section>

        {/* 4. Boutons */}
        <section className="panel sg-section rise" style={{ "--i": 4 } as React.CSSProperties}>
          <h2 className="t-h2">4 · Boutons et cercles</h2>
          <div className="row wrap" style={{ gap: 12 }}>
            <Btn variant="primary" icon={<IcMail />} onClick={() => toast("Lien de pré-vérification envoyé à Camille Royer")}>Envoyer le lien de pré-vérification</Btn>
            <Btn icon={<IcPlus />} onClick={() => toast("Entretien créé", "info")}>Nouvel entretien</Btn>
            <Btn variant="now" icon={<IcPlay />} onClick={() => toast("Panneau Oval ouvert")}>Rejoindre maintenant</Btn>
            <Btn icon={<IcArrowUR />} onClick={() => toast("Rapport ouvert")}>Rapport</Btn>
            <Btn variant="inset">Filtrer</Btn>
            <Btn variant="ghost">Annuler</Btn>
            <Btn size="sm" icon={<IcClock />}>14:00 – 15:00</Btn>
            <Btn variant="primary" size="sm" icon={<IcCheck />}>Il l'a fait</Btn>
            <Btn disabled>Désactivé</Btn>
          </div>
          <div className="row wrap" style={{ gap: 12, marginTop: 16 }}>
            <ICirc label="Rechercher"><IcSearch /></ICirc>
            <ICirc label="Notifications" badge={3}><IcBell /></ICirc>
            <ICirc label="Actif" active><IcHome /></ICirc>
            <ICirc label="Réglages" size="sm"><IcGear /></ICirc>
            <ICirc label="Grand" size="lg"><IcSpark /></ICirc>
            <ICirc label="En creux" inset><IcFilter /></ICirc>
          </div>
        </section>

        {/* 5. Barres */}
        <section className="panel sg-section rise" style={{ "--i": 5 } as React.CSSProperties}>
          <h2 className="t-h2">5 · Barres de statut (planning et déroulé)</h2>
          <div className="sg-bars">
            {([
              { ton: "green", icon: <IcCheck />, label: "Entretien fait", chip: "Présence vérifiée", msg: "Rapport d'Ava Tessier" },
              { ton: "violet", icon: <IcArrowUR />, label: "Lien envoyé", chip: "En attente", msg: "Fiche de Mia Roche" },
              { ton: "gold", icon: <IcFlag />, label: "Entretien fait", chip: "Signal à vérifier", attention: true, msg: "Rapport de Noah Martin" },
              { ton: "blue", icon: <IcClock />, label: "Entretien · 11:00", chip: "Mar 13", msg: "Entretien de Léo Carlier" },
              { ton: "now", icon: <IcPlay />, label: "Entretien · 14:20", chip: "Aujourd'hui", msg: "Panneau Oval ouvert" },
              { ton: "neutral", icon: <IcDots />, label: "Lien envoyé", chip: "Non faite", msg: "Pas un signal négatif" },
            ] as { ton: BarTon; icon: React.ReactNode; label: string; chip: string; attention?: boolean; msg: string }[]).map((b, i) => (
              <div key={i} className="grow-x" style={{ "--i": i } as React.CSSProperties}><Bar ton={b.ton} icon={b.icon} label={b.label} chip={b.chip} attention={b.attention} onClick={() => toast(b.msg)} /></div>
            ))}
          </div>
          <div className="sg-cal" style={{ marginTop: 16 }}>
            {["Lun 5", "Mar 6", "Mer 7", "Jeu 8", "Ven 9", "Sam 10", "Dim 11", "Lun 12", "Mar 13", "Mer 14"].map((j, i) => {
              const we = i === 5 || i === 6; const today = i === 8;
              const [n, d] = j.split(" ");
              return <div key={j} className={`daytag ${we ? "daytag--we" : ""} ${today ? "daytag--today" : ""}`}><span>{n}<b>{d}</b></span></div>;
            })}
            {Array.from({ length: 10 }).map((_, i) => <div key={i} className={`cell ${i === 5 || i === 6 ? "cell--we" : ""}`} />)}
            <i className="sg-today" aria-hidden />
          </div>
        </section>

        {/* 6. Onglets et navigation */}
        <section className="panel sg-section rise" style={{ "--i": 6 } as React.CSSProperties}>
          <h2 className="t-h2">6 · Onglets, recherche, navigation</h2>
          <div className="row wrap" style={{ gap: 16 }}>
            <Tabs pills value={nav} onChange={setNav} items={[{ id: "accueil", label: "Tableau de bord", icon: <IcHome /> }, { id: "entretiens", label: "Entretiens", icon: <IcList /> }, { id: "defis", label: "Défis", icon: <IcSpark /> }]} />
            <ICirc label="Rechercher" size="sm"><IcSearch /></ICirc>
            <Avatars><Avatar initiales="JE" couleur="blue" title="Jules E." /><Avatar initiales="CL" couleur="coral" title="Clara L." /><Avatar initiales="TS" couleur="green" title="Théo S." /></Avatars>
            <Btn icon={<IcPlus />}>Nouvel entretien</Btn>
            <ICirc label="Signaux à vérifier" badge={1}><IcBell /></ICirc>
          </div>
          <div className="row wrap" style={{ gap: 16, marginTop: 16 }}>
            <Tabs pills value={tab} onChange={setTab} items={[{ id: "tous", label: "Tous", count: 12 }, { id: "venir", label: "À venir", count: 5 }, { id: "signal", label: "Signal à vérifier", count: 1 }, { id: "ok", label: "Présence vérifiée", count: 6 }]} />
            <label className="search"><IcSearch width={16} height={16} /><input placeholder="Rechercher un candidat" /></label>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            {["Accueil", "Entre-tiens", "Défis"].map((l, i) => <button key={l} className="rail__item" aria-current={i === 0 ? "page" : undefined}>{l}</button>)}
            <span className="t-small muted">← rail latéral (le dernier, Réglages, est en bas)</span>
          </div>
        </section>

        {/* 7. Champs */}
        <section className="panel sg-section rise" style={{ "--i": 7 } as React.CSSProperties}>
          <h2 className="t-h2">7 · Champs en creux</h2>
          <div className="sg-grid-3">
            <Field label="Candidat"><Input placeholder="Prénom Nom" defaultValue="Camille Royer" /></Field>
            <Field label="E-mail" error={erreur ? "Cet e-mail ne semble pas valide." : undefined}><Input placeholder="prenom.nom@exemple.fr" error={erreur} onChange={(e) => setErreur(!!e.target.value && !/\S+@\S+\.\S+/.test(e.target.value))} /></Field>
            <Field label="Poste"><Select defaultValue="front"><option value="front">Développeuse front-end</option><option>Designer UI/UX</option><option>Architecte cloud</option></Select></Field>
          </div>
          <div className="sg-grid-3" style={{ marginTop: 14 }}>
            <Field label="Date"><Input type="date" /></Field>
            <Field label="Heure"><Input type="time" defaultValue="10:00" /></Field>
            <Field label="Note pour l'équipe" hint="Visible dans le rapport."><Textarea placeholder="Ajouter une note…" /></Field>
          </div>
        </section>

        {/* 8. Avatars et cartes */}
        <section className="panel sg-section rise" style={{ "--i": 8 } as React.CSSProperties}>
          <h2 className="t-h2">8 · Avatars et cartes candidat</h2>
          <div className="row wrap" style={{ gap: 14 }}>
            {(["blue", "violet", "green", "gold", "coral", "navy", "pink", "teal"] as const).map((c, i) => <Avatar key={c} couleur={c} initiales={["EP", "LC", "NM", "AT", "MR", "HB", "IM", "CR"][i]} />)}
            <Avatar couleur="blue" initiales="JE" size="lg" /><Avatar couleur="coral" initiales="CL" size="xl" />
          </div>
          <div className="sg-grid-3" style={{ marginTop: 16 }}>
            <div className="card lift sg-cand"><Avatar couleur="coral" initiales="EP" /><div><strong>Emma Perrin</strong><div className="t-small muted">Développeuse back-end</div></div></div>
            <div className="card lift sg-cand sg-cand--today"><div className="row row--between"><strong>Emma Perrin</strong><Pill ton="glass">• Dans 15 min</Pill></div><div className="t-small" style={{ opacity: .8 }}>Développeuse back-end · pré-vérification faite</div><div className="row" style={{ gap: 8, marginTop: 8 }}><Btn size="sm" icon={<IcClock />}>14:00 – 15:00</Btn><Btn size="sm" variant="glass" icon={<IcPlay />}>Rejoindre avec Oval</Btn></div></div>
            <div className="card lift sg-cand" style={{ flexDirection: "column", alignItems: "center", textAlign: "center" }}><Avatar couleur="green" initiales="LM" size="lg" /><strong>Lucas Morin</strong><span className="t-small muted">Développeur mobile</span><Pill ton="soft-green" icon={<IcCheck />}>3/4 · Lumière passée</Pill></div>
          </div>
        </section>

        {/* 9. Manta */}
        <section className="panel sg-section rise" style={{ "--i": 9 } as React.CSSProperties}>
          <h2 className="t-h2">9 · Manta, six états <span className="t-small muted">(cliquez-la : ressort)</span></h2>
          <div className="sg-manta">
            {ETATS.map(({ s, t, halo }) => (
              <div className="card sg-manta__card" key={s}>
                <Manta state={s} size={110} haloColor={halo} title={s} />
                <Pill ton={s === "signal" ? "gold" : s === "verifie" ? "green" : "soft-blue"}>{s}</Pill>
                <p className="t-small" style={{ textAlign: "center" }}>{t}</p>
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 12, marginTop: 14 }}><Manta size={48} /><span className="t-small muted">48 px : taille minimale dans le panneau.</span></div>
        </section>

        {/* 10. Mouvement */}
        <section className="panel sg-section rise" style={{ "--i": 10 } as React.CSSProperties}>
          <h2 className="t-h2">10 · Mouvement</h2>
          <div className="row wrap" style={{ gap: 12 }}>
            <Btn variant="primary" onClick={() => setModal(true)}>Ouvrir une fenêtre (fond flouté)</Btn>
            <Btn onClick={() => toast("Décision enregistrée : poursuivre le recrutement")}>Message discret</Btn>
            <Btn onClick={melanger}>Réorganiser la liste</Btn>
            <span className="t-small muted">180–260 ms · <span className="kbd">transform</span> et <span className="kbd">opacity</span> seulement · <span className="kbd">prefers-reduced-motion</span> : fondus uniquement</span>
          </div>
          <ul className="sg-list" style={{ marginTop: 14 }}>
            {liste.map((n, i) => <li key={n} className="card sg-list__item" style={{ viewTransitionName: `sg-${n.replace(/\W/g, "")}` } as React.CSSProperties}><Avatar couleur={(["coral", "navy", "blue", "green", "gold"] as const)[i % 5]} initiales={n.split(" ").map((x) => x[0]).join("")} size="sm" /><span>{n}</span></li>)}
          </ul>
        </section>

        {/* 11. Vocabulaire */}
        <section className="panel sg-section rise" style={{ "--i": 11 } as React.CSSProperties}>
          <h2 className="t-h2">11 · Accordéon « bouncy » <span className="t-small muted">(cliquez une ligne : elle se détache sur un ressort)</span></h2>
          <BouncyAccordion ouvertParDefaut="planning" items={[
            { id: "preverif", icone: <IcCheck />, titre: "Pré-vérification", contenu: "Le candidat passe trois défis courts depuis son téléphone, avant l'entretien." },
            { id: "signaux", icone: <IcFlag />, titre: "Signaux", contenu: "Jamais de verdict : des signaux à vérifier, expliqués un par un, à votre appréciation." },
            { id: "planning", icone: <IcCal />, titre: "Planning", contenu: "Entretiens de la semaine, rappels et détection des chevauchements." },
            { id: "visio", icone: <IcPlay />, titre: "Rejoindre avec Google Meet", contenu: "La réunion s'ouvre dans Meet ou Zoom ; l'extension Oval observe la présence humaine à côté." },
            { id: "alertes", icone: <IcBell />, titre: "Alertes", contenu: "Un signal à vérifier pendant l'entretien remonte ici, sans interrompre l'échange." },
            { id: "reglages", icone: <IcGear />, titre: "Réglages", contenu: "Équipe, envoi des e-mails, source des données." },
          ]} />
        </section>

        <section className="panel sg-section rise" style={{ "--i": 12 } as React.CSSProperties}>
          <h2 className="t-h2">12 · Règles de contenu</h2>
          <div className="row wrap" style={{ gap: 10 }}>
            <Pill ton="soft-green" icon={<IcCheck />}>« Présence humaine vérifiée »</Pill>
            <Pill ton="soft-green" icon={<IcCheck />}>« Signal à vérifier »</Pill>
            <Pill ton="soft-green" icon={<IcCheck />}>« Non faite », « Étape passée » : neutres</Pill>
            <Pill>Jamais « faux candidat »</Pill>
            <Pill>Jamais « identité vérifiée »</Pill>
            <Pill>Jamais de taux de fraude</Pill>
          </div>
          <div className="row wrap" style={{ gap: 10, marginTop: 12 }}>
            <Pill ton="soft-blue" icon={<IcSun />}>Lumière : fondus 0,3 s, jamais de flash</Pill>
            <Pill ton="soft-blue" icon={<IcHand />}>Geste : main devant le visage</Pill>
            <Pill ton="soft-blue" icon={<IcCal />}>Le recruteur décide</Pill>
          </div>
        </section>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvel entretien">
        <div className="col">
          <Field label="Candidat"><Input placeholder="Prénom Nom" /></Field>
          <Field label="E-mail"><Input placeholder="prenom.nom@exemple.fr" /></Field>
          <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 6 }}><Btn variant="ghost" onClick={() => setModal(false)}>Annuler</Btn><Btn variant="primary" icon={<IcMail />} onClick={() => { setModal(false); toast("Lien envoyé"); }}>Envoyer le lien</Btn></div>
        </div>
      </Modal>
    </div>
  );
}
