export function Reglages() {
  return (
    <>
      <header className="hero"><h1 className="hero__hi">Réglages</h1><div className="hero__center">Ce que l'outil fait, et ne fait pas</div><div /></header>
      <div className="rapport">
        <div className="card">
          <h2 className="card__title">Engagements</h2>
          <div className="card__rule" />
          <ul className="explications">
            <li>Tout se passe dans le navigateur. Aucune vidéo n'est stockée.</li>
            <li>On vérifie qu'un humain réel est présent, pas qui il est. Aucune comparaison avec une pièce d'identité.</li>
            <li>Ni analyse d'émotions, ni collecte de photos.</li>
            <li>L'absence d'information ne baisse jamais le score. Seules les contradictions comptent.</li>
            <li>Le score est consultatif. Le recruteur décide.</li>
          </ul>
        </div>
        <div className="card">
          <h2 className="card__title">Défis actifs</h2>
          <div className="card__rule" />
          <ul className="explications">
            <li>Main devant le visage</li>
            <li>Rotation de la tête</li>
            <li>Phrase à répéter</li>
          </ul>
          <p className="muted small" style={{ marginTop: 14 }}>La bibliothèque de défis est mise à jour chaque mois.</p>
        </div>
      </div>
    </>
  );
}
