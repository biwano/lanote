import { bufferToBase64, base64ToBuffer } from './cipher.js';
import type { PronoteSessionParams } from './auth/params.js';
import { parsePronoteDate } from './data/pronote-types.js';
import { parsePeriods } from './data/periods.js';
import { createSession, getAccountType, type PronoteSession } from './session.js';

const STORE_VERSION = 1;

function serializeParams(params: PronoteSessionParams): Record<string, unknown> {
  return {
    title: params.title,
    firstDay: params.firstDay.toISOString(),
    periods: params.periods.map((period) => ({
      ...period,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    })),
  };
}

function restoreParams(data: Record<string, unknown>): PronoteSessionParams | undefined {
  if (data.firstDay && data.periods) {
    const periods = Array.isArray(data.periods)
      ? data.periods.map((entry) => {
          const period = entry as Record<string, string>;
          return {
            id: period.id,
            name: period.name,
            kind: period.kind,
            from: new Date(period.from),
            to: new Date(period.to),
          };
        })
      : [];

    return {
      title: String(data.title ?? ''),
      firstDay: new Date(String(data.firstDay)),
      periods,
    } as PronoteSessionParams;
  }

  // Snapshots from Step 1 stored `{ title, raw }` — rebuild structured params.
  const raw = data.raw as {
    Nom?: string;
    General?: {
      PremiereDate?: { V?: string };
      ListePeriodes?: unknown[];
    };
  } | undefined;

  if (!raw?.General) return undefined;

  const firstDayValue = raw.General.PremiereDate?.V;
  return {
    title: raw.Nom ?? String(data.title ?? ''),
    firstDay: firstDayValue ? parsePronoteDate(firstDayValue) : new Date(),
    periods: parsePeriods(raw.General.ListePeriodes),
  };
}

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
    params: session.params ? serializeParams(session.params) : undefined,
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
  if (data.params && typeof data.params === 'object') {
    session.params = restoreParams(data.params as Record<string, unknown>);
  }
  session.user = data.user as PronoteSession['user'];

  return session;
}
