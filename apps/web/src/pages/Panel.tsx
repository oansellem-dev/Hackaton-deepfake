import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { RecruiterPanel, createApi } from '@kyc/panel';
import { API_BASE, recruiterKeyFor } from '../config.ts';
import { loadFaceModels } from '../lib/faceModels.ts';
import { createLiveDetector } from '../lib/liveDetector.ts';
import { loadTracker, sampleLive } from '../lib/tracker.ts';

// Panneau recruteur pour une visio Teams, Meet ou Zoom : le recruteur garde son outil de visio et partage ici la
// fenêtre de l'appel. Tout est analysé dans ce navigateur (plus grand visage affiché = le candidat) ; rien n'est
// enregistré ni envoyé, seulement des mesures.
export function Panel() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const recruiterKey = recruiterKeyFor(id, params.get('key'));
  const detector = useMemo(() => createLiveDetector(id, recruiterKey), [id, recruiterKey]);
  const api = useMemo(() => createApi(API_BASE, recruiterKey), [recruiterKey]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presenceUrl, setPresenceUrl] = useState<string | null>(null);

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
    loadTracker().catch(() => undefined);
    loadFaceModels().catch(() => undefined);
  }, []);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

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
    <div className="panel-page">
      <header className="panel-header">
        <h1>Vérification pendant la visio</h1>
        {!stream ? (
          <>
            <ol>
              <li>Lancez l’entretien dans Teams, Meet ou Zoom, comme d’habitude.</li>
              <li>
                Affichez le candidat en grand (épinglez sa vidéo) : c’est le plus grand visage à l’écran qui est analysé.
              </li>
              <li>Cliquez ci-dessous et choisissez la fenêtre de la visio.</li>
            </ol>
            <button className="primary" onClick={share}>
              Partager la fenêtre de la visio
            </button>
            {error && <p className="faceid-error">{error}</p>}
          </>
        ) : (
          <p className="muted">
            Fenêtre partagée avec ce panneau seulement : analysée dans ce navigateur, rien n’est enregistré ni envoyé.{' '}
            <button className="link" onClick={stop}>
              Arrêter le partage
            </button>
          </p>
        )}
        <p className="presence-link">
          <button className="link" onClick={requestPresence}>
            Demander la confirmation d’appareil
          </button>
          {presenceUrl && (
            <span>
              À coller dans la discussion de la visio : <code>{presenceUrl}</code>
            </span>
          )}
        </p>
        {stream && error && <p className="faceid-error">{error}</p>}
      </header>
      <RecruiterPanel
        sessionId={id}
        stream={stream}
        apiBase={API_BASE}
        recruiterKey={recruiterKey}
        liveSampler={sampleLive}
        detector={detector}
        reportUrl={`/report/${id}${recruiterKey ? `?key=${recruiterKey}` : ''}`}
      />
    </div>
  );
}
