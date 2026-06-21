const { cipher, decipher } = require('./cipher');
const errors = require('./errors');
const debug = require('./debug');
const http = require('./http');

function usesNewProtocol(session) {
    return session.appKey !== undefined && session.appKey !== null;
}

function unwrapContent(content) {
    if (content.donnees !== undefined) {
        return content.donnees;
    }

    return Object.keys(content).length ? content : null;
}

function throwIfErreur(result, name) {
    if (!result.Erreur) {
        return;
    }

    const { Titre, Message } = result.Erreur;
    debug.fail('pronote.request', errors.PRONOTE.drop({ title: Titre, message: Message }), { name, Titre, Message });

    if (Titre.startsWith('La page a expiré !')) {
        throw errors.SESSION_EXPIRED.drop();
    }
    if (Message.startsWith('Vous avez dépassé le nombre')) {
        throw errors.RATE_LIMITED.drop();
    }

    throw errors.PRONOTE.drop({ title: Titre, message: Message });
}

function parseNewProtocolResponse(session, result) {
    if (session.disableAES) {
        const payload = result.dataSec;
        const data = payload && payload.data !== undefined ? payload.data : payload;
        return { donnees: data };
    }

    const parsed = JSON.parse(decipher(session, result.dataSec, {
        compress: !session.disableCompress,
    }));

    return { donnees: parsed.data !== undefined ? parsed.data : parsed };
}

function parseLegacyResponse(session, result) {
    if (!session.disableAES) {
        return JSON.parse(decipher(session, result.donneesSec, { compress: true }));
    }

    return result.donneesSec;
}

async function request(session, name, content = {})
{
    session.request += 2;

    const disableIV = session.request === 1;
    const order = cipher(session, session.request, { disableIV });

    if (usesNewProtocol(session)) {
        const inner = unwrapContent(content);
        let dataSec = inner ? { data: inner } : {};

        if (!session.disableAES) {
            dataSec = cipher(session, JSON.stringify({ data: inner }), {
                compress: !session.disableCompress,
                disableIV,
            });
        }

        const result = await http({
            url: `${session.server}appelfonction/${session.appKey}/${session.id}/${order}`,
            method: 'POST',
            body: {
                session: session.id,
                no: order,
                id: name,
                dataSec,
            },
        });

        throwIfErreur(result, name);
        return parseNewProtocolResponse(session, result);
    }

    let data = content;
    if (!session.disableAES) {
        data = cipher(session, JSON.stringify(content), { compress: true, disableIV });
    }

    const result = await http({
        url: `${session.server}appelfonction/${session.type.id}/${session.id}/${order}`,
        method: 'POST',
        body: {
            nom: name,
            numeroOrdre: order,
            session: session.id,
            donneesSec: data,
        },
    });

    throwIfErreur(result, name);
    return parseLegacyResponse(session, result);
}

module.exports = request;
