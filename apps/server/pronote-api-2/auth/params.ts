import { getUUID } from '../cipher.js';
import { pronoteRequest } from '../request.js';
import type { PronoteSession } from '../session.js';

export async function getParams(session: PronoteSession): Promise<Record<string, unknown> | null> {
  const { donnees } = await pronoteRequest(session, 'FonctionParametres', {
    donnees: { Uuid: getUUID(session, session.aesIV!) },
  });

  const params = donnees as { General?: unknown; Nom?: string };
  if (!params?.General) return null;

  return { title: params.Nom, raw: params };
}
