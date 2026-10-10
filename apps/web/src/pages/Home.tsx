import { useState } from 'react';
import type { SessionView } from '@kyc/shared';
import { api } from '../config.ts';

// Écran recruteur : crée un entretien et donne les liens à envoyer.
export function Home() {
  const [label, setLabel] = useState('Candidat démo');
  const [session, setSession] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origin = window.location.origin;

  async function create() {
    try {
      setSession(await api.createSession(label));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="page">
      <h1>KYC Visio</h1>
      <p className="muted">Vérifier qu'un humain réel est présent en visio. Le recruteur décide, l'outil éclaire.</p>

      <div className="card">
        <label>
          Nom ou référence du candidat
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <button className="primary" onClick={create}>
          Créer un entretien
        </button>
        {error && <p className="muted">Serveur injoignable : {error}</p>}
      </div>

      {session && (
        <div className="card">
          <p>
            Identifiant d'entretien (à coller dans l'extension) : <code>{session.id}</code>
          </p>
          <p>
            1. Lien de pré-vérification à envoyer au candidat :<br />
            <code>{`${origin}/check/${session.id}`}</code>
          </p>
          <p>
            2. Visio de secours, côté candidat :<br />
            <code>{`${origin}/visio/${session.id}?role=candidate`}</code>
          </p>
          <p>
            3. Visio de secours, côté recruteur :{' '}
            <a href={`/visio/${session.id}?role=recruiter`} target="_blank" rel="noreferrer">
              ouvrir
            </a>
          </p>
          <p>
            4. <a href={`/report/${session.id}`}>Rapport d'entretien</a>
          </p>
        </div>
      )}
    </div>
  );
}
