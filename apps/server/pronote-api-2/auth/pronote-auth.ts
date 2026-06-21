import { cipher, getLoginKey, decipher } from '../cipher.js';
import { fail } from '../debug.js';
import { errors } from '../errors.js';
import { pronoteRequest } from '../request.js';
import type { PronoteSession } from '../session.js';

export async function getId(session: PronoteSession, username: string, fromCas: boolean) {
  const { donnees } = await pronoteRequest(session, 'Identification', {
    donnees: {
      genreConnexion: 0,
      genreEspace: session.appKey ?? session.type.id,
      identifiant: username,
      pourENT: fromCas,
      enConnexionAuto: false,
      demandeConnexionAuto: false,
      demandeConnexionAppliMobile: false,
      demandeConnexionAppliMobileJeton: false,
      uuidAppliMobile: '',
      loginTokenSAV: '',
    },
  });

  const id = donnees as { alea: string; challenge: string };
  return { scramble: id.alea, challenge: id.challenge };
}

export async function getAuthKey(session: PronoteSession, challenge: string, key: unknown) {
  const { donnees } = await pronoteRequest(session, 'Authentification', {
    donnees: {
      connexion: 0,
      challenge: cipher(session, challenge, { key }),
      espace: session.appKey ?? session.type.id,
    },
  });

  return (donnees as { cle: string }).cle;
}

export async function authenticateSession(
  session: PronoteSession,
  username: string,
  password: string,
  fromCas: boolean,
): Promise<void> {
  const id = await getId(session, username, fromCas);
  const key = getLoginKey(username, password, id.scramble, fromCas);

  let challenge: string;
  try {
    challenge = decipher(session, id.challenge, { scrambled: true, key }) as string;
  } catch {
    fail('login.auth', errors.WRONG_CREDENTIALS.drop(), { reason: 'challenge_decipher_failed' });
    throw errors.WRONG_CREDENTIALS.drop();
  }

  const userKey = await getAuthKey(session, challenge, key);
  if (!userKey) {
    fail('login.auth', errors.WRONG_CREDENTIALS.drop(), { reason: 'empty_auth_key' });
    throw errors.WRONG_CREDENTIALS.drop();
  }

  session.aesKey = decipher(session, userKey, { key, asBytes: true }) as PronoteSession['aesKey'];
}
