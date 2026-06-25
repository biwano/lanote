import { initCipher } from './cipher.js';
import { errors } from './errors.js';
import { pronoteRequest } from './request.js';

export interface AccountType {
  name: string;
  value: string;
  id: number;
}

const ACCOUNTS: AccountType[] = [
  { name: 'student', value: 'eleve', id: 3 },
  { name: 'parent', value: 'parent', id: 2 },
];

export function getAccountType(type: string): AccountType {
  const account = ACCOUNTS.find(a => a.name === type);
  if (!account) throw errors.UNKNOWN_ACCOUNT.drop(type);
  return account;
}

export interface PronoteUser {
  id: string | number;
  name?: string;
  /** Tab IDs hidden for this account (listeOngletsInvisibles). */
  hiddenTabs?: number[];
  [key: string]: unknown;
}

export interface PronoteSession {
  id: number;
  server: string;
  type: AccountType;
  appKey?: number;
  httpMode?: boolean;
  disableAES: boolean;
  disableCompress: boolean;
  aesKey?: unknown;
  aesIV?: unknown;
  publicKey?: unknown;
  params?: import('./auth/params.js').PronoteSessionParams;
  user?: PronoteUser;
  request: number;
  logout: () => Promise<void>;
}

export function createSession(options: {
  serverURL: string;
  sessionID: number;
  type: AccountType;
  disableAES?: boolean;
  disableCompress?: boolean;
}): PronoteSession {
  const session: PronoteSession = {
    id: options.sessionID,
    server: options.serverURL,
    type: options.type,
    disableAES: options.disableAES ?? false,
    disableCompress: options.disableCompress ?? false,
    request: -1,
    logout: async () => {
      await pronoteRequest(session, 'SaisieDeconnexion');
    },
  };

  initCipher(session);
  return session;
}

export function normalizeServer(url: string): string {
  if (url.endsWith('.html')) {
    return url.substring(0, url.lastIndexOf('/') + 1);
  }
  return url.endsWith('/') ? url : `${url}/`;
}

export function applyStartToSession(session: PronoteSession, start: import('./start.js').StartPayload): void {
  if (start.a !== undefined) {
    session.appKey = parseInt(String(start.a), 10);
    session.httpMode = start.d === true || start.d === 'true' || start.http === true || start.http === 'true';
    session.disableAES = !start.CrA;
    session.disableCompress = !start.CoA;
    return;
  }

  session.disableAES = !!start.sCrA;
  session.disableCompress = !!start.sCoA;
}
