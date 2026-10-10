export function Fin({ token }: { token: string }) {
  return (
    <>
      <h1>C'est terminé, à tout à l'heure.</h1>
      <p className="cand__intro">Merci pour ces deux minutes.</p>
      <div className="card">
        <p>Votre recruteur sait que la vérification technique est faite. Aucune vidéo n'a été enregistrée et vous pouvez fermer cette page.</p>
        <div className="card__rule" />
        <p className="muted small">Référence : {token}. Si vous avez une question sur ce que nous vérifions, demandez-la au recruteur : c'est lui qui décide, l'outil ne fait qu'éclairer.</p>
      </div>
    </>
  );
}
