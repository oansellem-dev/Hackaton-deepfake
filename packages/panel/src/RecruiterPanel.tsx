import { useEffect, useMemo, useRef, useState } from 'react';
import { getChallenge, pickChallenge, type Challenge, type Decision, type SessionView } from '@kyc/shared';
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

const FRAME_INTERVAL_MS = 2000;
const FRAME_MAX_WIDTH = 640;

// Prochain défi : celui que recommande l'agent s'il est connu du panneau, sinon un tirage au hasard.
function nextChallenge(session: SessionView): Challenge {
  const done = session.challenges.map((c) => c.challengeId);
  const rec = session.agent?.recommendations.find((r) => getChallenge(r.challengeId));
  if (rec) return { ...getChallenge(rec.challengeId)!, mascotLine: rec.phrase };
  return pickChallenge(done);
}

export function RecruiterPanel({ sessionId, stream, apiBase, detector = stubDetector, reportUrl }: Props) {
  const api = useMemo(() => createApi(apiBase), [apiBase]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [session, setSession] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge>(() => pickChallenge());
  const [running, setRunning] = useState(false);
  const followedRec = useRef(false);

  // Flux capturé → <video> local. Analysé dans le navigateur, jamais enregistré.
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // Détecteur passif : une capture réduite du flux toutes les 2 s, envoyée à l'agent local.
  // Si l'agent est arrêté, on ignore l'erreur : les défis et le score local continuent de fonctionner.
  useEffect(() => {
    if (!stream) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let busy = false;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (busy || !ctx || !video || video.readyState < 2 || video.videoWidth === 0) return;
      const scale = Math.min(1, FRAME_MAX_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      busy = true;
      canvas.toBlob(
        (blob) => {
          if (!blob) return void (busy = false);
          api
            .sendFrame(sessionId, blob)
            .catch(() => undefined)
            .finally(() => (busy = false));
        },
        'image/jpeg',
        0.8,
      );
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [api, sessionId, stream]);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      api
        .getSession(sessionId)
        .then((s) => {
          if (!alive) return;
          setSession(s);
          setError(null);
          // Première recommandation de l'agent : tant qu'aucun défi n'a été lancé, on la suit.
          if (!followedRec.current && s.challenges.length === 0 && s.agent?.recommendations[0]) {
            followedRec.current = true;
            setChallenge(nextChallenge(s));
          }
        })
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
      setChallenge(nextChallenge(updated));
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
