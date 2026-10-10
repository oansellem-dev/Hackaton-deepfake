import type { ChallengeResult, Decision, PrecheckPayload, SessionView, SignalStatus } from '@kyc/shared';

export const DEFAULT_API_BASE = 'http://localhost:8787';

export function createApi(base: string = DEFAULT_API_BASE) {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  return {
    createSession: (candidateLabel: string) =>
      call<SessionView>('/api/sessions', { method: 'POST', body: JSON.stringify({ candidateLabel }) }),
    getSession: (id: string) => call<SessionView>(`/api/sessions/${id}`),
    sendPrecheck: (id: string, payload: PrecheckPayload) =>
      call<{ signals: { label: string; status: SignalStatus; detail: string }[] }>(
        `/api/sessions/${id}/precheck`,
        { method: 'POST', body: JSON.stringify(payload) },
      ),
    sendChallenge: (id: string, challengeId: string, result: ChallengeResult, durationMs: number) =>
      call<SessionView>(`/api/sessions/${id}/challenges`, {
        method: 'POST',
        body: JSON.stringify({ challengeId, result, durationMs }),
      }),
    sendDecision: (id: string, value: Decision, note?: string) =>
      call<SessionView>(`/api/sessions/${id}/decision`, { method: 'POST', body: JSON.stringify({ value, note }) }),
  };
}

export type Api = ReturnType<typeof createApi>;
