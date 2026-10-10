import { computeScore, getChallenge, median, type AgentInfo, type Session, type SessionView } from '@kyc/shared';
import { stripBiometrics } from './store.ts';

// Agent de score et de recommandation (agent/, FastAPI). S'il est injoignable, on retombe sur computeScore.
const AGENT_URL = process.env.AGENT_URL ?? 'http://localhost:8000';
const TIMEOUT_MS = 15000; // analyse d'une capture
const ASSESS_TIMEOUT_MS = 6000; // score : au-delà, on affiche le score local plutôt que de faire attendre le recruteur

// Défis de la bibliothèque ↔ types de l'agent.
const TO_AGENT: Record<string, string> = {
  'hand-over-face': 'hand_occlusion',
  'head-turn': 'head_turn',
  'random-phrase': 'random_phrase',
};
const FROM_AGENT = Object.fromEntries(Object.entries(TO_AGENT).map(([id, type]) => [type, id]));

interface AgentOutput {
  score: number | null;
  level: 'green' | 'orange' | 'red' | 'insufficient_data';
  explanation: string;
  recommendations: { challenge: string; phrase: string; rationale: string }[];
  passive?: { frames_analyzed: number; median_fake_probability: number | null } | null;
}

function statusOf(session: Session, id: string) {
  return session.signals.find((s) => s.id === id)?.status;
}

// Traduit une session en entrée de l'agent. Un signal « unknown » devient null : il ne compte jamais.
function toAgentInput(session: Session) {
  // Caméra virtuelle : installée et utilisée à la pré-vérification, ou utilisée pendant l'entretien.
  const cam = [statusOf(session, 'precheck.virtual-camera'), statusOf(session, 'live.virtual-camera')].includes(
    'contradiction',
  )
    ? 'contradiction'
    : statusOf(session, 'precheck.virtual-camera');
  const passive = session.passiveScores ?? [];
  const tz = statusOf(session, 'precheck.timezone');
  const face = statusOf(session, 'face.continuity');
  return {
    session_id: session.id,
    environment: {
      virtual_camera_detected: cam === 'contradiction' ? true : cam === 'ok' ? false : null,
      timezone_consistent: tz === 'ok' ? true : tz === 'contradiction' ? false : null,
    },
    face_continuity: face === 'ok' ? true : face === 'contradiction' ? false : null,
    // Gardé côté serveur : un redémarrage de l'agent ne fait pas perdre les captures déjà analysées.
    passive: passive.length ? { frames_analyzed: passive.length, median_fake_probability: median(passive) } : null,
    challenges: session.challenges
      .filter((c) => TO_AGENT[c.challengeId])
      .map((c) => ({
        type: TO_AGENT[c.challengeId],
        status: c.result === 'passed' ? 'passed' : c.result === 'failed' ? 'failed' : 'inconclusive',
        phase: c.phase ?? 'live',
      })),
    // Incohérences dans ce que le candidat a écrit (e-mail jetable, indicatif, profil GitHub…).
    cv_contradictions: session.signals
      .filter((s) => (s.source === 'identity' || s.source === 'cv') && s.status === 'contradiction')
      .map((s) => ({ field: s.id, detail: s.label })),
    available_challenges: Object.values(TO_AGENT),
  };
}

// Vue de session avec le score de l'agent ; repli sur le score local si l'agent ne répond pas.
export async function viewWithAgent(session: Session): Promise<SessionView> {
  const local = computeScore(session.signals);
  try {
    const res = await fetch(`${AGENT_URL}/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toAgentInput(session)),
      signal: AbortSignal.timeout(ASSESS_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`agent ${res.status}`);
    const out = (await res.json()) as AgentOutput;

    // Données insuffisantes côté agent : le score et le niveau restent ceux des signaux de pré-vérification.
    const insufficient = out.level === 'insufficient_data';
    const explanation = out.explanation
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 3);
    const recommendations = out.recommendations
      .filter((r) => FROM_AGENT[r.challenge] && getChallenge(FROM_AGENT[r.challenge]))
      .map((r) => ({ challengeId: FROM_AGENT[r.challenge], phrase: r.phrase, rationale: r.rationale }));
    const agent: AgentInfo = {
      available: true,
      recommendations,
      passive: out.passive
        ? { frames: out.passive.frames_analyzed, medianFakeProbability: out.passive.median_fake_probability }
        : undefined,
    };
    return {
      ...stripBiometrics(session),
      score: {
        value: out.score ?? local.value,
        level: out.level === 'insufficient_data' ? local.level : out.level,
        explanation: insufficient ? local.explanation : explanation,
      },
      agent,
    };
  } catch (err) {
    console.warn('Agent de score injoignable, score local utilisé :', String(err));
    return { ...stripBiometrics(session), score: local, agent: { available: false, recommendations: [] } };
  }
}

// Transmet une capture du visage au détecteur passif local. L'image n'est ni stockée ni journalisée.
export async function forwardFrame(sessionId: string, image: Buffer, contentType: string) {
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(image)], { type: contentType }), 'frame.jpg');
  const res = await fetch(`${AGENT_URL}/frame/${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

export interface CvResult {
  found: { emails: string[]; phones: string[]; github: string[]; linkedin: string[]; schools: string[] };
  inconsistencies: { field: string; label: string; detail: string }[];
  consistent: string[];
  links: { categorie: string; label: string; url: string }[];
}

// CV chargé par le recruteur : l'agent le lit en mémoire et le compare à ce que le candidat a déclaré.
export async function analyzeCv(session: Session, pdf: Buffer): Promise<{ status: number; body: CvResult | { detail?: string } }> {
  const { consentAt, ...declared } = session.identity ?? { consentAt: 0 };
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), 'cv.pdf');
  form.append('declared', JSON.stringify(declared));
  form.append('country', session.identity?.country ?? 'FR');
  const res = await fetch(`${AGENT_URL}/cv/analyze`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as CvResult | { detail?: string } };
}
