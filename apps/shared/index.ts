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

export interface ApiErrorBody {
  error: string;
}

export const PRONOTE_CREDENTIALS_KEY = 'lanote.pronote.credentials';
export const PRONOTE_SESSION_KEY = 'lanote.pronote.session';
