import { DIFFERENT_FACE_MIN, DIFFERENT_PERSON_MAX, SAME_FACE_MAX, SAME_PERSON_MIN } from '@kyc/shared';

// Seuils de comparaison des visages, réglables sans toucher au code (à calibrer sur nos 20 tests).
function threshold(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < -1 || value > 1) throw new Error(`${name} doit être un nombre entre -1 et 1`);
  return value;
}

export const thresholds = {
  // Similarité d'empreinte : même personne au-dessus, personne différente en dessous (SFace publie 0,363).
  samePersonMin: threshold('FACE_SAME_PERSON_MIN', SAME_PERSON_MIN),
  differentPersonMax: threshold('FACE_DIFFERENT_PERSON_MAX', DIFFERENT_PERSON_MAX),
  // Écart des proportions du visage : même visage en dessous, différent au-dessus.
  sameShapeMax: threshold('FACE_SHAPE_SAME_MAX', SAME_FACE_MAX),
  differentShapeMin: threshold('FACE_SHAPE_DIFFERENT_MIN', DIFFERENT_FACE_MIN),
};

if (thresholds.differentPersonMax >= thresholds.samePersonMin) {
  throw new Error('FACE_DIFFERENT_PERSON_MAX doit rester sous FACE_SAME_PERSON_MIN');
}
if (thresholds.sameShapeMax >= thresholds.differentShapeMin) {
  throw new Error('FACE_SHAPE_SAME_MAX doit rester sous FACE_SHAPE_DIFFERENT_MIN');
}
