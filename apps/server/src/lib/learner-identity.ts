import { createHash } from 'node:crypto';
import { normalizeServer } from '../../pronote-api-2/session.js';
import type { PronoteSession } from './pronote.js';

export class MissingPronoteUserNameError extends Error {
  constructor() {
    super('PRONOTE_USER_NAME_MISSING');
    this.name = 'MissingPronoteUserNameError';
  }
}

export interface PronoteLearnerIdentity {
  server: string;
  userName: string;
  accountHash: string;
}

export function hashPronoteAccount(server: string, userName: string): string {
  const normalizedServer = normalizeServer(server).toLowerCase();
  return createHash('sha256')
    .update(`${normalizedServer}:${userName}`)
    .digest('hex');
}

/** Learner key: normalized PRONOTE instance URL + student display name (`ressource.L`). */
export function getPronoteLearnerIdentity(session: PronoteSession): PronoteLearnerIdentity {
  if (!session.user?.name) {
    throw new MissingPronoteUserNameError();
  }

  const server = normalizeServer(session.server);
  const userName = session.user.name?.trim() ?? '';


  return {
    server,
    userName,
    accountHash: hashPronoteAccount(server, userName),
  };
}
