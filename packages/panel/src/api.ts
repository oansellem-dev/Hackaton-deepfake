import type {
  ChallengeResult,
  Decision,
  FaceIdPlan,
  FaceIdStepResult,
  FaceIdSubmission,
  IdentityPayload,
  LiveSample,
  PrecheckPayload,
  SessionView,
  SignalStatus,
} from '@kyc/shared';

export const DEFAULT_API_BASE = 'http://localhost:8787';

// `recruiterKey` : jeton donné à la création de l'entretien, exigé pour lire les signaux, décider et enregistrer les défis.
// Les pages du candidat n'en ont pas besoin.
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

  return {
    createSession: (candidateLabel: string) =>
      call<SessionView & { recruiterKey: string }>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ candidateLabel }),
      }),
    getSession: (id: string) => call<SessionView>(`/api/sessions/${id}`),
    sendPrecheck: (id: string, payload: PrecheckPayload) =>
      call<{ signals: { label: string; status: SignalStatus; detail: string }[] }>(
        `/api/sessions/${id}/precheck`,
        { method: 'POST', body: JSON.stringify(payload) },
      ),
    sendChallenge: (
      id: string,
      challengeId: string,
      result: ChallengeResult,
      durationMs: number,
      metrics?: Record<string, number>,
    ) =>
      call<SessionView>(`/api/sessions/${id}/challenges`, {
        method: 'POST',
        body: JSON.stringify({ challengeId, result, durationMs, metrics }),
      }),
    // Pré-vérification : nom, prénom et consentement explicite, puis parcours Face ID.
    sendIdentity: (id: string, payload: IdentityPayload) =>
      call<{ checked: boolean }>(`/api/sessions/${id}/identity`, { method: 'POST', body: JSON.stringify(payload) }),
    // Refusé (409 « camera-virtuelle ») si la caméra utilisée est une caméra virtuelle connue.
    startFaceId: (id: string, cameraLabel: string) =>
      call<FaceIdPlan>(`/api/sessions/${id}/faceid/start`, { method: 'POST', body: JSON.stringify({ cameraLabel }) }),
    submitFaceId: (id: string, payload: FaceIdSubmission) =>
      call<{ profileStored: boolean; steps: { step: FaceIdStepResult['step']; result: FaceIdStepResult['result'] }[] }>(
        `/api/sessions/${id}/faceid/submit`,
        { method: 'POST', body: JSON.stringify(payload) },
      ),
    // Pendant l'entretien : mesures du visage affiché, calculées dans le navigateur (jamais d'image envoyée).
    sendLiveSample: (id: string, sample: LiveSample) =>
      call<{ verdict: string }>(`/api/sessions/${id}/live-sample`, { method: 'POST', body: JSON.stringify(sample) }),
    // Page candidat de la visio de secours : nom de la caméra réellement utilisée.
    reportLiveCamera: (id: string, cameraLabel: string) =>
      call<{ checked: boolean }>(`/api/sessions/${id}/live-camera`, { method: 'POST', body: JSON.stringify({ cameraLabel }) }),
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
    sendDecision: (id: string, value: Decision, note?: string) =>
      call<SessionView>(`/api/sessions/${id}/decision`, { method: 'POST', body: JSON.stringify({ value, note }) }),
  };
}

export type Api = ReturnType<typeof createApi>;
