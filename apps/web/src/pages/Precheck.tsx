import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SUPPORTED_COUNTRIES, type FaceIdStep, type IdentityPayload } from '@kyc/shared';
import { FaceId, type FaceIdOutcome } from '../components/FaceId.tsx';
import { ScreenFlash, type ScreenFlashOutcome } from '../components/ScreenFlash.tsx';
import { api } from '../config.ts';

type Step = 'identity' | 'face' | 'flash' | 'done';

const STEPS: { id: Exclude<Step, 'done'>; label: string }[] = [
  { id: 'identity', label: '1. Vos informations' },
  { id: 'face', label: '2. Vérification du visage' },
  { id: 'flash', label: '3. Reflet de l’écran' },
];

const FLASH_TEXT: Record<ScreenFlashOutcome['result'], string> = {
  passed: 'réalisé',
  failed: 'non concluant',
  inconclusive: 'non concluant',
  skipped: 'passé',
};

const STEP_NAME: Record<FaceIdStep, string> = {
  center: 'Visage de face',
  turn_a: 'Tête tournée à droite',
  turn_b: 'Tête tournée à gauche',
  hand: 'Main devant le visage',
};

const COUNTRY_NAMES: Record<string, string> = {
  FR: 'France', BE: 'Belgique', CH: 'Suisse', LU: 'Luxembourg', DE: 'Allemagne', ES: 'Espagne', IT: 'Italie',
  PT: 'Portugal', GB: 'Royaume-Uni', NL: 'Pays-Bas', PL: 'Pologne', RO: 'Roumanie', MA: 'Maroc', TN: 'Tunisie',
  DZ: 'Algérie', SN: 'Sénégal', CA: 'Canada',
};

const CONSENT =
  'J’accepte que les informations ci-dessus soient vérifiées dans des sources publiques, que mon visage soit analysé ' +
  'pendant cette vérification, et qu’une empreinte numérique de mon visage (des mesures, aucune image) soit conservée, chiffrée, ' +
  'jusqu’à la fin de l’entretien (24 h au maximum), uniquement pour vérifier que la personne présente à l’entretien ' +
  'est bien celle-ci. Le recruteur voit seulement des signaux à vérifier et reste seul décisionnaire.';

// Garde l'étape en cours si le candidat recharge la page (rien de sensible : juste l'étape et le pays).
function loadProgress(id: string): { step: Step; country: string } | null {
  try {
    const raw = sessionStorage.getItem(`kyc-precheck-${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveProgress(id: string, step: Step, country: string) {
  try {
    sessionStorage.setItem(`kyc-precheck-${id}`, JSON.stringify({ step, country }));
  } catch {
    /* stockage indisponible : on recommencera à l'étape 1 */
  }
}

type Form = Omit<IdentityPayload, 'consent'>;

const EMPTY: Form = {
  firstName: '', lastName: '', email: '', phone: '', country: 'FR', city: '', jobTitle: '', company: '', githubUrl: '',
  linkedinUrl: '',
};

// Lien de pré-vérification envoyé au candidat. Page 1 : identité et informations écrites (avec consentement).
// Page 2 : vérification du visage (« Face ID ») et de l'environnement. Le candidat voit ce qui est vérifié avant (règle n°5).
export function Precheck() {
  const { id = '' } = useParams();
  const saved = loadProgress(id);
  const [step, setStep] = useState<Step>(saved?.step ?? 'identity');
  const [form, setForm] = useState<Form>({ ...EMPTY, country: saved?.country ?? 'FR' });
  const [consent, setConsent] = useState(false);
  const [outcome, setOutcome] = useState<FaceIdOutcome | null>(null);
  const [flash, setFlash] = useState<ScreenFlashOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submitIdentity(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    try {
      await api.sendIdentity(id, { ...form, consent });
      saveProgress(id, 'face', form.country ?? 'FR');
      setStep('face');
    } catch (err) {
      setError(String(err).includes('déjà terminée') ? 'Votre pré-vérification est déjà enregistrée.' : String(err));
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
        <form className="card" onSubmit={submitIdentity}>
          <p>
            Avant votre entretien en visio, nous vérifions que la personne présente sera bien vous. Cela prend environ
            deux minutes.
          </p>
          <div className="form-grid">
            <label>
              Prénom *
              <input value={form.firstName} onChange={set('firstName')} autoComplete="given-name" required />
            </label>
            <label>
              Nom *
              <input value={form.lastName} onChange={set('lastName')} autoComplete="family-name" required />
            </label>
            <label>
              E-mail
              <input type="email" value={form.email} onChange={set('email')} autoComplete="email" />
            </label>
            <label>
              Téléphone
              <input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="+33 6 12 34 56 78" />
            </label>
            <label>
              Pays depuis lequel vous passerez l’entretien
              <select value={form.country} onChange={set('country')}>
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {COUNTRY_NAMES[c] ?? c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ville
              <input value={form.city} onChange={set('city')} autoComplete="address-level2" />
            </label>
            <label>
              Poste actuel ou dernier poste
              <input value={form.jobTitle} onChange={set('jobTitle')} autoComplete="organization-title" />
            </label>
            <label>
              Entreprise
              <input value={form.company} onChange={set('company')} autoComplete="organization" />
            </label>
            <label>
              Profil GitHub (facultatif)
              <input value={form.githubUrl} onChange={set('githubUrl')} placeholder="https://github.com/…" />
            </label>
            <label>
              Profil LinkedIn (facultatif)
              <input value={form.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://www.linkedin.com/in/…" />
            </label>
          </div>

          <div className="what-we-check">
            <strong>Ce que nous vérifions</strong>
            <ul>
              <li>votre nom dans des sources publiques (Wikipédia, GitHub, ORCID, moteur de recherche) ;</li>
              <li>la cohérence de ce que vous déclarez (pays, téléphone, e-mail, profils) ;</li>
              <li>à l’étape suivante : votre caméra, votre fuseau horaire, votre adresse IP et votre visage ;</li>
              <li>
                enfin, le reflet des couleurs de votre écran sur votre visage (analysé dans votre navigateur, test
                facultatif).
              </li>
            </ul>
            <p className="muted">
              Les champs facultatifs vides ne vous pénalisent pas, et ne rien trouver sur vous en ligne non plus.
            </p>
          </div>

          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{CONSENT}</span>
          </label>
          <button
            className="primary"
            type="submit"
            disabled={running || !consent || !form.firstName.trim() || !form.lastName.trim()}
          >
            {running ? 'Vérification…' : 'Continuer'}
          </button>
          {error && <p className="faceid-error">{error}</p>}
        </form>
      )}

      {step === 'face' && (
        <FaceId
          sessionId={id}
          declaredCountry={form.country ?? 'FR'}
          onDone={(o) => {
            setOutcome(o);
            saveProgress(id, 'flash', form.country ?? 'FR');
            setStep('flash');
          }}
        />
      )}

      {step === 'flash' && (
        <ScreenFlash
          sessionId={id}
          deviceId={outcome?.deviceId}
          onDone={(f) => {
            setFlash(f);
            saveProgress(id, 'done', form.country ?? 'FR');
            setStep('done');
          }}
        />
      )}

      {step === 'done' && (
        <div className="card">
          <h2>Merci, c’est terminé</h2>
          {(outcome || flash) && <p>Ce que nous avons vérifié :</p>}
          <ul className="status-list">
            {outcome?.environment.map((r) => (
              <li key={r.label} className={`status-${r.status === 'contradiction' ? 'unknown' : r.status}`}>
                <strong>{r.label}</strong>
              </li>
            ))}
            {outcome?.steps.map((s, i) => (
              <li key={i} className={s.result === 'passed' ? 'status-ok' : 'status-unknown'}>
                <strong>{STEP_NAME[s.step]}</strong> — {s.result === 'passed' ? 'réalisé' : 'non concluant'}
              </li>
            ))}
            {flash && (
              <li className={flash.result === 'passed' ? 'status-ok' : 'status-unknown'}>
                <strong>Reflet de l’écran</strong> — {FLASH_TEXT[flash.result]}
              </li>
            )}
          </ul>
          <p className="muted">
            {!outcome
              ? 'Votre pré-vérification est enregistrée.'
              : outcome.profileStored
                ? 'Une empreinte numérique de votre visage (des mesures, aucune image) est conservée, chiffrée, jusqu’à la fin de l’entretien.'
                : 'Aucune donnée de visage n’a été conservée.'}{' '}
            Le recruteur décide : cette vérification ne remplace pas son jugement. Vous pouvez fermer cette page.
          </p>
        </div>
      )}
    </div>
  );
}
