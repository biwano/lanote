import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const {
  loginStudent,
  serializeSession,
  restoreSession,
  errors,
} = require(path.join(serverRoot, 'pronote-api/index.js')) as typeof import('../types/pronote-api.js');

export { loginStudent, serializeSession, restoreSession, errors };

export type PronoteSession = Awaited<ReturnType<typeof loginStudent>>;

export function getDisplayName(session: PronoteSession): string {
  return session.user?.name ?? 'Élève';
}

export function mapPronoteError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Une erreur est survenue lors de la connexion à PRONOTE.';
  }

  const code = 'code' in error ? (error as { code?: number }).code : undefined;

  switch (code) {
    case errors.WRONG_CREDENTIALS.code:
      return 'Identifiants incorrects. Vérifie ton nom d\'utilisateur et ton mot de passe.';
    case errors.UNKNOWN_CAS.code:
      return 'ENT ou CAS inconnu. Vérifie la configuration de connexion.';
    case errors.BANNED.code:
      return 'Connexion temporairement bloquée après trop de tentatives.';
    case errors.SESSION_EXPIRED.code:
      return 'La session PRONOTE a expiré. Reconnecte-toi.';
    case errors.RATE_LIMITED.code:
      return 'Trop de requêtes. Réessaie dans quelques minutes.';
    case errors.CLOSED.code:
      return 'PRONOTE est indisponible pour le moment. Réessaie plus tard.';
    default:
      return 'Impossible de se connecter à PRONOTE. Vérifie l\'URL et tes identifiants.';
  }
}
