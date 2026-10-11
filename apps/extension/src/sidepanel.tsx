import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createApi } from '@kyc/panel';
import './sidepanel.css';

/**
 * Panneau latéral Chrome d'Oval. Le panneau recruteur lui-même est la page /panel/<id> du site du moteur, affichée
 * ici dans un cadre : c'est là que tournent MediaPipe et les modèles ONNX (même origine que les modèles), donc la
 * même détection que dans la visio. Aucune image ne quitte le navigateur.
 */
const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const WEB_BASE: string = import.meta.env.VITE_WEB_URL ?? 'http://localhost:5173';
const OVAL_BASE: string = import.meta.env.VITE_OVAL_URL ?? 'http://localhost:5174';
const api = createApi(API_BASE);

function App() {
  const [sessionId, setSessionId] = useState('');
  const [recruiterKey, setRecruiterKey] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get(['sessionId', 'recruiterKey']).then(({ sessionId, recruiterKey }) => {
      if (sessionId) setSessionId(sessionId);
      if (recruiterKey) setRecruiterKey(recruiterKey);
    });
  }, []);

  // Code recruteur donné à la création de l'entretien : « identifiant:clé » (dans Oval : rapport → « Code extension »).
  function selectSession(code: string) {
    const [id, key] = code.trim().split(':');
    if (!id) return;
    setSessionId(id);
    setRecruiterKey(key);
    chrome.storage.local.set({ sessionId: id, recruiterKey: key });
  }

  async function createSession() {
    setError(null);
    try {
      const created = await api.createSession('Candidat');
      selectSession(`${created.id}:${created.recruiterKey}`);
    } catch (e) {
      setError(`Serveur injoignable (${API_BASE}). Lancez npm run dev.`);
    }
  }

  function reset() {
    setSessionId('');
    setRecruiterKey(undefined);
    chrome.storage.local.remove(['sessionId', 'recruiterKey']);
  }

  const panelUrl = `${WEB_BASE}/panel/${sessionId}${recruiterKey ? `?key=${recruiterKey}` : ''}`;
  // Fenêtre flottante (façon Loom) : le panneau à côté de la visio, hors du navigateur.
  const detach = () => chrome.windows.create({ url: panelUrl, type: 'popup', width: 420, height: 760 });

  if (!sessionId) {
    return (
      <div className="ext">
        <header className="ext-head"><span className="ext-logo"><i />oval</span></header>
        <section className="ext-card ext-pop">
          <h1>Quel entretien ?</h1>
          <p>Collez le code de l’extension donné par Oval (rapport de l’entretien → « Code extension »).</p>
          <form onSubmit={(e) => { e.preventDefault(); selectSession(draft); }}>
            <input placeholder="identifiant:clé" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <button className="ext-primary" disabled={!draft.includes(':')}>Ouvrir le panneau</button>
          </form>
          <div className="ext-or"><span>ou</span></div>
          <button className="ext-secondary" onClick={createSession}>Créer un entretien rapide</button>
          <a className="ext-link" href={`${OVAL_BASE}/#/entretiens/nouveau`} target="_blank" rel="noreferrer">Créer un entretien complet dans Oval ↗</a>
          {error && <p className="ext-error">{error}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="ext ext--panel">
      <header className="ext-head">
        <span className="ext-logo"><i />oval</span>
        <span className="ext-session"><code>{sessionId}</code></span>
        <button className="ext-ghost" title="Ouvrir dans une fenêtre flottante" onClick={detach}>⧉</button>
        <button className="ext-ghost" onClick={reset}>Changer</button>
      </header>
      <iframe className="ext-frame" src={panelUrl} title="Panneau recruteur Oval" allow="display-capture; camera; microphone" />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
