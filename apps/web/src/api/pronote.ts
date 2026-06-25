import type {
  CahierTexteResponse,
  PronoteEvaluationsResponse,
} from '../../../shared/index';
import { request } from './client';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function fetchEvaluations(
  token: string,
  params?: { from?: string; to?: string },
): Promise<PronoteEvaluationsResponse> {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const suffix = query.size ? `?${query}` : '';
  return request<PronoteEvaluationsResponse>(`/api/pronote/evaluations${suffix}`, {
    headers: authHeaders(token),
  });
}

export function fetchCahierTexte(
  token: string,
  params?: { from?: string; to?: string },
): Promise<CahierTexteResponse> {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const suffix = query.size ? `?${query}` : '';
  return request<CahierTexteResponse>(`/api/pronote/cahier-texte${suffix}`, {
    headers: authHeaders(token),
  });
}
