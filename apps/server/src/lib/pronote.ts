import {
  loginStudentFromTgc,
  serializeSession,
  restoreSession,
  errors,
  type PronoteSession,
} from '../../pronote-api-2/index.js';

export { loginStudentFromTgc, serializeSession, restoreSession, errors };
export type { PronoteSession };

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
      return 'Identifiants incorrects ou session expirée.';
    case errors.INVALID_START.code:
      return 'Impossible de lire la session PRONOTE. Réessaie avec des cookies CAS récents.';
    case errors.INVALID_TGC.code:
      return 'Cookies CAS invalides ou expirés. Reconnecte-toi à PRONOTE dans ton navigateur et recopie les cookies.';
    case errors.UNKNOWN_CAS.code:
      return 'ENT ou CAS inconnu.';
    case errors.BANNED.code:
      return 'Connexion temporairement bloquée après trop de tentatives.';
    case errors.SESSION_EXPIRED.code:
      return 'La session PRONOTE a expiré. Reconnecte-toi.';
    case errors.RATE_LIMITED.code:
      return 'Trop de requêtes. Réessaie dans quelques minutes.';
    case errors.CLOSED.code:
      return 'PRONOTE est indisponible pour le moment. Réessaie plus tard.';
    default:
      return 'Impossible de se connecter à PRONOTE. Vérifie l\'URL et les cookies CAS.';
  }
}
