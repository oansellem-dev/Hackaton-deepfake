import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SUPPORTED_COUNTRIES, type FaceIdStep, type SignalStatus } from '@kyc/shared';
import { FaceId } from '../components/FaceId.tsx';
import { api } from '../config.ts';

type Result = { label: string; status: SignalStatus; detail: string };
type Step = 'identity' | 'env' | 'face' | 'done';

const STEPS: { id: Step; label: string }[] = [
  { id: 'identity', label: '1. Identité' },
  { id: 'env', label: '2. Environnement' },
  { id: 'face', label: '3. Visage' },
];

const STEP_NAME: Record<FaceIdStep, string> = {
  center: 'Visage de face',
  turn_a: 'Tête tournée',
  turn_b: 'Tête tournée',
  hand: 'Main devant le visage',
};

const CONSENT =
  "J’accepte que mon nom soit recherché dans des sources publiques, que ma caméra analyse mon visage dans mon navigateur " +
  'et que des proportions de mon visage (aucune image) soient conservées, chiffrées, jusqu’à la fin de l’entretien ' +
  '(24 h au maximum), uniquement pour vérifier que la personne présente à l’entretien est bien celle-ci. ' +
  'Le recruteur voit seulement des signaux à vérifier et reste seul décisionnaire.';

// Lien de pré-vérification envoyé au candidat : identité déclarée, environnement, puis parcours « Face ID ».
// Le candidat voit toujours ce qui est vérifié avant de le lancer (règle n°5).
export function Precheck() {
  const { id = '' } = useParams();
  const [step, setStep] = useState<Step>('identity');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [consent, setConsent] = useState(false);
  const [country, setCountry] = useState('FR');
  const [results, setResults] = useState<Result[] | null>(null);
  const [faceSummary, setFaceSummary] = useState<{ step: FaceIdStep; result: string }[] | null>(null);
  const [profileStored, setProfileStored] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitIdentity() {
    setRunning(true);
    setError(null);
    try {
      await api.sendIdentity(id, { firstName, lastName, consent });
      setStep('env');
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  async function runEnvironment() {
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

  const activeIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="page">
      <h1>Pré-vérification de votre entretien</h1>
      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s.id} className={step === 'done' || i < activeIndex ? 'finished' : i === activeIndex ? 'active' : ''}>
            {s.label}
          </li>
        ))}
      </ol>

      {step === 'identity' && (
        <div className="card">
          <p>Indiquez votre identité telle qu’elle figure sur votre candidature.</p>
          <label>
            Prénom
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </label>
          <label>
            Nom
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </label>
          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{CONSENT}</span>
          </label>
          <p className="muted">
            Ne trouver aucune information publique sur vous n’est pas un problème et ne vous pénalise pas.
          </p>
          <button className="primary" onClick={submitIdentity} disabled={running || !consent || !firstName.trim() || !lastName.trim()}>
            {running ? 'Enregistrement…' : 'Continuer'}
          </button>
          {error && <p className="muted">Erreur : {error}</p>}
        </div>
      )}

      {step === 'env' && (
        <div className="card">
          <p>Cette étape vérifie quelques éléments techniques :</p>
          <ul>
            <li>le nom des caméras vues par votre navigateur ;</li>
            <li>votre fuseau horaire, comparé au pays que vous indiquez ;</li>
            <li>votre adresse IP.</li>
          </ul>
          <label>
            Pays depuis lequel vous passerez l’entretien
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {SUPPORTED_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {!results && (
            <button className="primary" onClick={runEnvironment} disabled={running}>
              {running ? 'Vérification…' : 'Lancer la vérification'}
            </button>
          )}
          {error && <p className="muted">Erreur : {error}</p>}
          {results && (
            <>
              <ul className="status-list">
                {results.map((r) => (
                  <li key={r.label} className={`status-${r.status}`}>
                    <strong>{r.label}</strong> — {r.detail}
                  </li>
                ))}
              </ul>
              <button className="primary" onClick={() => setStep('face')}>
                Continuer vers la vérification du visage
              </button>
            </>
          )}
        </div>
      )}

      {step === 'face' && (
        <FaceId
          sessionId={id}
          onDone={(steps, stored) => {
            setFaceSummary(steps);
            setProfileStored(stored);
            setStep('done');
          }}
        />
      )}

      {step === 'done' && (
        <div className="card">
          <h2>Merci, c’est terminé</h2>
          <ul className="status-list">
            {faceSummary?.map((s, i) => (
              <li key={i} className={s.result === 'passed' ? 'status-ok' : 'status-unknown'}>
                <strong>{STEP_NAME[s.step]}</strong> — {s.result === 'passed' ? 'réalisé' : 'non concluant, sans effet sur votre dossier'}
              </li>
            ))}
          </ul>
          <p className="muted">
            {profileStored
              ? 'Des proportions de votre visage (aucune image) sont conservées, chiffrées, jusqu’à la fin de l’entretien.'
              : 'Aucune donnée de visage n’a été conservée.'}{' '}
            Le recruteur décide : cette vérification ne remplace pas son jugement. Vous pouvez fermer cette page.
          </p>
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
