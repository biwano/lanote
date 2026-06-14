export interface PronoteCredentials {
  clientId: string;
  url: string;
  username: string;
  password: string;
  cas?: string;
}

export interface PronoteLoginRequest {
  clientId: string;
  url: string;
  username: string;
  password: string;
  cas?: string;
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
