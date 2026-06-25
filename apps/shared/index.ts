export interface PronoteCredentials {
  clientId: string;
  url: string;
  /** CAS cookies from browser DevTools (TGC required; JSESSIONID and others optional). */
  tgc: string;
}

export interface PronoteLoginRequest {
  clientId: string;
  url: string;
  tgc: string;
}

export interface PronoteLoginResponse {
  sessionToken: string;
  displayName: string;
}

export interface PronoteSessionInfo {
  displayName: string;
}

export interface EvaluationLevel {
  name: string;
  value: { short: string; long: string };
}

export interface EvaluationItem {
  id: string;
  name: string;
  date: string;
  coefficient: number;
  levels: EvaluationLevel[];
}

export interface SubjectEvaluations {
  name: string;
  teacher: string;
  color?: number;
  evaluations: EvaluationItem[];
}

export interface PronoteEvaluationsResponse {
  subjects: SubjectEvaluations[];
}

export interface CahierTexteEntry {
  id: string;
  subject: string;
  teachers: string[];
  from: string;
  to: string;
  description: string;
  category: string;
}

export interface CahierTexteResponse {
  entries: CahierTexteEntry[];
}

export interface ApiErrorBody {
  error: string;
}

export const PRONOTE_CREDENTIALS_KEY = 'lanote.pronote.credentials';
export const PRONOTE_SESSION_KEY = 'lanote.pronote.session';
