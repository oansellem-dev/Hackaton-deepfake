import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { createApi } from '@kyc/panel';
import { combineFlashAttempts, getChallenge, type FlashSummary, type SessionView, type Signal } from '@kyc/shared';
import { API_BASE, recruiterKeyFor } from '../config.ts';

const DECISION_LABEL = {
  continue: 'Poursuivre',
  extra_check: 'Vérification complémentaire',
  stop: "Fin de l'entretien",
} as const;

const RESULT_LABEL = { passed: 'réussi', failed: 'non exécuté ou image déformée', inconclusive: 'non concluant' } as const;

const PRECHECK_SOURCES: Signal['source'][] = ['identity', 'precheck', 'face'];

const FLASH_RESULT = { passed: 'réussi', failed: 'aucune réaction de l’image', inconclusive: 'non concluant' } as const;

function flashStatus(f?: FlashSummary): string {
  if (!f) return 'pas encore fait';
  const n = `${f.attempts.length} essai${f.attempts.length > 1 ? 's' : ''}`;
  if (f.skipped) return 'passé par le candidat';
  if (!f.final) return `interrompu après ${n}`;
  return `${FLASH_RESULT[combineFlashAttempts(f.attempts).result]} (${n})`;
}

// Mesures brutes des défis en direct : sans effet sur le score, elles servent à régler les seuils sur nos tests.
const METRIC_LABEL: Record<string, (v: number) => string> = {
  trackedRatio: (v) => `visage suivi ${Math.round(v * 100)} %`,
  coverFrames: (v) => `${v} image(s) main sur le visage`,
  faceUnderHandRatio: (v) => `visage encore détecté sous la main ${Math.round(v * 100)} %`,
  maxTurnDeg: (v) => `rotation max ${Math.round(v)}°`,
  mouthRange: (v) => `mouvement des lèvres ${v.toFixed(2)}`,
  mouthCycles: (v) => `${v} ouverture(s) de la bouche`,
};

function formatMetrics(metrics?: Record<string, number>): string {
  if (!metrics) return '';
  const parts = Object.entries(metrics).map(([k, v]) => METRIC_LABEL[k]?.(v) ?? `${k} ${v}`);
  return parts.length ? ` · ${parts.join(', ')}` : '';
}

function SignalList({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) return <p className="muted">Aucun signal.</p>;
  return (
    <ul className="status-list">
      {signals.map((s) => (
        <li key={s.id} className={`status-${s.status}`}>
          <strong>{s.label}</strong> — {s.detail}
        </li>
      ))}
    </ul>
  );
}

// Brique E : résultat de la pré-vérification (pour trier avant l'entretien), puis trace de l'entretien.
// Aucune image. La page se met à jour toute seule pendant que le candidat fait sa pré-vérification.
export function Report() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const key = recruiterKeyFor(id, params.get('key'));
  const api = useMemo(() => createApi(API_BASE, key), [key]);
  const [session, setSession] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);

  async function uploadCv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvBusy(true);
    setCvError(null);
    try {
      setSession(await api.uploadCv(id, file));
    } catch (err) {
      const text = String(err);
      setCvError(
        text.includes('422')
          ? 'Ce PDF ne contient pas de texte lisible (CV scanné ?) : comparaison impossible.'
          : text.includes('409')
            ? 'Le candidat n’a pas encore rempli ses informations : le CV sera comparé à ce qu’il déclare.'
            : `Envoi impossible : ${text}`,
      );
    } finally {
      setCvBusy(false);
      e.target.value = '';
    }
  }

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .getSession(id)
        .then((s) => alive && (setSession(s), setError(null)))
        .catch((e) => alive && setError(String(e)));
    load();
    const timer = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [api, id]);

  if (error?.includes('403') && !session) {
    return (
      <div className="page">
        Ce rapport est réservé au recruteur : ouvrez-le avec le lien donné à la création de l’entretien.
      </div>
    );
  }
  if (error && !session) return <div className="page">Erreur : {error}</div>;
  if (!session) return <div className="page">Chargement…</div>;

  const identity = session.identity;
  const precheckSignals = session.signals.filter(
    (s) => PRECHECK_SOURCES.includes(s.source) && s.id !== 'face.continuity',
  );
  const precheckChallenges = session.challenges.filter((c) => c.phase === 'precheck');
  const liveChallenges = session.challenges.filter((c) => c.phase !== 'precheck');
  const cvSignals = session.signals.filter((s) => s.source === 'cv');
  const precheckToCheck = [
    ...precheckSignals.filter((s) => s.status === 'contradiction'),
    ...cvSignals.filter((s) => s.status === 'contradiction'),
    ...session.signals.filter((s) => s.source === 'challenge' && s.status === 'contradiction' && s.label.includes('pré-vérification')),
  ];
  const faceDone = Boolean(session.faceId?.completedAt);
  const passive = session.agent?.passive;

  return (
    <div className="page">
      <h1>Pré-vérification et rapport</h1>
      <p className="muted">
        {session.candidateLabel} · créé le {new Date(session.createdAt).toLocaleString('fr-FR')} · entretien {session.id}
      </p>

      <div className={`card verdict ${!faceDone ? '' : precheckToCheck.length ? 'verdict-warn' : 'verdict-ok'}`}>
        <h2>Pré-vérification</h2>
        {!identity ? (
          <p>En attente : le candidat n’a pas encore ouvert son lien de pré-vérification.</p>
        ) : !faceDone ? (
          <p>En cours : informations reçues, vérification du visage pas encore terminée.</p>
        ) : precheckToCheck.length === 0 ? (
          <p>
            <strong>Aucun signal à vérifier avant l’entretien.</strong> Entretien standard, avec les défis proposés par la
            mascotte.
          </p>
        ) : (
          <p>
            <strong>{precheckToCheck.length} signal(aux) à vérifier avant ou pendant l’entretien.</strong> Rien n’est
            confirmé : abordez-les simplement avec le candidat, et proposez les défis en direct.
          </p>
        )}
        {faceDone && (
          <p className="muted">
            Terminée le {new Date(session.faceId!.completedAt!).toLocaleString('fr-FR')}
            {session.faceId?.hardened ? ' · parcours renforcé (signal déjà présent avant la caméra)' : ''}
            {' · '}
            profil du visage{' '}
            {session.faceProfileSummary
              ? `enregistré (${session.faceProfileSummary.embedding ? 'empreinte, ' : ''}proportions de face${
                  session.faceProfileSummary.angles ? ` et sous ${session.faceProfileSummary.angles} angle(s)` : ''
                }), effacé à votre décision`
              : 'non enregistré ou effacé'}
            {' · '}
            test du reflet de l’écran : {flashStatus(session.screenFlash)}
          </p>
        )}
        <p className="muted">Le score et ces signaux sont une aide. La décision vous appartient.</p>
      </div>

      {identity && (
        <div className="card">
          <h2>Informations déclarées par le candidat</h2>
          <table className="facts">
            <tbody>
              <tr><th>Nom</th><td>{identity.firstName} {identity.lastName}</td></tr>
              {identity.email && <tr><th>E-mail</th><td>{identity.email}</td></tr>}
              {identity.phone && <tr><th>Téléphone</th><td>{identity.phone}</td></tr>}
              {(identity.city || identity.country) && (
                <tr><th>Lieu</th><td>{[identity.city, identity.country].filter(Boolean).join(', ')}</td></tr>
              )}
              {(identity.jobTitle || identity.company) && (
                <tr><th>Poste</th><td>{[identity.jobTitle, identity.company].filter(Boolean).join(' · ')}</td></tr>
              )}
              {identity.githubUrl && <tr><th>GitHub</th><td>{identity.githubUrl}</td></tr>}
              {identity.linkedinUrl && <tr><th>LinkedIn</th><td>{identity.linkedinUrl}</td></tr>}
            </tbody>
          </table>
          <p className="muted">Consentement donné le {new Date(identity.consentAt).toLocaleString('fr-FR')}.</p>
        </div>
      )}

      {identity && (
        <div className="card">
          <h2>Ce que la pré-vérification a relevé</h2>
          <SignalList signals={precheckSignals} />
          {precheckChallenges.length > 0 && (
            <>
              <h3>Vérification du visage</h3>
              <ul className="status-list">
                {precheckChallenges.map((c) => (
                  <li key={c.at} className={c.result === 'passed' ? 'status-ok' : c.result === 'failed' ? 'status-contradiction' : 'status-unknown'}>
                    {getChallenge(c.challengeId)?.label ?? c.challengeId} : {RESULT_LABEL[c.result]} ({(c.durationMs / 1000).toFixed(1)} s)
                  </li>
                ))}
              </ul>
            </>
          )}
          {passive && passive.frames > 0 && (
            <p className="muted">
              Détecteur passif local : {passive.frames} image(s) analysée(s), probabilité médiane de trucage{' '}
              {passive.medianFakeProbability !== null ? `${Math.round(passive.medianFakeProbability * 100)} %` : 'inconnue'}.
              Indicatif seulement (le modèle se trompe environ une fois sur cinq).
            </p>
          )}
        </div>
      )}

      <div className="card">
        <h2>CV du candidat</h2>
        {!identity ? (
          <p className="muted">
            Disponible quand le candidat aura rempli ses informations : le CV est comparé à ce qu’il déclare.
          </p>
        ) : (
          <>
            <p className="muted">
              Chargez le CV reçu (PDF). Il est lu en mémoire puis oublié : seuls les écarts et les liens de vérification
              sont gardés.
            </p>
            <label className="cv-upload">
              {session.cv ? 'Charger un autre CV (PDF)' : 'Choisir le CV (PDF)'}
              <input type="file" accept="application/pdf" onChange={uploadCv} disabled={cvBusy} />
            </label>
            {cvBusy && <p className="muted">Lecture du CV…</p>}
            {cvError && <p className="faceid-error">{cvError}</p>}
            {session.cv && (
              <>
                <SignalList signals={cvSignals} />
                {session.cv.found.schools.length > 0 && (
                  <p className="muted">Écoles repérées dans le CV : {session.cv.found.schools.join(', ')}.</p>
                )}
                <h3>Vérifier en un clic</h3>
                <p className="muted">
                  Recherches préparées à partir du CV et des déclarations : vous les ouvrez vous-même, rien n’est aspiré.
                </p>
                <ul className="cv-links">
                  {session.cv.links.map((l) => (
                    <li key={l.url}>
                      <span className="muted">{l.categorie}</span>{' '}
                      <a href={l.url} target="_blank" rel="noreferrer">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>Score consultatif : {session.score.value}/100</h2>
        <ul>
          {session.score.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Pendant l’entretien</h2>
        <SignalList
          signals={session.signals.filter((s) => s.id === 'face.continuity' || (s.source === 'challenge' && !s.label.includes('pré-vérification')))}
        />
        <ul className="status-list">
          {liveChallenges.map((c) => (
            <li key={c.at} className={c.result === 'passed' ? 'status-ok' : c.result === 'failed' ? 'status-contradiction' : 'status-unknown'}>
              {getChallenge(c.challengeId)?.label ?? c.challengeId} : {RESULT_LABEL[c.result]} ({(c.durationMs / 1000).toFixed(1)} s)
              <span className="muted">{formatMetrics(c.metrics)}</span>
            </li>
          ))}
          {liveChallenges.length === 0 && <li className="muted">Aucun défi proposé pour l’instant.</li>}
        </ul>
      </div>

      <div className="card">
        <h2>Décision du recruteur</h2>
        <p>
          {session.decision
            ? `${DECISION_LABEL[session.decision.value]} — ${new Date(session.decision.at).toLocaleTimeString('fr-FR')}`
            : 'Pas encore de décision.'}
        </p>
        <p className="muted">Le score est une aide. La décision appartient au recruteur.</p>
      </div>

      <button className="primary" onClick={() => window.print()}>
        Imprimer / PDF
      </button>
    </div>
  );
}
