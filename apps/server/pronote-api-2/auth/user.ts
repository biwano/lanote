import { pronoteRequest } from '../request.js';
import type { PronoteSession, PronoteUser } from '../session.js';

export async function getUser(session: PronoteSession): Promise<PronoteUser> {
  const { donnees } = await pronoteRequest(session, 'ParametresUtilisateur');
  const user = donnees as {
    ressource?: { N?: string | number; L?: string };
    listeOngletsInvisibles?: number[];
  };
  const res = user.ressource ?? {};

  return {
    id: res.N != null && String(res.N).trim() !== '' ? String(res.N).trim() : '',
    name: typeof res.L === 'string' ? res.L : undefined,
    hiddenTabs: user.listeOngletsInvisibles ?? [],
  };
}
