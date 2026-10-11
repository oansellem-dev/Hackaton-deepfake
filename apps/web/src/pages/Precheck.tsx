import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { SUPPORTED_COUNTRIES, type CandidateLinkInfo, type FaceIdStep, type IdentityPayload, type Schedule } from '@kyc/shared';
import { FaceId, type FaceIdOutcome } from '../components/FaceId.tsx';
import { ScreenFlash, type ScreenFlashOutcome } from '../components/ScreenFlash.tsx';
import { LogoIntro, LogoMark } from '../components/Logo.tsx';
import { api } from '../config.ts';
import { LANGS, lang, locale, setLang, t } from '../i18n.ts';
import '../precheck.css';

/**
 * Lien de pré-vérification envoyé au candidat (/check/<jeton>, usage unique, valable peu de temps).
 * Un écran à la fois : intro animée, créneau de l'entretien (confirmer ou proposer), informations en courts
 * blocs, accord biométrique, vérification du visage, reflet de l'écran, appareil, puis le récapitulatif avec le
 * lien de la visio. Aucune image ne quitte le navigateur.
 */
type Step = 'loading' | 'intro' | 'slot' | 'identity' | 'consent' | 'face' | 'flash' | 'device' | 'done' | 'expired';
type Bloc = 'nom' | 'contact' | 'lieu' | 'profil' | 'accord';
const BLOCS: Bloc[] = ['nom', 'contact', 'lieu', 'profil', 'accord'];
const ETAPES: { id: Step; label: string }[] = [
  { id: 'slot', label: t('Créneau') },
  { id: 'identity', label: t('Infos') },
  { id: 'consent', label: t('Accord') },
  { id: 'face', label: t('Visage') },
  { id: 'flash', label: t('Reflet') },
  { id: 'done', label: t('Fin') },
];

const FLASH_TEXT: Record<ScreenFlashOutcome['result'], string> = { passed: t('réalisé'), failed: t('non concluant'), inconclusive: t('non concluant'), skipped: t('passé') };
const STEP_NAME: Record<FaceIdStep, string> = { center: t('Visage de face'), turn_a: t('Tête tournée à droite'), turn_b: t('Tête tournée à gauche'), hand: t('Main devant le visage') };
const COUNTRY_NAMES: Record<string, string> = {
  FR: t('France'), BE: t('Belgique'), CH: t('Suisse'), LU: t('Luxembourg'), DE: t('Allemagne'), ES: t('Espagne'), IT: t('Italie'), PT: t('Portugal'), GB: t('Royaume-Uni'),
  NL: t('Pays-Bas'), PL: t('Pologne'), RO: t('Roumanie'), MA: t('Maroc'), TN: t('Tunisie'), DZ: t('Algérie'), SN: t('Sénégal'), CA: t('Canada'),
};

type Form = Omit<IdentityPayload, 'consent'>;
const EMPTY: Form = { firstName: '', lastName: '', email: '', phone: '', country: 'FR', city: '', jobTitle: '', company: '', githubUrl: '', linkedinUrl: '' };

const fmtJour = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtHeure = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
const fmtCourt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fournisseur = (url?: string) => (!url ? t('visio') : /meet\.google\./.test(url) ? 'Google Meet' : /zoom\./.test(url) ? 'Zoom' : /teams\./.test(url) ? 'Teams' : t('visio'));
const localDateTime = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Fichier d'agenda (.ics) avec le créneau et le lien de la visio, généré dans le navigateur. */
function icsHref(s: Schedule, titre: string): string {
  const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Oval//FR', 'BEGIN:VEVENT', `UID:oval-${s.at}@oval`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(s.at)}`, `DTEND:${stamp(s.at + s.durationMin * 60000)}`, `SUMMARY:${titre}`, ...(s.visioUrl ? [`LOCATION:${s.visioUrl}`, `DESCRIPTION:${t('Rejoindre la visio : {url}', { url: s.visioUrl })}`] : []), 'END:VEVENT', 'END:VCALENDAR'];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lignes.join('\r\n'))}`;
}

export function Precheck() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<CandidateLinkInfo | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [apres, setApres] = useState<Step>('identity'); // étape qui suit l'intro
  const [bloc, setBloc] = useState<Bloc>('nom');
  const [form, setForm] = useState<Form>(EMPTY);
  const [infoConsent, setInfoConsent] = useState(false);
  const [bioConsent, setBioConsent] = useState(false);
  const [outcome, setOutcome] = useState<FaceIdOutcome | null>(null);
  const [flash, setFlash] = useState<ScreenFlashOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);
  // Créneau
  const [contre, setContre] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [reponse, setReponse] = useState<Schedule['response'] | null>(null);

  async function refresh() {
    try {
      const i = await api.getLink(token);
      setInfo(i);
      setWithdrawn(i.withdrawn);
      if (i.schedule?.response) setReponse(i.schedule.response);
      return i;
    } catch {
      setStep('expired');
      return null;
    }
  }

  useEffect(() => {
    refresh().then((i) => {
      if (!i) return;
      // Pré-rempli par le recruteur (nom, e-mail) et par le CV qu'il a chargé : le candidat vérifie et corrige.
      if (i.prefill) setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(i.prefill!).filter(([, v]) => !!v)) }));
      else if (i.candidateFirstName) setForm((f) => ({ ...f, firstName: i.candidateFirstName! }));
      let suite: Step;
      if (i.status === 'open') suite = i.schedule && !i.schedule.response ? 'slot' : i.identityDone ? 'consent' : 'identity';
      else if (i.faceDone && !i.flashDone && !i.optedOut && !i.withdrawn && i.status === 'used') suite = 'flash';
      else if (i.faceDone || i.optedOut || i.status === 'used') suite = 'done';
      else suite = 'expired';
      setApres(suite);
      setStep(suite === 'expired' ? 'expired' : 'intro');
    });
  }, [token]);

  // Intro : 2,4 s, ou un clic
  useEffect(() => {
    if (step !== 'intro') return;
    const timer = setTimeout(() => setStep(apres), 2400);
    return () => clearTimeout(timer);
  }, [step, apres]);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const schedule = info?.schedule;
  const alternatives = useMemo(() => (schedule?.alternatives ?? []).filter((a) => a > Date.now()).slice(0, 6), [schedule]);

  async function repondreCreneau(body: { confirm?: boolean; proposeAt?: number; message?: string }) {
    setRunning(true); setError(null);
    try {
      const r = await api.sendSchedule(token, body);
      setReponse(r.schedule.response ?? null);
      setInfo((i) => (i ? { ...i, schedule: r.schedule } : i));
      setTimeout(() => setStep(info?.identityDone ? 'consent' : 'identity'), 1400);
    } catch (err) { setError(String(err)); }
    finally { setRunning(false); }
  }

  async function submitIdentity() {
    setRunning(true); setError(null);
    try { await api.sendIdentity(token, { ...form, consent: infoConsent }); setStep('consent'); }
    catch (err) { setError(String(err).includes('410') ? t('Ce lien a expiré ou a déjà été utilisé.') : String(err)); }
    finally { setRunning(false); }
  }
  async function optOut() {
    setRunning(true);
    try { await api.optOut(token); await refresh(); setStep('done'); } catch (err) { setError(String(err)); } finally { setRunning(false); }
  }
  async function bindDevice() {
    setRunning(true); setError(null);
    try {
      const optionsJSON = await api.deviceOptions(token);
      const response = await startRegistration({ optionsJSON: optionsJSON as never });
      await api.registerDevice(token, response);
      await refresh(); setStep('done');
    } catch (err) { setError(t('L’appareil n’a pas pu être associé ({err}). Vous pouvez passer cette étape.', { err: err instanceof Error ? err.message : String(err) })); }
    finally { setRunning(false); }
  }
  async function withdraw() {
    setRunning(true);
    try { await api.withdraw(token); setWithdrawn(true); } catch (err) { setError(String(err)); } finally { setRunning(false); }
  }

  const controller = info?.controller;
  const entreprise = controller?.name ?? t('Le recruteur');
  const retentionHours = info?.biometricRetentionHours ?? 24;
  const etapes = info?.schedule ? ETAPES : ETAPES.filter((e) => e.id !== 'slot');
  const iEtape = etapes.findIndex((e) => e.id === (step === 'device' ? 'flash' : step));
  const prenom = form.firstName || info?.candidateFirstName || '';

  if (step === 'loading') return <div className="pc"><div className="pc-intro pc-intro--calme"><LogoIntro /></div></div>;
  if (step === 'expired') {
    return (
      <div className="pc"><Tete /><main className="pc-main"><section className="pc-card pc-screen"><h2>{t('Ce lien n’est plus valable')}</h2><p className="muted">{t('Il a expiré ou a déjà été utilisé. Demandez un nouveau lien au recruteur.')}</p></section></main></div>
    );
  }
  if (step === 'intro') {
    return (
      <div className="pc" onClick={() => setStep(apres)}>
        <div className="pc-intro">
          <i className="pc-blob pc-blob--1" /><i className="pc-blob pc-blob--2" /><i className="pc-blob pc-blob--3" />
          <LogoIntro />
          <span className="pc-intro__mot">Oval</span>
          <span className="pc-intro__sous">{prenom ? t('Bonjour {prenom}', { prenom }) : t('Vérification avant votre entretien')}</span>
          <Langues />
        </div>
      </div>
    );
  }

  return (
    <div className="pc">
      <Tete etape={iEtape} etapes={etapes} />
      <main className="pc-main" key={step}>
        {step === 'slot' && schedule && (
          <section className="pc-card pc-screen">
            {!reponse ? (
              <>
                <span className="pc-kicker">{t('Votre entretien avec {entreprise}', { entreprise })}</span>
                <h2 className="pc-titre">{cap(fmtJour.format(schedule.at))}<br /><span className="pc-heure">{fmtHeure.format(schedule.at)}</span></h2>
                <p className="pc-meta">{schedule.durationMin} min · {fournisseur(schedule.visioUrl)}{schedule.recruiterName ? t(' · avec {nom}', { nom: schedule.recruiterName }) : ''}</p>
                {!contre ? (
                  <div className="pc-actions">
                    <button className="pc-btn pc-btn--primaire" disabled={running} onClick={() => void repondreCreneau({ confirm: true })}>{t('Ça me va')}</button>
                    <button className="pc-btn" disabled={running} onClick={() => setContre(true)}>{t('Proposer un autre créneau')}</button>
                  </div>
                ) : (
                  <div className="pc-contre">
                    {alternatives.length > 0 && (
                      <>
                        <p className="pc-label">{t('Créneaux où {nom} est disponible', { nom: schedule.recruiterName ? schedule.recruiterName.split(' ')[0] : t('le recruteur') })}</p>
                        <div className="pc-chips">
                          {alternatives.map((a) => <button key={a} type="button" className={`pc-chip${slot === a ? ' is-on' : ''}`} onClick={() => { setSlot(a); setCustom(''); }}>{cap(fmtCourt.format(a))}</button>)}
                        </div>
                      </>
                    )}
                    <label className="pc-field"><span>{t('Ou un autre moment')}</span><input type="datetime-local" value={custom} min={localDateTime(new Date())} onChange={(e) => { setCustom(e.target.value); setSlot(null); }} /></label>
                    <label className="pc-field"><span>{t('Un mot pour le recruteur (facultatif)')}</span><input value={message} maxLength={300} placeholder={t('Ex. je termine à 13 h ce jour-là')} onChange={(e) => setMessage(e.target.value)} /></label>
                    <div className="pc-actions">
                      <button className="pc-btn pc-btn--primaire" disabled={running || (!slot && !custom)} onClick={() => void repondreCreneau({ proposeAt: slot ?? new Date(custom).getTime(), message: message || undefined })}>{t('Envoyer ma proposition')}</button>
                      <button className="pc-btn pc-btn--discret" disabled={running} onClick={() => setContre(false)}>{t('Retour')}</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="pc-ok">
                <span className="pc-ok__coche" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                <h2>{reponse.kind === 'confirmed' ? t('Créneau confirmé') : t('Proposition envoyée')}</h2>
                <p className="muted">{reponse.kind === 'confirmed' ? t('{jour} à {heure}. On continue avec la vérification.', { jour: cap(fmtJour.format(schedule.at)), heure: fmtHeure.format(schedule.at) }) : t('{entreprise} reçoit votre proposition et vous confirmera le créneau. On continue avec la vérification.', { entreprise })}</p>
              </div>
            )}
            {error && <p className="pc-erreur">{error}</p>}
          </section>
        )}

        {step === 'identity' && (
          <section className="pc-card pc-screen" key={bloc}>
            <span className="pc-kicker">{t('Vos informations')} · {BLOCS.indexOf(bloc) + 1}/{BLOCS.length}</span>
            {bloc === 'nom' && (
              <>
                <h2>{t('Qui êtes-vous ?')}</h2>
                <p className="muted">{t('{entreprise} vous propose une vérification de deux minutes avant l’entretien, pour s’assurer que la personne en visio sera bien vous.', { entreprise })}</p>
                {info?.prefill && Object.values(info.prefill).some(Boolean) && <p className="pc-note">{info.prefillFromCv ? t('Certains champs sont pré-remplis d’après votre CV : vérifiez-les et corrigez si besoin.') : t('Certains champs sont pré-remplis par le recruteur : vérifiez-les et corrigez si besoin.')}</p>}
                <div className="pc-grille">
                  <label className="pc-field"><span>{t('Prénom')}</span><input value={form.firstName} onChange={set('firstName')} autoComplete="given-name" autoFocus /></label>
                  <label className="pc-field"><span>{t('Nom')}</span><input value={form.lastName} onChange={set('lastName')} autoComplete="family-name" /></label>
                </div>
              </>
            )}
            {bloc === 'contact' && (
              <>
                <h2>{t('Comment vous joindre')}</h2>
                <div className="pc-grille">
                  <label className="pc-field"><span>{t('E-mail')}</span><input type="email" value={form.email} onChange={set('email')} autoComplete="email" autoFocus /></label>
                  <label className="pc-field"><span>{t('Téléphone')}</span><input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="+33 6 12 34 56 78" /></label>
                </div>
              </>
            )}
            {bloc === 'lieu' && (
              <>
                <h2>{t('D’où passerez-vous l’entretien ?')}</h2>
                <div className="pc-grille">
                  <label className="pc-field"><span>{t('Pays')}</span><select value={form.country} onChange={set('country')}>{SUPPORTED_COUNTRIES.map((c) => <option key={c} value={c}>{COUNTRY_NAMES[c] ?? c}</option>)}</select></label>
                  <label className="pc-field"><span>{t('Ville')}</span><input value={form.city} onChange={set('city')} autoComplete="address-level2" autoFocus /></label>
                </div>
              </>
            )}
            {bloc === 'profil' && (
              <>
                <h2>{t('Votre parcours')} <span className="pc-facultatif">{t('facultatif')}</span></h2>
                <div className="pc-grille">
                  <label className="pc-field"><span>{t('Poste actuel ou dernier poste')}</span><input value={form.jobTitle} onChange={set('jobTitle')} autoComplete="organization-title" autoFocus /></label>
                  <label className="pc-field"><span>{t('Entreprise')}</span><input value={form.company} onChange={set('company')} autoComplete="organization" /></label>
                  <label className="pc-field"><span>GitHub</span><input value={form.githubUrl} onChange={set('githubUrl')} placeholder="https://github.com/…" /></label>
                  <label className="pc-field"><span>LinkedIn</span><input value={form.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://www.linkedin.com/in/…" /></label>
                </div>
                <p className="muted">{t('Les champs vides ne vous pénalisent pas, et ne rien trouver sur vous en ligne non plus.')}</p>
              </>
            )}
            {bloc === 'accord' && (
              <>
                <h2>{t('Ce que nous vérifions')}</h2>
                <ul className="pc-liste">
                  <li><i>1</i><span>{t('votre nom dans des sources publiques (Wikipédia, GitHub, ORCID, moteur de recherche)')}</span></li>
                  <li><i>2</i><span>{t('la cohérence de ce que vous déclarez : pays, téléphone, e-mail, profils')}</span></li>
                  <li><i>3</i><span>{t('à l’étape suivante, votre caméra, votre fuseau horaire, votre adresse IP et votre visage')}</span></li>
                  <li><i>4</i><span>{t('enfin, le reflet des couleurs de votre écran sur votre visage, analysé dans votre navigateur, facultatif')}</span></li>
                </ul>
                <label className="pc-consent"><input type="checkbox" checked={infoConsent} onChange={(e) => setInfoConsent(e.target.checked)} /><span>{t('J’accepte que ces informations soient vérifiées dans des sources publiques et transmises au recruteur.')} <Link to={`/confidentialite/${token}`} target="_blank">{t('Mentions d’information')}</Link></span></label>
              </>
            )}
            <div className="pc-actions">
              {bloc !== 'accord' ? (
                <button className="pc-btn pc-btn--primaire" disabled={bloc === 'nom' && (!form.firstName.trim() || !form.lastName.trim())} onClick={() => setBloc(BLOCS[BLOCS.indexOf(bloc) + 1])}>{t('Continuer')}</button>
              ) : (
                <button className="pc-btn pc-btn--primaire" disabled={running || !infoConsent} onClick={() => void submitIdentity()}>{running ? t('Vérification…') : t('Valider mes informations')}</button>
              )}
              {bloc !== 'nom' && <button className="pc-btn pc-btn--discret" onClick={() => setBloc(BLOCS[BLOCS.indexOf(bloc) - 1])}>{t('Retour')}</button>}
            </div>
            {error && <p className="pc-erreur">{error}</p>}
          </section>
        )}

        {step === 'consent' && (
          <section className="pc-card pc-screen">
            <span className="pc-kicker">{t('Vérification du visage')}</span>
            <h2>{t('Votre accord')}</h2>
            <div className="pc-faits">
              <div><b>{t('Pourquoi')}</b><span>{t('Vérifier que la personne en entretien est bien celle qui fait cette vérification, et détecter une vidéo truquée. Jamais d’identification dans une base de visages, jamais d’analyse de vos émotions.')}</span></div>
              <div><b>{t('Ce qui est traité')}</b><span>{t('Votre visage, analysé uniquement dans votre navigateur : aucune image n’est envoyée ni enregistrée. Seule une empreinte numérique (des mesures) est conservée, chiffrée.')}</span></div>
              <div><b>{t('Combien de temps')}</b><span>{t('Jusqu’à la décision du recruteur, et au plus {heures} heures.', { heures: retentionHours })}</span></div>
              <div><b>{t('Responsable')}</b><span>{controller ? `${controller.name}${controller.contact ? ` (${controller.contact})` : ''}` : t('L’entreprise qui vous a envoyé ce lien')}. {t('Retrait possible à tout moment depuis cette page.')} <Link to={`/confidentialite/${token}`} target="_blank">{t('Mentions d’information')}</Link></span></div>
              <div><b>{t('Si vous refusez')}</b><span>{t('Aucune pénalité : le recruteur vérifiera lui-même pendant l’entretien, sans biométrie.')}</span></div>
            </div>
            <label className="pc-consent"><input type="checkbox" checked={bioConsent} onChange={(e) => setBioConsent(e.target.checked)} /><span>{t('J’accepte le traitement de mon visage décrit ci-dessus (donnée biométrique, article 9 du RGPD), pour cet entretien uniquement.')}</span></label>
            <div className="pc-actions">
              <button className="pc-btn pc-btn--primaire" disabled={!bioConsent} onClick={() => setStep('face')}>{t('Continuer vers la caméra')}</button>
              <button className="pc-btn pc-btn--discret" disabled={running} onClick={() => void optOut()}>{t('Je préfère une vérification sans biométrie')}</button>
            </div>
            {error && <p className="pc-erreur">{error}</p>}
          </section>
        )}

        {step === 'face' && <div className="pc-screen"><FaceId token={token} declaredCountry={form.country ?? 'FR'} onDone={(o) => { setOutcome(o); setStep('flash'); }} /></div>}
        {step === 'flash' && <div className="pc-screen"><ScreenFlash token={token} deviceId={outcome?.deviceId} onDone={(f) => { setFlash(f); setStep(window.PublicKeyCredential ? 'device' : 'done'); }} /></div>}

        {step === 'device' && (
          <section className="pc-card pc-screen">
            <span className="pc-kicker">{t('Dernière étape, facultative')}</span>
            <h2>{t('Associer cet appareil')}</h2>
            <p className="muted">{t('Pendant l’entretien, le recruteur pourra vous demander de confirmer en un clic que vous utilisez le même appareil. Votre code, votre empreinte ou votre visage restent dans l’appareil, rien n’est envoyé.')}</p>
            <div className="pc-actions">
              <button className="pc-btn pc-btn--primaire" disabled={running} onClick={() => void bindDevice()}>{t('Associer cet appareil')}</button>
              <button className="pc-btn pc-btn--discret" disabled={running} onClick={() => setStep('done')}>{t('Passer')}</button>
            </div>
            {error && <p className="pc-erreur">{error}</p>}
          </section>
        )}

        {step === 'done' && (
          <section className="pc-card pc-screen">
            <div className="pc-ok">
              <span className="pc-ok__coche" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
              <h2>{info?.optedOut ? t('C’est noté, merci') : t('Pré-vérification terminée')}</h2>
              <p className="muted">{info?.optedOut ? t('Vous avez choisi la vérification sans biométrie : le recruteur fera les vérifications en direct, sans aucune pénalité.') : t('{entreprise} est prévenu. Vous n’avez rien d’autre à faire avant l’entretien.', { entreprise })}</p>
            </div>

            {schedule && (
              <div className="pc-rdv">
                <div className="pc-rdv__txt">
                  <b>{reponse?.kind === 'proposed' && reponse.slot ? t('Vous avez proposé {jour} à {heure}', { jour: fmtJour.format(reponse.slot), heure: fmtHeure.format(reponse.slot) }) : t('{jour} à {heure}', { jour: cap(fmtJour.format(schedule.at)), heure: fmtHeure.format(schedule.at) })}</b>
                  <span>{reponse?.kind === 'proposed' ? t('En attente de confirmation par {entreprise}', { entreprise }) : `${schedule.durationMin} min · ${fournisseur(schedule.visioUrl)}${schedule.recruiterName ? t(' · avec {nom}', { nom: schedule.recruiterName }) : ''}`}</span>
                </div>
                <div className="pc-rdv__btns">
                  {schedule.visioUrl && <a className="pc-btn pc-btn--primaire" href={schedule.visioUrl} target="_blank" rel="noreferrer">{t('Rejoindre sur {visio}', { visio: fournisseur(schedule.visioUrl) })}</a>}
                  {reponse?.kind !== 'proposed' && <a className="pc-btn" href={icsHref(schedule, t('Entretien avec {entreprise}', { entreprise }))} download="entretien-oval.ics">{t('Ajouter à mon agenda')}</a>}
                </div>
              </div>
            )}

            {(outcome || flash) && (
              <ul className="pc-bilan">
                {outcome?.environment.map((r) => <li key={r.label} className={r.status === 'ok' ? '' : 'is-unknown'}><i>{r.status === 'ok' ? '✓' : '·'}</i><span>{r.label}</span><small>{r.status === 'ok' ? t('vérifié') : t('relevé')}</small></li>)}
                {outcome?.steps.map((s, i) => <li key={i} className={s.result === 'passed' ? '' : 'is-unknown'}><i>{s.result === 'passed' ? '✓' : '·'}</i><span>{STEP_NAME[s.step]}</span><small>{s.result === 'passed' ? t('réalisé') : t('non concluant, sans effet')}</small></li>)}
                {flash && <li className={flash.result === 'passed' ? '' : 'is-unknown'}><i>{flash.result === 'passed' ? '✓' : '·'}</i><span>{t('Reflet de l’écran')}</span><small>{FLASH_TEXT[flash.result]}</small></li>}
                {info?.deviceBound && <li><i>✓</i><span>{t('Appareil associé')}</span><small>{t('clé d’accès créée')}</small></li>}
              </ul>
            )}

            <ol className="pc-liste pc-liste--suite">
              <li><i>1</i><span>{t('Le jour J, connectez-vous à la visio depuis cet ordinateur, avec la même caméra.')}</span></li>
              <li><i>2</i><span>{t('Le recruteur pourra vous demander un geste simple (tourner la tête, passer la main devant le visage). C’est normal.')}</span></li>
              <li><i>3</i><span>{t('Aucune vidéo n’est enregistrée. Le recruteur décide : cette vérification ne remplace pas son jugement.')}</span></li>
            </ol>

            <div className="pc-pied">
              {withdrawn ? <strong>{t('Votre accord est retiré : l’empreinte de votre visage est supprimée.')}</strong>
                : info?.optedOut ? <span>{t('Aucune donnée biométrique n’a été collectée.')}</span>
                : <><span>{t('Une empreinte numérique de votre visage (des mesures, aucune image) est conservée, chiffrée, jusqu’à la décision du recruteur et au plus {heures} heures.', { heures: retentionHours })}</span><button className="pc-btn pc-btn--discret" disabled={running} onClick={() => void withdraw()}>{t('Retirer mon accord et supprimer mon empreinte')}</button></>}
              <span><Link to={`/confidentialite/${token}`}>{t('Mentions d’information')}</Link> · {t('Vous pouvez fermer cette page.')}</span>
            </div>
            {error && <p className="pc-erreur">{error}</p>}
          </section>
        )}
      </main>
    </div>
  );
}

function Tete({ etape = -1, etapes = ETAPES }: { etape?: number; etapes?: typeof ETAPES }) {
  return (
    <header className="pc-tete">
      <span className="pc-marque"><LogoMark size={26} />Oval</span>
      {etape >= 0 && (
        <ol className="pc-prog" aria-label={t('Progression')}>
          {etapes.map((e, i) => <li key={e.id} className={i < etape ? 'is-fait' : i === etape ? 'is-actif' : ''}><i /><span>{e.label}</span></li>)}
        </ol>
      )}
      <Langues />
    </header>
  );
}

/** Choix de la langue (FR / EN) : gardé dans le navigateur, la page se recharge dans la langue choisie. */
function Langues() {
  return (
    <span className="pc-lang" role="group" aria-label={t('Langue')} onClick={(e) => e.stopPropagation()}>
      {LANGS.map((l) => <button key={l.id} type="button" className={lang === l.id ? 'is-on' : ''} aria-label={l.name} aria-pressed={lang === l.id} onClick={(e) => { e.stopPropagation(); setLang(l.id); }}>{l.id.toUpperCase()}</button>)}
    </span>
  );
}
