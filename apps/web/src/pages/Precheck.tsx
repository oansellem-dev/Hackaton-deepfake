import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SUPPORTED_COUNTRIES, type SignalStatus } from '@kyc/shared';
import { api } from '../config.ts';

type Result = { label: string; status: SignalStatus; detail: string };

// Brique A : page envoyée au candidat avant l'entretien.
// Le candidat voit ce qui est vérifié avant de lancer quoi que ce soit (règle n°5).
export function Precheck() {
  const { id = '' } = useParams();
  const [country, setCountry] = useState('FR');
  const [results, setResults] = useState<Result[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await api.sendPrecheck(id, {
        cameras: await listCameraLabels(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        languages: [...navigator.languages],
        declaredCountry: country,
      });
      setResults(res.signals);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page">
      <h1>Pré-vérification de votre entretien</h1>

      <div className="card">
        <p>Avant votre entretien en visio, cette page vérifie quelques éléments techniques :</p>
        <ul>
          <li>le nom des caméras vues par votre navigateur ;</li>
          <li>votre fuseau horaire, comparé au pays que vous indiquez ;</li>
          <li>votre adresse IP.</li>
        </ul>
        <p className="muted">
          Aucune image ni vidéo n'est enregistrée. Aucune comparaison de visage n'est faite. Un élément non vérifiable
          ne vous pénalise pas. Le recruteur reste seul décisionnaire.
        </p>
        <label>
          Pays depuis lequel vous passerez l'entretien
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={run} disabled={running}>
          {running ? 'Vérification…' : 'Lancer la vérification'}
        </button>
        {error && <p className="muted">Erreur : {error}</p>}
      </div>

      {results && (
        <div className="card">
          <h2>Ce que nous avons vérifié</h2>
          <ul className="status-list">
            {results.map((r) => (
              <li key={r.label} className={`status-${r.status}`}>
                <strong>{r.label}</strong> — {r.detail}
              </li>
            ))}
          </ul>
          <p className="muted">C'est terminé, vous pouvez fermer cette page.</p>
        </div>
      )}
    </div>
  );
}

// Les noms des caméras ne sont visibles qu'après une autorisation : on ouvre la caméra
// un instant pour les lire, puis on la coupe aussitôt, sans capturer d'image.
async function listCameraLabels(): Promise<string[]> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput').map((d) => d.label);
}
