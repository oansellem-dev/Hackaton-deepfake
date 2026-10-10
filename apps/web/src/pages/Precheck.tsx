import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { SUPPORTED_COUNTRIES, type CandidateLinkInfo, type FaceIdStep, type IdentityPayload } from '@kyc/shared';
import { FaceId, type FaceIdOutcome } from '../components/FaceId.tsx';
import { api } from '../config.ts';

type Step = 'loading' | 'identity' | 'consent' | 'face' | 'device' | 'done' | 'expired';

const STEPS: { id: Step; label: string }[] = [
  { id: 'identity', label: '1. Vos informations' },
  { id: 'consent', label: '2. Vérification du visage' },
];

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

type Form = Omit<IdentityPayload, 'consent'>;

const EMPTY: Form = {
  firstName: '', lastName: '', email: '', phone: '', country: 'FR', city: '', jobTitle: '', company: '', githubUrl: '',
  linkedinUrl: '',
};

// Lien de pré-vérification envoyé au candidat (/check/<jeton>, à usage unique, valable peu de temps).
// Page 1 : identité et informations écrites. Page 2 : consentement biométrique explicite, puis vérification du visage,
// ou vérification sans biométrie. Le candidat peut ensuite associer son appareil et retirer son consentement.
export function Precheck() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<CandidateLinkInfo | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [form, setForm] = useState<Form>(EMPTY);
  const [infoConsent, setInfoConsent] = useState(false);
  const [bioConsent, setBioConsent] = useState(false);
  const [outcome, setOutcome] = useState<FaceIdOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);

  async function refresh() {
    try {
      const i = await api.getLink(token);
      setInfo(i);
      setWithdrawn(i.withdrawn);
      return i;
    } catch {
      setStep('expired');
      return null;
    }
  }

  useEffect(() => {
    refresh().then((i) => {
      if (!i) return;
      if (i.status === 'open') setStep(i.identityDone ? 'consent' : 'identity');
      else if (i.faceDone || i.optedOut || i.status === 'used') setStep('done');
      else setStep('expired');
    });
  }, [token]);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submitIdentity(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    try {
      await api.sendIdentity(token, { ...form, consent: infoConsent });
      setStep('consent');
    } catch (err) {
      setError(String(err).includes('410') ? 'Ce lien a expiré ou a déjà été utilisé.' : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function optOut() {
    setRunning(true);
    try {
      await api.optOut(token);
      await refresh();
      setStep('done');
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  }

  async function bindDevice() {
    setRunning(true);
    setError(null);
    try {
      const optionsJSON = await api.deviceOptions(token);
      const response = await startRegistration({ optionsJSON: optionsJSON as never });
      await api.registerDevice(token, response);
      await refresh();
      setStep('done');
    } catch (err) {
      setError(
        `L’appareil n’a pas pu être associé (${err instanceof Error ? err.message : String(err)}). Vous pouvez passer cette étape.`,
      );
    } finally {
      setRunning(false);
    }
  }

  async function withdraw() {
    setRunning(true);
    try {
      await api.withdraw(token);
      setWithdrawn(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  }

  const controller = info?.controller;
  const retentionHours = info?.biometricRetentionHours ?? 24;
  const activeIndex = step === 'identity' ? 0 : 1;

  if (step === 'loading') return <div className="page">Chargement…</div>;
  if (step === 'expired') {
    return (
      <div className="page">
        <h1>Lien expiré</h1>
        <p>Ce lien de pré-vérification n’est plus valable. Demandez un nouveau lien au recruteur.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Pré-vérification de votre entretien</h1>
      {step !== 'done' && (
        <ol className="stepper">
          {STEPS.map((s, i) => (
            <li key={s.id} className={i < activeIndex ? 'finished' : i === activeIndex ? 'active' : ''}>
              {s.label}
            </li>
          ))}
        </ol>
      )}

      {step === 'identity' && (
        <form className="card" onSubmit={submitIdentity}>
          <p>
            {controller ? `${controller.name} vous` : 'Le recruteur vous'} propose cette vérification avant votre entretien
            en visio, pour s’assurer que la personne présente sera bien vous. Cela prend environ deux minutes.
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
            <strong>Ce que nous vérifions à cette étape</strong>
            <ul>
              <li>votre nom dans des sources publiques (Wikipédia, GitHub, ORCID, moteur de recherche) ;</li>
              <li>la cohérence de ce que vous déclarez (pays, téléphone, e-mail, profils).</li>
            </ul>
            <p className="muted">
              Les champs facultatifs vides ne vous pénalisent pas, et ne rien trouver sur vous en ligne non plus.
            </p>
          </div>

          <label className="consent">
            <input type="checkbox" checked={infoConsent} onChange={(e) => setInfoConsent(e.target.checked)} />
            <span>
              J’accepte que les informations ci-dessus soient vérifiées dans des sources publiques et transmises au
              recruteur.{' '}
              <Link to={`/confidentialite/${token}`} target="_blank">
                Mentions d’information
              </Link>
            </span>
          </label>
          <button
            className="primary"
            type="submit"
            disabled={running || !infoConsent || !form.firstName.trim() || !form.lastName.trim()}
          >
            {running ? 'Vérification…' : 'Continuer'}
          </button>
          {error && <p className="faceid-error">{error}</p>}
        </form>
      )}

      {step === 'consent' && (
        <div className="card">
          <h2>Vérification du visage : votre accord</h2>
          <table className="facts">
            <tbody>
              <tr>
                <th>Responsable du traitement</th>
                <td>
                  {controller
                    ? `${controller.name}${controller.contact ? ` (${controller.contact})` : ''}`
                    : 'L’entreprise qui vous a envoyé ce lien'}
                </td>
              </tr>
              <tr>
                <th>Pourquoi</th>
                <td>
                  Vérifier que la personne présente à l’entretien est bien celle qui fait cette vérification (comparaison
                  avec vous-même uniquement), et détecter une vidéo truquée. Jamais d’identification dans une base de
                  visages, jamais d’analyse de vos émotions.
                </td>
              </tr>
              <tr>
                <th>Ce qui est traité</th>
                <td>
                  Votre visage, analysé uniquement dans votre navigateur : aucune image n’est envoyée ni enregistrée.
                  Seule une empreinte numérique (des mesures) est conservée, chiffrée.
                </td>
              </tr>
              <tr>
                <th>Combien de temps</th>
                <td>Jusqu’à la décision du recruteur, et au plus {retentionHours} heures.</td>
              </tr>
              <tr>
                <th>Vos droits</th>
                <td>
                  Vous pouvez retirer votre accord à tout moment depuis cette page, ou en écrivant
                  {controller?.contact ? ` à ${controller.contact}` : ' au recruteur'} : l’empreinte est alors supprimée.
                  Accès, effacement, réclamation auprès de la CNIL :{' '}
                  <Link to={`/confidentialite/${token}`} target="_blank">
                    mentions d’information
                  </Link>
                  .
                </td>
              </tr>
              <tr>
                <th>Si vous refusez</th>
                <td>Aucune pénalité : le recruteur vérifiera lui-même pendant l’entretien, sans biométrie.</td>
              </tr>
            </tbody>
          </table>
          <label className="consent">
            <input type="checkbox" checked={bioConsent} onChange={(e) => setBioConsent(e.target.checked)} />
            <span>
              J’accepte le traitement de mon visage décrit ci-dessus (donnée biométrique, article 9 du RGPD), pour cet
              entretien uniquement.
            </span>
          </label>
          <div className="row-buttons">
            <button className="primary" disabled={!bioConsent} onClick={() => setStep('face')}>
              Continuer vers la caméra
            </button>
            <button className="secondary" disabled={running} onClick={optOut}>
              Je préfère une vérification sans biométrie
            </button>
          </div>
          {error && <p className="faceid-error">{error}</p>}
        </div>
      )}

      {step === 'face' && (
        <FaceId
          token={token}
          declaredCountry={form.country ?? 'FR'}
          onDone={(o) => {
            setOutcome(o);
            // Association de l'appareil proposée seulement si le navigateur sait créer une clé d'accès.
            setStep(window.PublicKeyCredential ? 'device' : 'done');
          }}
        />
      )}

      {step === 'device' && (
        <div className="card">
          <h2>Dernière étape, facultative : associer cet appareil</h2>
          <p>
            Pendant l’entretien, le recruteur pourra vous demander de confirmer en un clic que vous utilisez le même
            appareil. Votre appareil vous demandera peut-être votre code, votre empreinte digitale ou votre visage : ils
            restent dans l’appareil, rien n’est envoyé.
          </p>
          <div className="row-buttons">
            <button className="primary" disabled={running} onClick={bindDevice}>
              Associer cet appareil
            </button>
            <button className="secondary" disabled={running} onClick={() => setStep('done')}>
              Passer
            </button>
          </div>
          {error && <p className="faceid-error">{error}</p>}
        </div>
      )}

      {step === 'done' && (
        <div className="card">
          <h2>Merci, c’est terminé</h2>
          {outcome && (
            <>
              <p>Ce que nous avons vérifié :</p>
              <ul className="status-list">
                {outcome.environment.map((r) => (
                  <li key={r.label} className={`status-${r.status === 'contradiction' ? 'unknown' : r.status}`}>
                    <strong>{r.label}</strong>
                  </li>
                ))}
                {outcome.steps.map((s, i) => (
                  <li key={i} className={s.result === 'passed' ? 'status-ok' : 'status-unknown'}>
                    <strong>{STEP_NAME[s.step]}</strong> — {s.result === 'passed' ? 'réalisé' : 'non concluant'}
                  </li>
                ))}
              </ul>
            </>
          )}
          {info?.optedOut && (
            <p>Vous avez choisi la vérification sans biométrie : le recruteur vérifiera pendant l’entretien.</p>
          )}
          {withdrawn ? (
            <p>
              <strong>Votre accord est retiré : l’empreinte de votre visage est supprimée.</strong>
            </p>
          ) : (
            !info?.optedOut && (
              <>
                <p className="muted">
                  Une empreinte numérique de votre visage (des mesures, aucune image) est conservée, chiffrée, jusqu’à la
                  décision du recruteur et au plus {retentionHours} heures. Le recruteur décide : cette vérification ne
                  remplace pas son jugement.
                </p>
                <button className="secondary" disabled={running} onClick={withdraw}>
                  Retirer mon accord et supprimer mon empreinte
                </button>
              </>
            )
          )}
          <p className="muted">
            <Link to={`/confidentialite/${token}`}>Mentions d’information</Link> · Vous pouvez fermer cette page.
          </p>
          {error && <p className="faceid-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
