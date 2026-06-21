/* Ported from apps/server/pronote-api/src/cipher.js — types are loose at runtime. */
// @ts-nocheck
import forge from 'node-forge';
import pako from 'pako';

const RSA_1024_MODULO = 'B99B77A3D72D3A29B4271FC7B7300E2F791EB8948174BE7B8024667E915446D4EEA0C2424B8D1EBF7E2DDFF94691C6E994E839225C627D140A8F1146D1B0B5F18A09BBD3D8F421CA1E3E4796B301EEBCCF80D81A32A1580121B8294433C38377083C5517D5921E8A078CDC019B15775292EFDA2C30251B1CCABE812386C893E5';
const RSA_1024_EXPONENT = '65537';

export function initCipher(session) {
  session.aesIV = generateIV();
  session.publicKey = forge.pki.rsa.setPublicKey(
    new forge.jsbn.BigInteger(RSA_1024_MODULO, 16),
    new forge.jsbn.BigInteger(RSA_1024_EXPONENT, 10),
  );
}

export function cipher(session, data, { key, compress, disableIV } = {}) {
  let bytes = forge.util.encodeUtf8(String(data));
  if (compress && !session.disableCompress) {
    bytes = deflate(bytes);
  }

  const c = createCipher(session, key, false, disableIV);
  c.update(new forge.util.ByteBuffer(bytes));
  return c.finish() ? c.output.toHex() : '';
}

export function decipher(session, data, { compress, scrambled, key, asBytes } = {}) {
  const c = createCipher(session, key, true);
  c.update(new forge.util.ByteBuffer(forge.util.hexToBytes(data)));

  let result = c.finish() ? c.output.bytes() : '';
  if (compress && !session.disableCompress) {
    result = inflate(result);
  }

  result = forge.util.decodeUtf8(result);

  if (scrambled) {
    return result.split('').filter((_, i) => i % 2 === 0).join('');
  }

  if (asBytes) {
    const buffer = new forge.util.ByteBuffer();
    for (const part of result.split(',')) {
      buffer.putInt(parseInt(part, 10), 8);
    }
    return buffer;
  }

  return result;
}

function createCipher(session, key, decrypt, disableIV = false) {
  const resolvedKey = key ?? session.aesKey ?? new forge.util.ByteBuffer();
  const c = forge.cipher[decrypt ? 'createDecipher' : 'createCipher']('AES-CBC', md5(resolvedKey));
  const iv = disableIV
    ? forge.util.createBuffer('\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00')
    : md5(session.aesIV);
  c.start({ iv });
  return c;
}

function md5(buffer) {
  return forge.md.md5.create().update(buffer.bytes()).digest();
}

function deflate(data) {
  return pako.deflateRaw(new forge.util.ByteBuffer(data).toHex(), { level: 6, to: 'string' });
}

function inflate(data) {
  return pako.inflateRaw(data, { to: 'string' });
}

function generateIV() {
  return new forge.util.ByteBuffer(forge.random.getBytes(16));
}

export function getUUID(session, iv) {
  if (session.httpMode || session.disableAES) {
    return forge.util.encode64(iv.bytes());
  }
  return forge.util.encode64(session.publicKey.encrypt(iv.bytes()));
}

export function getLoginKey(username, password, scramble, fromCas) {
  const hash = forge.md.sha256.create()
    .update(scramble || '')
    .update(forge.util.encodeUtf8(password))
    .digest();
  const key = (fromCas ? '' : username.toLowerCase()) + hash.toHex().toUpperCase();
  return new forge.util.ByteBuffer(forge.util.encodeUtf8(key));
}

export function bufferToBase64(buffer) {
  return buffer ? forge.util.encode64(buffer.bytes()) : null;
}

export function base64ToBuffer(value) {
  return new forge.util.ByteBuffer(forge.util.decode64(value));
}
