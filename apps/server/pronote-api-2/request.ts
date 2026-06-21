import { cipher, decipher } from './cipher.js';
import { fail } from './debug.js';
import { errors } from './errors.js';
import { fetchJson } from './fetch-client.js';
import type { PronoteSession } from './session.js';

interface PronoteErrorResponse {
  Erreur?: { Titre?: string; Message?: string };
  dataSec?: string | { data?: unknown };
  donneesSec?: string | Record<string, unknown>;
}

function usesNewProtocol(session: PronoteSession): boolean {
  return session.appKey !== undefined && session.appKey !== null;
}

function throwIfErreur(result: PronoteErrorResponse, name: string): void {
  if (!result.Erreur) return;

  const { Titre = '', Message = '' } = result.Erreur;
  fail('pronote.request', errors.PRONOTE.drop({ title: Titre, message: Message }), { name, Titre, Message });

  if (Titre.startsWith('La page a expiré !')) throw errors.SESSION_EXPIRED.drop();
  if (Message.startsWith('Vous avez dépassé le nombre')) throw errors.RATE_LIMITED.drop();
  throw errors.PRONOTE.drop({ title: Titre, message: Message });
}

function parseNewProtocolResponse(session: PronoteSession, result: PronoteErrorResponse): { donnees: unknown } {
  if (session.disableAES) {
    const payload = result.dataSec;
    const data = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    return { donnees: data };
  }

  const parsed = JSON.parse(decipher(session, String(result.dataSec), {
    compress: !session.disableCompress,
  }) as string);

  return { donnees: typeof parsed === 'object' && parsed && 'data' in parsed ? parsed.data : parsed };
}

function parseLegacyResponse(session: PronoteSession, result: PronoteErrorResponse): { donnees: unknown } {
  if (!session.disableAES) {
    return JSON.parse(decipher(session, String(result.donneesSec), { compress: true }) as string);
  }
  return { donnees: result.donneesSec };
}

export async function pronoteRequest(
  session: PronoteSession,
  name: string,
  content: Record<string, unknown> = {},
): Promise<{ donnees: unknown }> {
  session.request += 2;

  const disableIV = session.request === 1;
  const order = cipher(session, session.request, { disableIV });

  if (usesNewProtocol(session)) {
    const inner = content.donnees !== undefined ? content.donnees : content;
    let dataSec: string | { data: unknown } = inner !== undefined && inner !== null ? { data: inner } : { data: null };

    if (!session.disableAES) {
      dataSec = cipher(session, JSON.stringify({ data: inner }), {
        compress: !session.disableCompress,
        disableIV,
      });
    }

    const result = await fetchJson<PronoteErrorResponse>(
      `${session.server}appelfonction/${session.appKey}/${session.id}/${order}`,
      { session: session.id, no: order, id: name, dataSec },
    );

    throwIfErreur(result, name);
    return parseNewProtocolResponse(session, result);
  }

  let data: unknown = content;
  if (!session.disableAES) {
    data = cipher(session, JSON.stringify(content), { compress: true, disableIV });
  }

  const result = await fetchJson<PronoteErrorResponse>(
    `${session.server}appelfonction/${session.type.id}/${session.id}/${order}`,
    { nom: name, numeroOrdre: order, session: session.id, donneesSec: data },
  );

  throwIfErreur(result, name);
  return parseLegacyResponse(session, result);
}
