import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createApi, RecruiterPanel } from '@kyc/panel';
import { captureVisioTab } from './capture.ts';
import './sidepanel.css';

const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const WEB_BASE: string = import.meta.env.VITE_WEB_URL ?? 'http://localhost:5173';
const api = createApi(API_BASE);

function App() {
  const [sessionId, setSessionId] = useState('');
  const [draft, setDraft] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get('sessionId').then(({ sessionId }) => sessionId && setSessionId(sessionId));
  }, []);

  function selectSession(id: string) {
    setSessionId(id);
    chrome.storage.local.set({ sessionId: id });
  }

  async function createSession() {
    try {
      selectSession((await api.createSession('Candidat')).id);
    } catch (e) {
      setError(String(e));
    }
  }

  async function startCapture() {
    try {
      const s = await captureVisioTab();
      s.getVideoTracks()[0]?.addEventListener('ended', () => setStream(null));
      setStream(s);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  function stopCapture() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  if (!sessionId) {
    return (
      <div className="setup">
        <h1>KYC Visio</h1>
        <button onClick={createSession}>Nouvel entretien</button>
        <p>ou reprendre un entretien existant :</p>
        <input placeholder="Identifiant d'entretien" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button disabled={!draft} onClick={() => selectSession(draft.trim())}>
          Reprendre
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="setup">
      <div className="session-bar">
        <span>
          Entretien <code>{sessionId}</code>
        </span>
        <button
          className="link"
          onClick={() => {
            stopCapture();
            setSessionId('');
            chrome.storage.local.remove('sessionId');
          }}
        >
          Changer
        </button>
      </div>
      <p className="hint">
        Lien candidat : <code>{`${WEB_BASE}/check/${sessionId}`}</code>
      </p>
      {stream ? (
        <button className="secondary" onClick={stopCapture}>
          Arrêter la capture
        </button>
      ) : (
        <button onClick={startCapture}>Capturer l'onglet de visio</button>
      )}
      {error && <p className="error">{error}</p>}
      <RecruiterPanel
        sessionId={sessionId}
        stream={stream}
        apiBase={API_BASE}
        reportUrl={`${WEB_BASE}/report/${sessionId}`}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
