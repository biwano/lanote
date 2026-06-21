/**
 * EduConnect SAML login — flow derived from docs/agents/connexion.har
 * (Haute-Garonne CAS → EduConnect → SAMLResponse → CAS → PRONOTE).
 */
const errors = require('../errors');
const debug = require('../debug');
const { submitForm } = require('./form');

const EDUCONNECT_ROOT = 'https://educonnect.education.gouv.fr/';

function pageRoot(dom) {
    const action = dom.window.document.querySelector('form')?.action || '';
    if (action.startsWith('http')) {
        const slash = action.indexOf('/', 8);
        return slash === -1 ? `${action}/` : `${action.substring(0, slash + 1)}`;
    }
    return EDUCONNECT_ROOT;
}

function fillCredentials(dom, username, password) {
    const doc = dom.window.document;
    const user = doc.querySelector('input[name="j_username"]');
    const pass = doc.querySelector('input[name="j_password"]');

    debug.step('sso.educonnect.fillCredentials', {
        hasUsernameField: !!user,
        hasPasswordField: !!pass,
    });

    if (!user || !pass) {
        debug.fail('sso.educonnect.fillCredentials', errors.WRONG_CREDENTIALS.drop(), {
            reason: 'educonnect_login_fields_missing',
        });
        throw errors.WRONG_CREDENTIALS.drop();
    }

    user.value = username;
    pass.value = password;
}

function hasSamlResponse(dom) {
    return !!dom.window.document.querySelector('input[name="SAMLResponse"]');
}

function hasCredentialFields(dom) {
    const user = dom.window.document.querySelector('input[name="j_username"]');
    const pass = dom.window.document.querySelector('input[name="j_password"]');
    if (!user || !pass) {
        return false;
    }
    return user.type !== 'hidden' && pass.type !== 'hidden';
}

function hasLocalStorageConsent(dom) {
    return !!dom.window.document.querySelector('input[name="shib_idp_ls_success.shib_idp_session_ss"]')
        && !hasCredentialFields(dom);
}

function pageHint(dom) {
    const doc = dom.window.document;
    const form = doc.querySelector('form');
    return {
        formAction: form?.action,
        hasSamlResponse: hasSamlResponse(dom),
        hasCredentialFields: hasCredentialFields(dom),
        hasLocalStorageConsent: hasLocalStorageConsent(dom),
        inputNames: Array.from(doc.querySelectorAll('input[name]')).map(i => i.name).slice(0, 12),
    };
}

async function submitLocalStorageConsent(dom, jar) {
    debug.step('sso.educonnect.localStorageConsent', pageHint(dom));
    return submitForm({
        dom,
        jar,
        actionRoot: pageRoot(dom),
        extraParams: {
            'shib_idp_ls_exception.shib_idp_session_ss': '',
            'shib_idp_ls_success.shib_idp_session_ss': 'true',
            '_eventId_proceed': '',
        },
    });
}

async function submitCredentials(dom, jar, username, password) {
    fillCredentials(dom, username, password);
    return submitForm({
        dom,
        jar,
        actionRoot: pageRoot(dom),
        extraParams: {
            '_eventId_proceed': '',
        },
    });
}

async function login({ dom, jar, username, password }) {
    debug.step('sso.educonnect.begin', pageHint(dom));

    for (let step = 0; step < 4 && !hasSamlResponse(dom); step += 1) {
        if (hasLocalStorageConsent(dom)) {
            dom = await submitLocalStorageConsent(dom, jar);
            debug.step('sso.educonnect.afterLocalStorageConsent', pageHint(dom));
            continue;
        }

        if (hasCredentialFields(dom)) {
            dom = await submitCredentials(dom, jar, username, password);
            debug.step('sso.educonnect.afterCredentials', pageHint(dom));
            continue;
        }

        debug.fail('sso.educonnect', errors.WRONG_CREDENTIALS.drop(), {
            reason: 'unexpected_educonnect_page',
            ...pageHint(dom),
        });
        throw errors.WRONG_CREDENTIALS.drop();
    }

    if (!hasSamlResponse(dom)) {
        debug.fail('sso.educonnect', errors.WRONG_CREDENTIALS.drop(), {
            reason: 'saml_response_missing',
            ...pageHint(dom),
        });
        throw errors.WRONG_CREDENTIALS.drop();
    }

    debug.step('sso.educonnect.submitSamlToCas', pageHint(dom));
    return submitForm({ dom, jar, followRedirects: false });
}

module.exports = login;
