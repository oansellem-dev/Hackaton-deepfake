import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getChallenge, type SessionView } from '@kyc/shared';
import { api } from '../config.ts';

const DECISION_LABEL = {
  continue: 'Poursuivre',
  extra_check: 'Vérification complémentaire',
  stop: "Fin de l'entretien",
} as const;

// Brique E : trace de l'entretien (signaux, défis, décision humaine). Aucune image.
export function Report() {
  const { id = '' } = useParams();
  const [session, setSession] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSession(id).then(setSession).catch((e) => setError(String(e)));
  }, [id]);

  if (error) return <div className="page">Erreur : {error}</div>;
  if (!session) return <div className="page">Chargement…</div>;

  return (
    <div className="page">
      <h1>Rapport d'entretien</h1>
      <p className="muted">
        {session.candidateLabel} · {new Date(session.createdAt).toLocaleString('fr-FR')} · entretien {session.id}
      </p>

      <div className="card">
        <h2>
          Score consultatif : {session.score.value}/100
        </h2>
        <ul>
          {session.score.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Signaux</h2>
        <ul className="status-list">
          {session.signals.map((s) => (
            <li key={s.id} className={`status-${s.status}`}>
              <strong>{s.label}</strong> — {s.detail}
            </li>
          ))}
          {session.signals.length === 0 && <li className="muted">Aucun signal relevé.</li>}
        </ul>
      </div>

      <div className="card">
        <h2>Défis</h2>
        <ul className="status-list">
          {session.challenges.map((c) => (
            <li key={c.at}>
              {getChallenge(c.challengeId)?.label ?? c.challengeId} : {c.result} ({(c.durationMs / 1000).toFixed(1)} s)
            </li>
          ))}
          {session.challenges.length === 0 && <li className="muted">Aucun défi proposé.</li>}
        </ul>
      </div>

      <div className="card">
        <h2>Décision du recruteur</h2>
        <p>
          {session.decision
            ? `${DECISION_LABEL[session.decision.value]} — ${new Date(session.decision.at).toLocaleTimeString('fr-FR')}`
            : 'Pas encore de décision.'}
        </p>
        <p className="muted">Le score est une aide. La décision appartient au recruteur.</p>
      </div>

      <button className="primary" onClick={() => window.print()}>
        Imprimer / PDF
      </button>
    </div>
  );
}
