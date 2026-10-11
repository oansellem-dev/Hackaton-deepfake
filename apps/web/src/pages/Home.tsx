import { useState } from 'react';
import type { SessionView } from '@kyc/shared';
import { api, recruiterKeyFor } from '../config.ts';

// Écran recruteur : crée un entretien et donne les liens à envoyer.
export function Home() {
  const [label, setLabel] = useState('Candidat démo');
  const [controllerName, setControllerName] = useState('');
  const [controllerContact, setControllerContact] = useState('');
  const [session, setSession] = useState<(SessionView & { recruiterKey: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origin = window.location.origin;

  async function create() {
    try {
      const created = await api.createSession(label, controllerName, controllerContact);
      recruiterKeyFor(created.id, created.recruiterKey);
      setSession(created);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  const link = session?.candidateLink;

  return (
    <div className="page">
      <h1>KYC Visio</h1>
      <p className="muted">Vérifier qu'un humain réel est présent en visio. Le recruteur décide, l'outil éclaire.</p>

      <div className="card">
        <label>
          Nom ou référence du candidat
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <div className="form-grid">
          <label>
            Votre entreprise (responsable du traitement)
            <input value={controllerName} onChange={(e) => setControllerName(e.target.value)} placeholder="ESN Exemple" />
          </label>
          <label>
            Contact pour les données personnelles
            <input
              value={controllerContact}
              onChange={(e) => setControllerContact(e.target.value)}
              placeholder="dpo@exemple.fr"
            />
          </label>
        </div>
        <p className="muted">Ces deux informations sont montrées au candidat avant qu’il donne son accord.</p>
        <button className="primary" onClick={create}>
          Créer un entretien
        </button>
        {error && <p className="muted">Serveur injoignable : {error}</p>}
      </div>

      <p className="muted">
        Équipe : <a href="/lab/flash">espace de test du reflet de l’écran</a> (essais et chiffres pour le jury).
      </p>

      {session && link && (
        <div className="card">
          <p>
            1. Lien de pré-vérification à envoyer au candidat (une seule utilisation, valable jusqu’au{' '}
            {new Date(link.expiresAt).toLocaleString('fr-FR')}) :<br />
            <code>{`${origin}/check/${link.token}`}</code>
          </p>
          <p>
            2. Pendant l’entretien sur <strong>Teams, Meet ou Zoom</strong> :{' '}
            <a href={`/panel/${session.id}?key=${session.recruiterKey}`} target="_blank" rel="noreferrer">
              ouvrir le panneau de vérification
            </a>{' '}
            puis partager la fenêtre de la visio.
          </p>
          <p>
            3. <a href={`/report/${session.id}?key=${session.recruiterKey}`}>Résultat de la pré-vérification et rapport</a>{' '}
            (se met à jour tout seul)
          </p>
          <p className="muted">Sans outil de visio, notre visio de secours :</p>
          <p>
            Visio de secours, côté candidat :<br />
            <code>{`${origin}/visio/${session.id}?role=candidate`}</code>
          </p>
          <p>
            Visio de secours, côté recruteur :{' '}
            <a href={`/visio/${session.id}?role=recruiter&key=${session.recruiterKey}`} target="_blank" rel="noreferrer">
              ouvrir
            </a>
          </p>
          <p className="muted">
            Code recruteur pour l’extension Chrome (ne pas transmettre au candidat) :{' '}
            <code>{`${session.id}:${session.recruiterKey}`}</code>
          </p>
        </div>
      )}
    </div>
  );
}
