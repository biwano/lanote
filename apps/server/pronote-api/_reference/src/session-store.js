const forge = require('node-forge');

const PronoteSession = require('./session');

const STORE_VERSION = 1;

function bufferToBase64(buffer) {
    if (!buffer) {
        return null;
    }
    return forge.util.encode64(buffer.bytes());
}

function base64ToBuffer(value) {
    return new forge.util.ByteBuffer(forge.util.decode64(value));
}

function serializeSession(session) {
    return {
        version: STORE_VERSION,
        server: session.server,
        id: session.id,
        type: session.type.name,
        request: session.request,
        appKey: session.appKey,
        httpMode: session.httpMode,
        disableAES: session.disableAES,
        disableCompress: session.disableCompress,
        aesKey: bufferToBase64(session.aesKey),
        aesIV: bufferToBase64(session.aesIV),
        params: session.params,
        user: session.user,
    };
}

function restoreSession(data) {
    if (!data || data.version !== STORE_VERSION) {
        throw new Error('Unsupported or missing session snapshot');
    }

    const session = new PronoteSession({
        serverURL: data.server,
        sessionID: data.id,
        type: data.type,
        disableAES: data.disableAES,
        disableCompress: data.disableCompress,
    });

    session.request = data.request;
    if (data.appKey !== undefined) {
        session.appKey = data.appKey;
    }
    if (data.httpMode !== undefined) {
        session.httpMode = data.httpMode;
    }
    if (data.aesKey) {
        session.aesKey = base64ToBuffer(data.aesKey);
    }
    if (data.aesIV) {
        session.aesIV = base64ToBuffer(data.aesIV);
    }
    session.params = data.params;
    session.user = data.user;

    return session;
}

module.exports = {
    serializeSession,
    restoreSession,
};
