import type {
  ApiErrorBody,
  PronoteLoginRequest,
  PronoteLoginResponse,
  PronoteSessionInfo,
} from '../../../shared/index';

export async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = await parseJson<ApiErrorBody>(response).catch(() => ({ error: 'Erreur réseau.' }));
    throw new Error(body.error || 'Erreur réseau.');
  }

  return parseJson<T>(response);
}

export function loginToPronote(body: PronoteLoginRequest): Promise<PronoteLoginResponse> {
  return request<PronoteLoginResponse>('/api/pronote/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchPronoteSession(token: string): Promise<PronoteSessionInfo> {
  return request<PronoteSessionInfo>('/api/pronote/session', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function logoutFromPronote(token: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/api/pronote/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
