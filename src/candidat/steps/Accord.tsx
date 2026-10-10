export function Accord({ onAccepter }: { onAccepter: () => void }) {
  return (
    <>
      <h1>Ce que nous vérifions, et ce que nous ne vérifions pas</h1>
      <div className="card">
        <h2 className="card__title">Vérifié</h2>
        <div className="card__rule" />
        <ul className="liste-check">
          <li><span className="pill pill--bleu">Oui</span>Les caméras que votre navigateur déclare, votre fuseau horaire et votre langue.</li>
          <li><span className="pill pill--bleu">Oui</span>Que votre visage réagit à la lumière de l'écran (quelques secondes de couleurs douces).</li>
          <li><span className="pill pill--bleu">Oui</span>Qu'un geste simple, la main devant le visage, s'affiche normalement à l'image.</li>
        </ul>
      </div>
      <div className="card">
        <h2 className="card__title">Jamais</h2>
        <div className="card__rule" />
        <ul className="liste-check">
          <li><span className="pill pill--gris">Non</span>Aucune vidéo ni photo n'est enregistrée. Tout se passe dans votre navigateur.</li>
          <li><span className="pill pill--gris">Non</span>Nous ne vérifions pas qui vous êtes, et nous ne comparons votre visage à aucun document.</li>
          <li><span className="pill pill--gris">Non</span>Aucune analyse d'émotions. Aucun verdict : le recruteur reste seul à décider.</li>
          <li><span className="pill pill--gris">Non</span>Passer une étape ne vous pénalise pas. Vous pouvez aussi demander un entretien sans cet outil.</li>
        </ul>
      </div>
      <div className="cand__actions">
        <button className="btn btn--primary" onClick={onAccepter}>J'ai compris, activer ma caméra</button>
      </div>
    </>
  );
}
