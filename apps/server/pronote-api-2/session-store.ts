import { bufferToBase64, base64ToBuffer } from './cipher.js';
import { createSession, getAccountType, type PronoteSession } from './session.js';

const STORE_VERSION = 1;

export function serializeSession(session: PronoteSession): Record<string, unknown> {
  return {
    version: STORE_VERSION,
    server: session.server,
    id: session.id,
    type: session.type.name,
    request: session.request,
    appKey: session.appKey,
    httpMode: session.httpMode,
    disableAES: session.disableAES,
    disableCompress: session.disableCompress,
    aesKey: bufferToBase64(session.aesKey),
    aesIV: bufferToBase64(session.aesIV),
    params: session.params,
    user: session.user,
  };
}

export function restoreSession(data: Record<string, unknown>): PronoteSession {
  if (!data || data.version !== STORE_VERSION) {
    throw new Error('Unsupported or missing session snapshot');
  }

  const session = createSession({
    serverURL: String(data.server),
    sessionID: Number(data.id),
    type: getAccountType(String(data.type)),
    disableAES: Boolean(data.disableAES),
    disableCompress: Boolean(data.disableCompress),
  });

  session.request = Number(data.request ?? -1);
  if (data.appKey !== undefined) session.appKey = Number(data.appKey);
  if (data.httpMode !== undefined) session.httpMode = Boolean(data.httpMode);
  if (typeof data.aesKey === 'string') session.aesKey = base64ToBuffer(data.aesKey);
  if (typeof data.aesIV === 'string') session.aesIV = base64ToBuffer(data.aesIV);
  session.params = data.params as Record<string, unknown> | undefined;
  session.user = data.user as PronoteSession['user'];

  return session;
}
