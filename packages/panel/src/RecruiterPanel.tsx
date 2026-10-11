import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getChallenge,
  pickChallenge,
  type Challenge,
  type Decision,
  type LiveSample,
  type SessionView,
} from '@kyc/shared';
import { createApi } from './api.ts';
import { stubDetector, type ChallengeDetector } from './detector.ts';
import { Manta, type MantaState } from '@kyc/design';
import './panel.css';

// Mesure du visage affiché, faite dans le navigateur du recruteur (MediaPipe + ONNX côté site) : jamais d'image.
export type LiveSampler = (video: HTMLVideoElement) => Promise<LiveSample | null>;

interface Props {
  sessionId: string;
  stream: MediaStream | null;
  apiBase?: string;
  detector?: ChallengeDetector;
  reportUrl?: string;
  // Absent : pas de comparaison avec la pré-vérification ni de détecteur passif.
  liveSampler?: LiveSampler;
  recruiterKey?: string; // jeton donné à la création de l'entretien
  onSession?: (session: SessionView) => void; // hôte du panneau (widget flottant) : score et niveau
}

const LEVEL_LABEL = {
  green: 'Aucun signal à vérifier',
  orange: 'Signal à vérifier',
  red: 'Plusieurs signaux à vérifier',
} as const;

const DECISIONS: { value: Decision; label: string }[] = [
  { value: 'poursuivre', label: 'Poursuivre le recrutement' },
  { value: 'refaire_defi', label: 'Refaire un défi au prochain échange' },
  { value: 'presentiel', label: 'Proposer un entretien en présentiel' },
];

const SAMPLE_INTERVAL_MS = 2000;

// Prochain défi : celui que recommande l'agent s'il est connu du panneau, sinon un tirage au hasard.
function nextChallenge(session: SessionView): Challenge {
  // Les défis de la pré-vérification restent utiles en direct : seuls ceux de l'entretien sont écartés.
  const done = session.challenges.filter((c) => c.phase !== 'precheck').map((c) => c.challengeId);
  // Ordre imprévisible pour le candidat : l'un des deux défis les plus utiles, tiré au hasard
  // (une vidéo préparée ou un trucage réglé à l'avance ne peut pas anticiper le prochain geste).
  const recs = session.agent?.recommendations.filter((r) => getChallenge(r.challengeId)) ?? [];
  const rec = recs[Math.floor(Math.random() * Math.min(2, recs.length))];
  if (rec) return { ...getChallenge(rec.challengeId)!, mascotLine: rec.phrase };
  return pickChallenge(done);
}

export function RecruiterPanel({
  sessionId,
  stream,
  apiBase,
  detector = stubDetector,
  reportUrl,
  liveSampler,
  recruiterKey,
  onSession,
}: Props) {
  const api = useMemo(() => createApi(apiBase, recruiterKey), [apiBase, recruiterKey]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [session, setSessionRaw] = useState<SessionView | null>(null);
  const setSession = (s: SessionView) => { setSessionRaw(s); onSession?.(s); };
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge>(() => pickChallenge());
  const [running, setRunning] = useState(false);
  const [faceSeen, setFaceSeen] = useState<boolean | null>(null); // dernier échantillon : visage suivi ?
  const [showWhy, setShowWhy] = useState(false);
  const followedRec = useRef(false);

  // Flux capturé → <video> local. Analysé dans le navigateur, jamais enregistré.
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // Toutes les 2 s : empreinte, proportions et probabilité de trucage du visage affiché, calculées ici et comparées
  // côté serveur au profil de la pré-vérification. Si une mesure échoue, c'est sans effet sur le score.
  useEffect(() => {
    if (!stream || !liveSampler) return;
    let busy = false;
    const timer = setInterval(async () => {
      const video = videoRef.current;
      if (busy || !video) return;
      busy = true;
      try {
        const sample = await liveSampler(video);
        setFaceSeen(!!sample);
        if (sample) await api.sendLiveSample(sessionId, sample);
      } catch {
        /* mesure impossible : sans effet sur le score */
      } finally {
        busy = false;
      }
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [api, sessionId, stream, liveSampler]);

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
          const liveDone = s.challenges.some((c) => c.phase !== 'precheck');
          if (!followedRec.current && !liveDone && s.agent?.recommendations[0]) {
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
      const outcome = await detector(videoRef.current, challenge, controller.signal);
      const { result, metrics } = typeof outcome === 'string' ? { result: outcome, metrics: undefined } : outcome;
      const updated = await api.sendChallenge(
        sessionId,
        challenge.id,
        result,
        Math.round(performance.now() - start),
        metrics,
      );
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

  // Manta ne parle qu'au recruteur et n'accuse jamais : « signal » = un point à vérifier, pas un verdict.
  const mantaState: MantaState = !stream ? 'neutre' : running ? 'analyse' : session?.decision ? 'verifie' : session?.score.level && session.score.level !== 'green' ? 'signal' : 'defi';
  const verified = (session?.score.evidence ?? 0) > 0 || (session?.score.level ?? 'green') !== 'green';
  const level = session?.score.level ?? 'green';
  const R = 26;
  const C = 2 * Math.PI * R;
  const liveDone = session?.challenges.filter((c) => c.phase !== 'precheck') ?? [];

  return (
    <div className="kyc-panel">
      {/* Aperçu : flux capturé, analysé ici, jamais enregistré */}
      <div className={`kyc-stage${stream ? ' is-live' : ''}`}>
        <video ref={videoRef} className="kyc-preview" autoPlay playsInline muted />
        {stream ? (
          <span className={`kyc-live${faceSeen === false ? ' is-lost' : ''}`}>
            <i />
            {faceSeen === false ? 'Aucun visage à l’écran' : faceSeen ? 'Visage suivi · analyse locale' : 'En direct'}
          </span>
        ) : (
          <span className="kyc-stage-empty">En attente de la visio</span>
        )}
        {running && <div className="kyc-scanline" aria-hidden />}
      </div>

      {/* Indice : anneau animé, jamais un verdict */}
      {session && (
        <div className={`kyc-score ${verified ? `kyc-${level}` : 'kyc-none'}`}>
          <svg className="kyc-ring" viewBox="0 0 64 64" aria-hidden>
            <circle cx="32" cy="32" r={R} className="kyc-ring-bg" />
            <circle cx="32" cy="32" r={R} className="kyc-ring-val" strokeDasharray={`${(verified ? session.score.value / 100 : 0) * C} ${C}`} transform="rotate(-90 32 32)" />
          </svg>
          <span className="kyc-score-value">{verified ? session.score.value : '—'}</span>
          <span className="kyc-score-text">
            <span className="kyc-score-label">{verified ? LEVEL_LABEL[level] : 'Pas encore vérifié'}</span>
            <button type="button" className="kyc-why" aria-expanded={showWhy} onClick={() => setShowWhy((v) => !v)}>
              {showWhy ? 'Masquer le détail' : 'Pourquoi ?'}
            </button>
          </span>
        </div>
      )}
      {session && showWhy && (
        <ul className="kyc-explanation kyc-pop">
          {session.score.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {/* Manta propose le défi */}
      <div className="kyc-mascot" key={mascotMessage}>
        <Manta size={56} state={mantaState} />
        <p className="kyc-bubble kyc-pop">{mascotMessage}</p>
      </div>

      <div className="kyc-actions">
        <button className={`kyc-main${running ? ' is-running' : ''}`} disabled={!stream || running} onClick={runChallenge}>
          {running ? (
            <>
              <i className="kyc-spin" /> Analyse en cours…
            </>
          ) : (
            <>
              <strong>J’ai proposé le défi</strong>
              <small>{challenge.label}</small>
            </>
          )}
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
      {!stream && <p className="kyc-hint">Partagez d’abord la fenêtre de la visio : le défi s’analyse sur l’image du candidat.</p>}
      {liveDone.length > 0 && (
        <ol className="kyc-done">
          {liveDone.map((c, i) => (
            <li key={i} className={`kyc-done-${c.result}`}>
              <i />
              <span>{getChallenge(c.challengeId)?.label ?? c.challengeId}</span>
              <small>{c.result === 'passed' ? 'réussi' : c.result === 'failed' ? 'à vérifier' : 'non concluant'}</small>
            </li>
          ))}
        </ol>
      )}

      <div className="kyc-decision">
        <span>Votre décision{session?.decision ? ' · enregistrée' : ''}</span>
        {DECISIONS.map((d) => (
          <button
            key={d.value}
            className={session?.decision?.value === d.value ? 'kyc-selected' : 'kyc-secondary'}
            aria-pressed={session?.decision?.value === d.value}
            onClick={() => decide(d.value)}
          >
            {session?.decision?.value === d.value && <i className="kyc-check" />}
            {d.label}
          </button>
        ))}
      </div>

      {reportUrl && (
        <a className="kyc-report-link" href={reportUrl} target="_blank" rel="noreferrer">
          Rapport d’entretien ↗
        </a>
      )}
      {error && <p className="kyc-error">Serveur injoignable : {error}</p>}
    </div>
  );
}
