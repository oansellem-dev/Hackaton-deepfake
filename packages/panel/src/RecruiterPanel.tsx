import { useEffect, useMemo, useRef, useState } from 'react';
import { pickChallenge, type Challenge, type Decision, type SessionView } from '@kyc/shared';
import { createApi } from './api.ts';
import { stubDetector, type ChallengeDetector } from './detector.ts';
import { Mascot } from './Mascot.tsx';
import './panel.css';

interface Props {
  sessionId: string;
  stream: MediaStream | null;
  apiBase?: string;
  detector?: ChallengeDetector;
  reportUrl?: string;
}

const LEVEL_LABEL = {
  green: 'Aucun signal à vérifier',
  orange: 'Signal à vérifier',
  red: 'Plusieurs signaux à vérifier',
} as const;

const DECISIONS: { value: Decision; label: string }[] = [
  { value: 'continue', label: 'Poursuivre' },
  { value: 'extra_check', label: 'Vérification complémentaire' },
  { value: 'stop', label: "Mettre fin à l'entretien" },
];

export function RecruiterPanel({ sessionId, stream, apiBase, detector = stubDetector, reportUrl }: Props) {
  const api = useMemo(() => createApi(apiBase), [apiBase]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [session, setSession] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge>(() => pickChallenge());
  const [running, setRunning] = useState(false);

  // Flux capturé → <video> local. Analysé dans le navigateur, jamais enregistré.
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      api
        .getSession(sessionId)
        .then((s) => alive && (setSession(s), setError(null)))
        .catch((e) => alive && setError(String(e)));
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [api, sessionId]);

  async function runChallenge() {
    if (!videoRef.current || !stream) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    const start = performance.now();
    try {
      const result = await detector(videoRef.current, challenge, controller.signal);
      const updated = await api.sendChallenge(sessionId, challenge.id, result, Math.round(performance.now() - start));
      setSession(updated);
      setChallenge(pickChallenge(updated.challenges.map((c) => c.challengeId)));
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  async function decide(value: Decision) {
    setSession(await api.sendDecision(sessionId, value));
  }

  const mascotMessage = !stream
    ? "Je n'ai pas encore d'image. Lancez la capture de la visio."
    : running
      ? "J'observe l'image pendant le défi…"
      : session?.score.level && session.score.level !== 'green'
        ? `Un signal est à vérifier, rien n'est confirmé. ${challenge.mascotLine}`
        : challenge.mascotLine;

  return (
    <div className="kyc-panel">
      <video ref={videoRef} className="kyc-preview" autoPlay playsInline muted />

      {session && (
        <div className={`kyc-score kyc-${session.score.level}`}>
          <span className="kyc-score-value">{session.score.value}</span>
          <span className="kyc-score-label">{LEVEL_LABEL[session.score.level]}</span>
        </div>
      )}

      {session && (
        <ul className="kyc-explanation">
          {session.score.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      <Mascot message={mascotMessage} busy={running} />

      <div className="kyc-actions">
        <button disabled={!stream || running} onClick={runChallenge}>
          {running ? 'Analyse en cours…' : `J'ai proposé : ${challenge.label}`}
        </button>
        {running ? (
          <button className="kyc-secondary" onClick={() => abortRef.current?.abort()}>
            Annuler
          </button>
        ) : (
          <button className="kyc-secondary" onClick={() => setChallenge(pickChallenge([challenge.id]))}>
            Autre défi
          </button>
        )}
      </div>

      <div className="kyc-decision">
        <span>Votre décision{session?.decision ? ' (enregistrée)' : ''}</span>
        {DECISIONS.map((d) => (
          <button
            key={d.value}
            className={session?.decision?.value === d.value ? 'kyc-selected' : 'kyc-secondary'}
            onClick={() => decide(d.value)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {reportUrl && (
        <a className="kyc-report-link" href={reportUrl} target="_blank" rel="noreferrer">
          Rapport d'entretien
        </a>
      )}
      {error && <p className="kyc-error">Serveur injoignable : {error}</p>}
    </div>
  );
}
