import { pronoteRequest } from '../request.js';
import type { PronoteSession, PronoteUser } from '../session.js';

export async function getUser(session: PronoteSession): Promise<PronoteUser> {
  const { donnees } = await pronoteRequest(session, 'ParametresUtilisateur');
  const user = donnees as { ressource?: { N?: string | number; L?: string } };
  const res = user.ressource ?? {};

  return {
    id: res.N ?? '',
    name: res.L,
  };
}
