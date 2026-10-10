import type { Signal } from '@kyc/shared';

// Recherche publique du nom déclaré, via une API de recherche officielle (Brave Search, clé BRAVE_API_KEY).
// Règle n°1 : ne rien trouver n'est JAMAIS une contradiction. Au pire le signal reste « unknown », sans effet sur le score.
// On ne scrape ni Google ni LinkedIn, et on ne garde que le nombre de résultats et leurs noms de domaine.
const API = 'https://api.search.brave.com/res/v1/web/search';

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
}

export async function lookupIdentity(firstName: string, lastName: string): Promise<Signal> {
  const base = { id: 'identity.web-presence', source: 'identity' as const, severity: 'medium' as const, at: Date.now() };
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    return {
      ...base,
      status: 'unknown',
      label: 'Présence publique du nom',
      detail: 'Recherche non configurée (clé BRAVE_API_KEY absente). Sans effet sur le score.',
    };
  }
  try {
    const res = await fetch(`${API}?q=${encodeURIComponent(`"${firstName} ${lastName}"`)}&count=10`, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { web?: { results?: BraveResult[] } };
    const first = firstName.toLowerCase();
    const last = lastName.toLowerCase();
    const matches = (data.web?.results ?? []).filter((r) => {
      const text = `${r.title ?? ''} ${r.description ?? ''}`.toLowerCase();
      return text.includes(first) && text.includes(last);
    });
    if (matches.length === 0) {
      return {
        ...base,
        status: 'unknown',
        label: 'Présence publique du nom',
        detail:
          "Aucun résultat public pour ce nom. C'est courant (profil discret, homonymes) : sans effet sur le score, à évoquer simplement si besoin.",
      };
    }
    const hosts = [...new Set(matches.map((r) => new URL(r.url ?? 'http://inconnu').hostname.replace(/^www\./, '')))];
    return {
      ...base,
      status: 'ok',
      label: 'Présence publique du nom',
      detail: `${matches.length} résultat(s) public(s) mentionnent ce nom (${hosts.slice(0, 3).join(', ')}).`,
    };
  } catch (err) {
    return {
      ...base,
      status: 'unknown',
      label: 'Présence publique du nom',
      detail: `Recherche indisponible (${String(err)}). Sans effet sur le score.`,
    };
  }
}
