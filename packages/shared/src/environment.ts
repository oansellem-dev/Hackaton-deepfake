// Contrôles d'environnement de la page de pré-vérification (brique A).
// Un nom de périphérique ou un fuseau horaire n'est jamais une preuve : on signale, on ne condamne pas.

const VIRTUAL_CAMERA_PATTERNS = [
  /obs/i,
  /virtual/i,
  /virtuelle/i,
  /manycam/i,
  /snap camera/i,
  /xsplit/i,
  /mmhmm/i,
  /camtwist/i,
  /e2esoft/i,
  /splitcam/i,
  /deepfacelive/i,
  /avatarify/i,
];

export function findVirtualCameras(labels: string[]): string[] {
  return labels.filter((label) => VIRTUAL_CAMERA_PATTERNS.some((re) => re.test(label)));
}

// Liste volontairement courte. Un pays absent donne « unknown », jamais une contradiction.
const COUNTRY_TIMEZONES: Record<string, string[]> = {
  FR: ['Europe/Paris'],
  BE: ['Europe/Brussels'],
  CH: ['Europe/Zurich'],
  LU: ['Europe/Luxembourg'],
  DE: ['Europe/Berlin', 'Europe/Busingen'],
  ES: ['Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta'],
  IT: ['Europe/Rome'],
  PT: ['Europe/Lisbon', 'Atlantic/Madeira', 'Atlantic/Azores'],
  GB: ['Europe/London'],
  NL: ['Europe/Amsterdam'],
  PL: ['Europe/Warsaw'],
  RO: ['Europe/Bucharest'],
  MA: ['Africa/Casablanca'],
  TN: ['Africa/Tunis'],
  DZ: ['Africa/Algiers'],
  SN: ['Africa/Dakar'],
  CA: ['America/Toronto', 'America/Montreal', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax'],
};

export type TimezoneCheck = 'ok' | 'mismatch' | 'unknown';

export function checkTimezone(declaredCountry: string, timezone: string): TimezoneCheck {
  const expected = COUNTRY_TIMEZONES[declaredCountry.toUpperCase()];
  if (!expected || !timezone) return 'unknown';
  return expected.includes(timezone) ? 'ok' : 'mismatch';
}

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_TIMEZONES);
