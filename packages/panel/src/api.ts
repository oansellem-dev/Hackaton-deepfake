import type {
  CandidateLinkInfo,
  ChallengeResult,
  Decision,
  FaceIdPlan,
  FaceIdStepResult,
  FaceIdSubmission,
  FlashSubmission,
  IdentityPayload,
  LiveSample,
  PrecheckPayload,
  Schedule,
  SessionView,
  SignalStatus,
} from '@kyc/shared';

export const DEFAULT_API_BASE = 'http://localhost:8787';

// `recruiterKey` : jeton donné à la création de l'entretien, exigé pour lire les signaux, décider et enregistrer les défis.
// Les pages du candidat n'en ont pas besoin : elles passent par le jeton de leur lien (/check/<jeton>).
export function createApi(base: string = DEFAULT_API_BASE, recruiterKey?: string) {
  const auth: Record<string, string> = recruiterKey ? { 'X-Recruiter-Key': recruiterKey } : {};

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...auth, ...init?.headers },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  const post = <T>(path: string, body: unknown = {}) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

  return {
    // --- Recruteur ---
    createSession: (candidateLabel: string, controllerName?: string, controllerContact?: string) =>
      post<SessionView & { recruiterKey: string }>('/api/sessions', { candidateLabel, controllerName, controllerContact }),
    getSession: (id: string) => call<SessionView>(`/api/sessions/${id}`),
    sendChallenge: (
      id: string,
      challengeId: string,
      result: ChallengeResult,
      durationMs: number,
      metrics?: Record<string, number>,
    ) => post<SessionView>(`/api/sessions/${id}/challenges`, { challengeId, result, durationMs, metrics }),
    // Pendant l'entretien : mesures du visage affiché, calculées dans le navigateur (jamais d'image envoyée).
    sendLiveSample: (id: string, sample: LiveSample) => post<{ verdict: string }>(`/api/sessions/${id}/live-sample`, sample),
    // Rapport : CV chargé par le recruteur (PDF).
    uploadCv: async (id: string, pdf: Blob): Promise<SessionView> => {
      const res = await fetch(`${base}/api/sessions/${id}/cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', ...auth },
        body: pdf,
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      return res.json() as Promise<SessionView>;
    },
    deleteBiometrics: (id: string) => call<SessionView>(`/api/sessions/${id}/biometrics`, { method: 'DELETE' }),
    // Lien de confirmation d'appareil à coller dans la discussion de la visio.
    requestPresence: (id: string) => post<{ path: string; expiresAt: number }>(`/api/sessions/${id}/presence`),
    sendDecision: (id: string, value: Decision, note?: string) =>
      post<SessionView>(`/api/sessions/${id}/decision`, { value, note }),

    // --- Candidat (jeton du lien de pré-vérification) ---
    getLink: (token: string) => call<CandidateLinkInfo>(`/api/check/${token}`),
    sendIdentity: (token: string, payload: IdentityPayload) =>
      post<{ checked: boolean }>(`/api/check/${token}/identity`, payload),
    sendPrecheck: (token: string, payload: PrecheckPayload) =>
      post<{ signals: { label: string; status: SignalStatus; detail: string }[] }>(`/api/check/${token}/precheck`, payload),
    // Exige le consentement biométrique ; refusé (409 « camera-virtuelle ») avec une caméra virtuelle connue.
    startFaceId: (token: string, cameraLabel: string, biometricConsent: boolean) =>
      post<FaceIdPlan>(`/api/check/${token}/faceid/start`, { cameraLabel, biometricConsent }),
    submitFaceId: (token: string, payload: FaceIdSubmission) =>
      post<{ profileStored: boolean; steps: { step: FaceIdStepResult['step']; result: FaceIdStepResult['result'] }[] }>(
        `/api/check/${token}/faceid/submit`,
        payload,
      ),
    // Test du reflet de l'écran (après le Face ID) : résumé d'un essai analysé dans le navigateur, ou « passer ».
    sendFlash: (token: string, payload: FlashSubmission) =>
      post<{ recorded: boolean; final: boolean }>(`/api/check/${token}/flash`, payload),
    // Créneau : confirmer celui proposé, ou en proposer un autre (le recruteur est prévenu sur son dashboard).
    sendSchedule: (token: string, body: { confirm?: boolean; proposeAt?: number; message?: string }) => post<{ schedule: Schedule }>(`/api/check/${token}/schedule`, body),
    optOut: (token: string) => post<{ optedOut: boolean }>(`/api/check/${token}/optout`),
    withdraw: (token: string) => post<{ withdrawn: boolean }>(`/api/check/${token}/withdraw`),
    deviceOptions: (token: string) => post<Record<string, unknown>>(`/api/check/${token}/device/options`),
    registerDevice: (token: string, response: unknown) => post<{ bound: boolean }>(`/api/check/${token}/device`, response),

    // --- Candidat pendant l'entretien ---
    reportLiveCamera: (id: string, cameraLabel: string) =>
      post<{ checked: boolean }>(`/api/sessions/${id}/live-camera`, { cameraLabel }),
    getPresence: (token: string) => call<{ controller: string | null }>(`/api/presence/${token}`),
    presenceOptions: (token: string) => post<Record<string, unknown>>(`/api/presence/${token}/options`),
    confirmPresence: (token: string, response: unknown) => post<{ verified: boolean }>(`/api/presence/${token}`, response),
  };
}

export type Api = ReturnType<typeof createApi>;
