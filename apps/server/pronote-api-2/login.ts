import { getParams } from './auth/params.js';
import { authenticateSession } from './auth/pronote-auth.js';
import { getUser } from './auth/user.js';
import { fail, step } from './debug.js';
import { errors } from './errors.js';
import { fetchStartFromTgc } from './login-tgc.js';
import {
  applyStartToSession,
  createSession,
  getAccountType,
  normalizeServer,
  type PronoteSession,
} from './session.js';
import type { StartPayload } from './start.js';

async function completeSessionFromStart(
  server: string,
  start: StartPayload,
  account: ReturnType<typeof getAccountType>,
): Promise<PronoteSession> {
  const session = createSession({
    serverURL: server,
    sessionID: start.h,
    type: account,
  });

  applyStartToSession(session, start);

  session.params = (await getParams(session)) ?? undefined;
  if (!session.params) throw errors.WRONG_CREDENTIALS.drop();

  if (start.e !== undefined && start.f !== undefined) {
    await authenticateSession(session, start.e, start.f, true);
  } else {
    fail('login.fromStart', errors.INVALID_START.drop(), { reason: 'missing_auth_material' });
    throw errors.INVALID_START.drop();
  }

  session.user = await getUser(session);
  step('login.complete', { name: session.user?.name, userId: session.user?.id });
  return session;
}

export async function loginStudentFromTgc(url: string, casCookies: string): Promise<PronoteSession> {
  const server = normalizeServer(url);
  const account = getAccountType('student');

  step('login.fromTgc.begin', { server, account: account.name });

  let start: StartPayload;
  try {
    start = await fetchStartFromTgc(server, casCookies);
  } catch (error) {
    fail('login.fromTgc', error);
    throw error;
  }

  return completeSessionFromStart(server, start, account);
}
