const errors = require('./errors');
const cas = require('./cas');
const debug = require('./debug');
const { decipher, getLoginKey } = require('./cipher');
const getAccountType = require('./accounts');
const PronoteSession = require('./session');

const getParams = require('./fetch/pronote/params');
const { getId, getAuthKey } = require('./fetch/pronote/auth');
const getUser = require('./fetch/pronote/user');
const { parseStartPayload } = require('./auth/start');
const { fetchStartFromTgc } = require('./auth/login-tgc');

function loginFor(type)
{
    return (url, username, password, casName = 'none') => login(url, username, password, casName, getAccountType(type));
}

function loginFromStartFor(type)
{
    return (url, startPayload, username, password) => loginFromStart(url, startPayload, getAccountType(type), username, password);
}

function loginFromTgcFor(type)
{
    return (url, tgc) => loginFromTgc(url, tgc, getAccountType(type));
}

/**
 * Map Start({…}) fields onto a PronoteSession.
 * PRONOTE 2025+ uses `a`/`d`/`CrA`/`CoA`; legacy instances use `sCrA`/`sCoA`.
 */
function applyStartToSession(session, start)
{
    if (start.a !== undefined) {
        session.appKey = parseInt(start.a, 10);
        session.httpMode = start.d === true || start.d === 'true' || start.http === true || start.http === 'true';
        session.disableAES = !start.CrA;
        session.disableCompress = !start.CoA;
        return;
    }

    session.disableAES = !!start.sCrA;
    session.disableCompress = !!start.sCoA;
}

async function login(url, username, password, casName, account)
{
    const server = getServer(url);
    debug.step('login.begin', { server, cas: casName, username, account: account.name });

    let start;
    try {
        debug.step('login.getStart');
        start = await getStart(server, username, password, casName, account);
        debug.step('login.getStart.ok', {
            sessionId: start.h,
            appKey: start.a,
            httpMode: start.d,
            fromCas: start.e !== undefined,
        });
    } catch (error) {
        debug.fail('login.getStart', error);
        throw error;
    }

    const session = new PronoteSession({
        serverURL: server,
        sessionID: start.h,
        type: account,
        disableAES: false,
        disableCompress: false,
    });

    applyStartToSession(session, start);
    debug.step('login.sessionCreated', {
        appKey: session.appKey,
        httpMode: session.httpMode,
        disableAES: session.disableAES,
        disableCompress: session.disableCompress,
    });

    try {
        debug.step('login.getParams');
        session.params = await getParams(session);
        if (!session.params) {
            debug.fail('login.getParams', errors.WRONG_CREDENTIALS.drop(), { reason: 'empty_params' });
            throw errors.WRONG_CREDENTIALS.drop();
        }
        debug.step('login.getParams.ok', { title: session.params.title });
    } catch (error) {
        debug.fail('login.getParams', error);
        throw error;
    }

    try {
        debug.step('login.auth', { fromCas: casName !== 'none' });
        if (casName === 'none') {
            await auth(session, username, password, false);
        } else {
            await auth(session, start.e, start.f, true);
        }
        debug.step('login.auth.ok');
    } catch (error) {
        debug.fail('login.auth', error);
        throw error;
    }

    try {
        debug.step('login.getUser');
        session.user = await getUser(session);
        debug.step('login.getUser.ok', { userId: session.user?.id, name: session.user?.name });
    } catch (error) {
        debug.fail('login.getUser', error);
        throw error;
    }

    debug.step('login.complete');
    return session;
}

/**
 * Shared tail of loginFromStart and loginFromTgc:
 * build session from Start → getParams → auth (CAS e/f or username/password) → getUser.
 */
async function completeSessionFromStart(server, start, account, username, password)
{
    const session = new PronoteSession({
        serverURL: server,
        sessionID: start.h,
        type: account,
        disableAES: false,
        disableCompress: false,
    });

    applyStartToSession(session, start);

    session.params = await getParams(session);
    if (!session.params) {
        throw errors.WRONG_CREDENTIALS.drop();
    }

    const fromCas = start.e !== undefined && start.f !== undefined;
    if (fromCas) {
        await auth(session, start.e, start.f, true);
    } else if (username && password) {
        await auth(session, username, password, false);
    } else {
        debug.fail('login.fromStart', errors.INVALID_START.drop(), { reason: 'missing_auth_material' });
        throw errors.INVALID_START.drop();
    }

    session.user = await getUser(session);
    debug.step('login.fromStart.complete', { name: session.user?.name });
    return session;
}

async function loginFromStart(url, startPayload, account, username, password)
{
    const server = getServer(url);
    debug.step('login.fromStart.begin', { server, account: account.name });

    let start;
    try {
        start = parseStartPayload(startPayload);
    } catch (error) {
        debug.fail('login.fromStart.parse', error);
        throw error;
    }

    return completeSessionFromStart(server, start, account, username, password);
}

/**
 * LaNote primary login path: user copies CAS TGC from browser DevTools.
 * fetchStartFromTgc obtains a fresh Start token, then reuses completeSessionFromStart.
 */
async function loginFromTgc(url, tgc, account)
{
    const server = getServer(url);
    debug.step('login.fromTgc.begin', { server, account: account.name });

    let start;
    try {
        start = await fetchStartFromTgc(server, tgc);
    } catch (error) {
        debug.fail('login.fromTgc', error);
        throw error;
    }

    return completeSessionFromStart(server, start, account);
}

function getServer(url)
{
    if (url.endsWith('.html')) {
        return url.substring(0, url.lastIndexOf('/') + 1);
    }

    if (!url.endsWith('/')) {
        url += '/';
    }

    return url;
}

async function getStart(url, username, password, casName, type)
{
    if (casName === 'names' || casName === 'getCAS' || !cas[casName]) {
        debug.fail('login.getStart', errors.UNKNOWN_CAS.drop(casName), { cas: casName });
        throw errors.UNKNOWN_CAS.drop(casName);
    }

    const account = typeof type === 'string' ? getAccountType(type) : type;
    return await cas[casName](url, account, username, password);
}

async function auth(session, username, password, fromCas)
{
    const id = await getId(session, username, fromCas);
    const key = getLoginKey(username, password, id.scramble, fromCas);

    let challenge;
    try {
        challenge = decipher(session, id.challenge, { scrambled: true, key });
    } catch (e) {
        debug.fail('login.auth', errors.WRONG_CREDENTIALS.drop(), { reason: 'challenge_decipher_failed' });
        throw errors.WRONG_CREDENTIALS.drop();
    }

    const userKey = await getAuthKey(session, challenge, key);
    if (!userKey) {
        debug.fail('login.auth', errors.WRONG_CREDENTIALS.drop(), { reason: 'empty_auth_key' });
        throw errors.WRONG_CREDENTIALS.drop();
    }

    session.aesKey = decipher(session, userKey, { key, asBytes: true });
}

module.exports = {
    loginStudent: loginFor('student'),
    loginParent: loginFor('parent'),
    loginStudentFromStart: loginFromStartFor('student'),
    loginParentFromStart: loginFromStartFor('parent'),
    loginStudentFromTgc: loginFromTgcFor('student'),
    loginParentFromTgc: loginFromTgcFor('parent'),

    getStart,
    auth,
    applyStartToSession,
};
