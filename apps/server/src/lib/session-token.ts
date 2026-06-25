import { timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function getSecret(): Uint8Array {
  const secret = process.env.PRONOTE_SESSION_SECRET;
  if (!secret) {
    throw new Error('PRONOTE_SESSION_SECRET is required');
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(sessionId: string): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, getSecret());
  const sessionId = payload.sid;

  if (typeof sessionId !== 'string' || !sessionId) {
    throw new Error('Invalid session token');
  }

  return sessionId;
}

export function sessionExpiresAt(): string {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
