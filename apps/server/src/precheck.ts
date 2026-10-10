import { checkTimezone, findVirtualCameras, type PrecheckPayload, type Signal } from '@kyc/shared';

export function precheckSignals(payload: PrecheckPayload, ip: string): Signal[] {
  const at = Date.now();
  const signals: Signal[] = [];

  const virtualCams = findVirtualCameras(payload.cameras);
  signals.push({
    id: 'precheck.virtual-camera',
    source: 'precheck',
    severity: 'strong',
    at,
    ...(payload.cameras.length === 0
      ? { status: 'unknown', label: 'Caméras', detail: "Le navigateur n'a listé aucune caméra." }
      : virtualCams.length > 0
        ? {
            status: 'contradiction',
            label: 'Caméra virtuelle déclarée par le navigateur',
            detail: `Périphérique « ${virtualCams[0]} ». Un nom de périphérique n'est pas une preuve : à confirmer par un défi.`,
          }
        : { status: 'ok', label: 'Caméras', detail: 'Aucune caméra virtuelle connue.' }),
  });

  const tz = checkTimezone(payload.declaredCountry, payload.timezone);
  signals.push({
    id: 'precheck.timezone',
    source: 'precheck',
    severity: 'medium',
    at,
    ...(tz === 'mismatch'
      ? {
          status: 'contradiction',
          label: 'Fuseau horaire incohérent avec le pays déclaré',
          detail: `Fuseau « ${payload.timezone} » pour le pays déclaré ${payload.declaredCountry}. Un déplacement ou un VPN d'entreprise est légitime : à demander simplement.`,
        }
      : tz === 'ok'
        ? { status: 'ok', label: 'Fuseau horaire', detail: 'Cohérent avec le pays déclaré.' }
        : { status: 'unknown', label: 'Fuseau horaire', detail: 'Pays non couvert, non vérifié.' }),
  });

  // TODO brique A : géolocaliser l'IP (base locale type GeoLite2, pas d'appel tiers) et la comparer au pays déclaré.
  signals.push({
    id: 'precheck.ip',
    source: 'precheck',
    severity: 'medium',
    at,
    status: 'unknown',
    label: 'Adresse IP',
    detail: `IP ${ip} relevée, localisation non vérifiée pour l'instant.`,
  });

  return signals;
}
