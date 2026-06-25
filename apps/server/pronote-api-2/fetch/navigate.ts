import { toPronote } from '../data/pronote-objects.js';
import { pronoteRequest } from '../request.js';
import type { PronoteSession, PronoteUser } from '../session.js';

/**
 * Opens a PRONOTE page tab via appelfonction (same as legacy navigate).
 * `_Signature_` binds the request to the signed-in member and tab id.
 */
export async function navigate(
  session: PronoteSession,
  user: PronoteUser,
  page: string,
  tabId: number,
  accounts: string[],
  data?: Record<string, unknown>,
): Promise<unknown | null> {
  if (user.hiddenTabs?.includes(tabId) || !accounts.includes(session.type.name)) {
    return null;
  }

  const content: Record<string, unknown> = {
    _Signature_: {
      membre: toPronote(user),
      onglet: tabId,
    },
  };

  if (data) {
    content.donnees = data;
  }

  const { donnees } = await pronoteRequest(session, page, content);
  return donnees;
}
