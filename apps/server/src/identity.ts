import { SUPPORTED_COUNTRIES, type DeclaredIdentity, type IdentityPayload, type Signal } from '@kyc/shared';

// Vérifications à partir de ce que le candidat déclare lui-même, uniquement via des API publiques officielles.
// On ne scrape ni Google ni LinkedIn. Règle n°1 : ne rien trouver n'est JAMAIS une contradiction.
const UA = 'KYC-Visio-PoC/0.1 (hackathon Secure Horizons)';
const TIMEOUT_MS = 6000;

async function getJson(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function githubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Nettoyage de ce que le candidat a saisi ---

const clean = (v: unknown, max = 120) => {
  const s = String(v ?? '').trim().slice(0, max);
  return s || undefined;
};

export function sanitizeIdentity(p: IdentityPayload): Omit<DeclaredIdentity, 'consentAt'> | null {
  const firstName = clean(p.firstName, 80);
  const lastName = clean(p.lastName, 80);
  if (!firstName || !lastName) return null;
  const email = clean(p.email, 160);
  const country = clean(p.country, 2)?.toUpperCase();
  return {
    firstName,
    lastName,
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : undefined,
    phone: clean(p.phone, 30),
    country: country && SUPPORTED_COUNTRIES.includes(country) ? country : undefined,
    city: clean(p.city, 80),
    jobTitle: clean(p.jobTitle, 120),
    company: clean(p.company, 120),
    githubUrl: clean(p.githubUrl, 200),
    linkedinUrl: clean(p.linkedinUrl, 200),
  };
}

// --- 1. Présence publique du nom ---

interface SourceHit {
  source: string;
  count: number;
}

async function wikipedia(lang: 'fr' | 'en', name: string): Promise<SourceHit> {
  const { body } = await getJson(
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(`"${name}"`)}`,
  );
  return { source: `Wikipédia ${lang.toUpperCase()}`, count: body?.query?.searchinfo?.totalhits ?? 0 };
}

async function githubUsers(name: string): Promise<SourceHit> {
  const { status, body } = await getJson(
    `https://api.github.com/search/users?per_page=1&q=${encodeURIComponent(`"${name}" in:name`)}`,
    githubHeaders(),
  );
  if (status !== 200) throw new Error(`GitHub ${status}`);
  return { source: 'GitHub', count: body?.total_count ?? 0 };
}

async function orcid(first: string, last: string): Promise<SourceHit> {
  const q = `given-names:"${first}" AND family-name:"${last}"`;
  const { body } = await getJson(`https://pub.orcid.org/v3.0/expanded-search/?rows=1&q=${encodeURIComponent(q)}`);
  return { source: 'ORCID', count: body?.['num-found'] ?? 0 };
}

async function brave(name: string): Promise<SourceHit> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error('pas de clé');
  const { status, body } = await getJson(
    `https://api.search.brave.com/res/v1/web/search?count=10&q=${encodeURIComponent(`"${name}"`)}`,
    { 'X-Subscription-Token': key },
  );
  if (status !== 200) throw new Error(`Brave ${status}`);
  const [first, last] = name.toLowerCase().split(' ');
  const hits = (body?.web?.results ?? []).filter((r: { title?: string; description?: string }) => {
    const t = `${r.title ?? ''} ${r.description ?? ''}`.toLowerCase();
    return t.includes(first) && t.includes(last);
  });
  return { source: 'Web (Brave Search)', count: hits.length };
}

export async function lookupWebPresence(firstName: string, lastName: string): Promise<Signal> {
  const name = `${firstName} ${lastName}`;
  const settled = await Promise.allSettled([
    brave(name),
    wikipedia('fr', name),
    wikipedia('en', name),
    githubUsers(name),
    orcid(firstName, lastName),
  ]);
  const hits = settled.flatMap((r) => (r.status === 'fulfilled' && r.value.count > 0 ? [r.value] : []));
  const answered = settled.filter((r) => r.status === 'fulfilled').length;
  const base = { id: 'identity.web-presence', source: 'identity' as const, severity: 'medium' as const, at: Date.now() };
  const webNote = process.env.BRAVE_API_KEY ? '' : ' Recherche web générale désactivée (clé BRAVE_API_KEY absente).';

  if (hits.length > 0) {
    return {
      ...base,
      status: 'ok',
      label: 'Présence publique du nom',
      detail:
        `Nom trouvé : ${hits.map((h) => `${h.source} (${h.count})`).join(', ')}. ` +
        `Des homonymes sont possibles : ce n'est pas une preuve d'identité.${webNote}`,
    };
  }
  return {
    ...base,
    status: 'unknown',
    label: 'Présence publique du nom',
    detail:
      answered === 0
        ? 'Recherche indisponible pour le moment. Sans effet sur le score.'
        : `Aucun résultat dans ${answered} source(s) publique(s). C'est courant (profil discret) : sans effet sur le score, ` +
          `à évoquer simplement si besoin.${webNote}`,
  };
}

// --- 2. Cohérence des informations écrites ---

// Adresses jetables courantes : inhabituelles pour une candidature, jamais une preuve.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'yopmail.com', 'yopmail.fr', 'yopmail.net', '10minutemail.com', 'guerrillamail.com',
  'guerrillamail.info', 'sharklasers.com', 'temp-mail.org', 'tempmail.com', 'trashmail.com', 'getnada.com',
  'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mohmal.com', 'tempail.com',
  'emailondeck.com', 'mintemail.com', 'mailnesia.com', 'jetable.org', 'mail-temporaire.fr', 'moakt.com',
  'tmpmail.org', 'burnermail.io', 'mytemp.email', 'tempmailo.com', 'minuteinbox.com', 'discard.email',
  'inboxkitten.com', 'trashmail.fr', 'spambox.us', 'tempr.email',
]);

const CALLING_CODES: Record<string, string[]> = {
  FR: ['33'], BE: ['32'], CH: ['41'], LU: ['352'], DE: ['49'], ES: ['34'], IT: ['39'], PT: ['351'], GB: ['44'],
  NL: ['31'], PL: ['48'], RO: ['40'], MA: ['212'], TN: ['216'], DZ: ['213'], SN: ['221'], CA: ['1'],
};

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function emailSignal(email: string): Signal {
  const domain = email.split('@')[1];
  const disposable = DISPOSABLE_DOMAINS.has(domain);
  return {
    id: 'identity.email',
    source: 'identity',
    severity: 'medium',
    at: Date.now(),
    status: disposable ? 'contradiction' : 'ok',
    label: disposable ? 'Adresse e-mail jetable' : 'Adresse e-mail',
    detail: disposable
      ? `Le domaine « ${domain} » fournit des adresses temporaires, inhabituelles pour une candidature : à demander simplement.`
      : `Domaine « ${domain} », pas une adresse temporaire connue.`,
  };
}

function phoneSignal(phone: string, country: string): Signal | null {
  let digits = phone.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+')) return null; // format national : on ne peut pas comparer, donc on ne dit rien
  const expected = CALLING_CODES[country];
  if (!expected) return null;
  const ok = expected.some((code) => digits.startsWith(`+${code}`));
  return {
    id: 'identity.phone',
    source: 'identity',
    severity: 'medium',
    at: Date.now(),
    status: ok ? 'ok' : 'contradiction',
    label: ok ? 'Indicatif téléphonique' : 'Indicatif téléphonique différent du pays déclaré',
    detail: ok
      ? `Cohérent avec le pays déclaré (${country}).`
      : `Numéro en ${digits.slice(0, 4)}… pour le pays déclaré ${country}. Un numéro étranger est fréquent (expatriation) : à demander simplement.`,
  };
}

function githubLogin(input: string): string | null {
  const m = input.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/?$/) ?? input.match(/^@?([A-Za-z0-9-]{1,39})$/);
  return m ? m[1] : null;
}

async function githubSignal(input: string, firstName: string, lastName: string): Promise<Signal> {
  const base = { id: 'identity.github', source: 'identity' as const, severity: 'medium' as const, at: Date.now() };
  const login = githubLogin(input);
  if (!login) {
    return { ...base, status: 'unknown', label: 'Profil GitHub déclaré', detail: 'Adresse non reconnue, non vérifiée.' };
  }
  try {
    const { status, body } = await getJson(`https://api.github.com/users/${login}`, githubHeaders());
    if (status === 404) {
      return {
        ...base,
        status: 'contradiction',
        label: 'Profil GitHub déclaré introuvable',
        detail: `Le compte « ${login} » n'existe pas : faute de frappe possible, à demander simplement.`,
      };
    }
    if (status !== 200) throw new Error(`HTTP ${status}`);
    const days = Math.floor((Date.now() - Date.parse(body.created_at)) / 86_400_000);
    const age = Number.isFinite(days) ? ` Compte créé il y a ${days} jour(s)${days < 180 ? ' (récent)' : ''}.` : '';
    const profileName = typeof body.name === 'string' ? normalize(body.name) : '';
    const words = profileName.split(/\s+/).filter(Boolean);
    // On ne compare que si le profil affiche un vrai nom complet (pas un pseudonyme d'un seul mot).
    const comparable = words.length >= 2;
    const matches = profileName.includes(normalize(lastName)) || profileName.includes(normalize(firstName));
    if (comparable && !matches) {
      return {
        ...base,
        status: 'contradiction',
        label: 'Nom du profil GitHub différent du nom déclaré',
        detail: `Le compte « ${login} » affiche « ${body.name} ».${age} Un nom d'usage ou un compte partagé peut l'expliquer : à demander simplement.`,
      };
    }
    return {
      ...base,
      status: 'ok',
      label: 'Profil GitHub déclaré',
      detail: `Le compte « ${login} » existe${comparable ? ' et son nom correspond' : ''}.${age}`,
    };
  } catch (err) {
    return { ...base, status: 'unknown', label: 'Profil GitHub déclaré', detail: `Vérification indisponible (${String(err)}).` };
  }
}

export async function declaredInfoSignals(identity: Omit<DeclaredIdentity, 'consentAt'>): Promise<Signal[]> {
  const out: Signal[] = [];
  if (identity.email) out.push(emailSignal(identity.email));
  if (identity.phone && identity.country) {
    const s = phoneSignal(identity.phone, identity.country);
    if (s) out.push(s);
  }
  if (identity.githubUrl) out.push(await githubSignal(identity.githubUrl, identity.firstName, identity.lastName));
  if (identity.linkedinUrl) {
    out.push({
      id: 'identity.linkedin',
      source: 'identity',
      severity: 'medium',
      at: Date.now(),
      status: 'unknown',
      label: 'Profil LinkedIn déclaré',
      detail: `${identity.linkedinUrl} — non vérifié automatiquement (pas de scraping) : à consulter vous-même si besoin.`,
    });
  }
  return out;
}
