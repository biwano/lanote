import { fail, htmlHint, step } from './debug.js';
import { errors } from './errors.js';

export interface StartPayload {
  h: number;
  a?: number;
  d?: boolean | string;
  e?: string;
  f?: string;
  g?: number;
  CrA?: boolean;
  CoA?: boolean;
  sCrA?: boolean;
  sCoA?: boolean;
  http?: boolean | string;
}

function startObjectToJson(start: string): string {
  return start
    .replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/gu, '"$2": ')
    .replace(/'/gu, '"');
}

function parseStartObject(start: string): StartPayload {
  try {
    return JSON.parse(startObjectToJson(start.trim())) as StartPayload;
  } catch {
    fail('start.parse', errors.INVALID_START.drop());
    throw errors.INVALID_START.drop();
  }
}

function findStartObjectInHtml(html: string): string | null {
  const normalized = html.replace(/\s+/g, ' ');
  const match = normalized.match(/Start\s*\(\s*(\{[^}]+\})/i);
  if (match) return match[1];

  const compact = html.replace(/ /g, '').replace(/\n/g, '');
  const from = 'Start(';
  const to = ')}catch';
  if (compact.includes(from) && compact.includes(to)) {
    return compact.substring(compact.indexOf(from) + from.length, compact.indexOf(to));
  }

  return null;
}

export function extractStart(html: string): StartPayload {
  step('start.extract', htmlHint(html));

  if (html.includes('Votre adresse IP est provisoirement suspendue')) {
    throw errors.BANNED.drop();
  }
  if (html.includes("Le site n'est pas disponible")) {
    throw errors.CLOSED.drop();
  }

  const startObject = findStartObjectInHtml(html);
  if (!startObject) {
    if (html.includes('login') && html.includes('cas.')) {
      fail('start.extract', errors.INVALID_TGC.drop(), { reason: 'landed_on_cas_login', ...htmlHint(html) });
      throw errors.INVALID_TGC.drop();
    }
    fail('start.extract', errors.INVALID_START.drop(), { reason: 'start_call_missing', ...htmlHint(html) });
    throw errors.INVALID_START.drop();
  }

  const parsed = parseStartObject(startObject);
  step('start.extract.ok', { sessionId: parsed.h, appKey: parsed.a, fromCas: parsed.e !== undefined });
  return parsed;
}
