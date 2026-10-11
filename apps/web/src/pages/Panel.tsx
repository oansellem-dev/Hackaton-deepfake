import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { RecruiterPanel, createApi } from '@kyc/panel';
import type { SessionView } from '@kyc/shared';
import { API_BASE, recruiterKeyFor } from '../config.ts';
import { loadFaceModels } from '../lib/faceModels.ts';
import { createLiveDetector } from '../lib/liveDetector.ts';
import { loadTracker, sampleLive } from '../lib/tracker.ts';

// Panneau recruteur pour une visio Teams, Meet ou Zoom : le recruteur garde son outil de visio et partage ici la
// fenêtre de l'appel. Tout est analysé dans ce navigateur (plus grand visage affiché = le candidat) ; rien n'est
// enregistré ni envoyé, seulement des mesures. Aussi affiché dans le panneau latéral de l'extension Chrome.
export function Panel() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const recruiterKey = recruiterKeyFor(id, params.get('key'));
  // Mode widget : affiché dans la bulle flottante de l'extension, sans en-tête ni pied, et le score remonte à l'hôte.
  const widget = params.get('widget') === '1';
  const detector = useMemo(() => createLiveDetector(id, recruiterKey), [id, recruiterKey]);
  const api = useMemo(() => createApi(API_BASE, recruiterKey), [recruiterKey]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presenceUrl, setPresenceUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Confirmation d'appareil : lien à usage unique à coller dans la discussion Teams ; le candidat confirme avec la
  // clé d'accès créée à la pré-vérification.
  async function requestPresence() {
    setError(null);
    try {
      const { path } = await api.requestPresence(id);
      setPresenceUrl(`${window.location.origin}${path}`);
    } catch (e) {
      setError(String(e).includes('409') ? 'Le candidat n’a pas associé d’appareil à la pré-vérification.' : String(e));
    }
  }

  // Analyse chargée dès l'ouverture : mesures et défis prêts quand le partage commence.
  useEffect(() => {
    Promise.allSettled([loadTracker(), loadFaceModels()]).then(() => setReady(true));
  }, []);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const [session, setSession] = useState<SessionView | null>(null);
  const onSession = useCallback((s: SessionView) => setSession(s), []);
  useEffect(() => {
    if (!widget || !session) return;
    window.parent.postMessage({ type: 'oval:score', value: session.score.value, level: session.score.level, evidence: session.score.evidence, live: !!stream }, '*');
  }, [widget, session, stream]);

  async function share() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      s.getVideoTracks()[0]?.addEventListener('ended', () => setStream(null));
      setStream(s);
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Partage annulé.' : String(e));
    }
  }

  function stop() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  return (
    <div className={`panel-page${widget ? ' panel-page--widget' : ''}`}>
      <header className="pp-head">
        <span className="pp-logo"><i />oval</span>
        <span className={`pp-state${stream ? ' is-live' : ready ? ' is-ready' : ''}`}>
          <i />{stream ? 'En direct' : ready ? 'Prêt' : 'Chargement de l’analyse…'}
        </span>
      </header>

      {!stream ? (
        <section className="pp-start">
          <button className="pp-share" onClick={share} disabled={!ready}>
            <span className="pp-share-ring" aria-hidden />
            <span className="pp-share-ic" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="13" rx="3" /><path d="M8 21h8M12 17v4M12 7v6M9 10l3-3 3 3" /></svg>
            </span>
            <strong>Partager la fenêtre de la visio</strong>
            <small>Teams, Meet ou Zoom · analysé ici, rien n’est enregistré</small>
          </button>
          <ol className="pp-steps">
            <li><b>1</b>Lancez l’entretien comme d’habitude.</li>
            <li><b>2</b>Affichez le candidat en grand : le plus grand visage à l’écran est analysé.</li>
            <li><b>3</b>Choisissez la fenêtre de la visio.</li>
          </ol>
          {error && <p className="faceid-error">{error}</p>}
        </section>
      ) : (
        <p className="pp-sharing">
          Fenêtre partagée avec ce panneau seulement.
          <button className="link" onClick={stop}>Arrêter</button>
        </p>
      )}

      <RecruiterPanel
        sessionId={id}
        stream={stream}
        apiBase={API_BASE}
        recruiterKey={recruiterKey}
        liveSampler={sampleLive}
        detector={detector}
        onSession={onSession}
        reportUrl={`/report/${id}${recruiterKey ? `?key=${recruiterKey}` : ''}`}
      />

      <details className="pp-more">
        <summary>Confirmation d’appareil (clé d’accès)</summary>
        <p className="presence-link">
          <button className="link" onClick={requestPresence}>Générer le lien à coller dans la discussion</button>
          {presenceUrl && <code>{presenceUrl}</code>}
        </p>
        {stream && error && <p className="faceid-error">{error}</p>}
      </details>
    </div>
  );
}
