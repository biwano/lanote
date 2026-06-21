const jsdom = require('jsdom');

const { extractStart } = require('../auth/start');
const debug = require('../debug');
const errors = require('../errors');
const { getDOM, submitForm } = require('./form');
const educonnect = require('./educonnect');

function isEduconnectPage(dom) {
    const action = dom.window.document.querySelector('form')?.action || '';
    return action.includes('educonnect.education.gouv.fr')
        || !!dom.window.document.querySelector('input[name="shib_idp_ls_success.shib_idp_session_ss"]')
        || !!dom.window.document.querySelector('input[name="j_username"]');
}

function hasSamlRequest(dom) {
    return !!dom.window.document.querySelector('input[name="SAMLRequest"]');
}

async function login({ url, account, username, password, casUrl, idp }) {
    debug.step('sso.casEduconnect.begin', { url, casUrl, idp, account: account.value });

    const jar = new jsdom.CookieJar();
    const casRoot = `https://${casUrl}/`;
    const casLoginUrl = `${casRoot}login?selection=${idp}&service=${encodeURIComponent(url)}`;

    debug.step('sso.casEduconnect.fetchCasLogin', { casLoginUrl });

    let dom = await getDOM({
        url: casLoginUrl,
        jar,
        followRedirects: true,
    });

    debug.step('sso.casEduconnect.afterCasLogin', {
        formAction: dom.window.document.querySelector('form')?.action,
        isEduconnect: isEduconnectPage(dom),
    });

    if (!isEduconnectPage(dom)) {
        dom = await submitForm({
            dom,
            jar,
            actionRoot: casRoot,
            extraParams: {
                selection: idp,
                submit: 'Valider',
            },
        });

        debug.step('sso.casEduconnect.afterCasWayf', {
            formAction: dom.window.document.querySelector('form')?.action,
            isEduconnect: isEduconnectPage(dom),
        });
    }

    if (!isEduconnectPage(dom)) {
        debug.fail('sso.casEduconnect', errors.WRONG_CREDENTIALS.drop(), {
            reason: 'cas_idp_redirect_failed',
            idp,
            formAction: dom.window.document.querySelector('form')?.action,
        });
        throw errors.WRONG_CREDENTIALS.drop();
    }

    if (hasSamlRequest(dom)) {
        debug.step('sso.casEduconnect.submitSamlRequest');
        dom = await submitForm({ dom, jar, followRedirects: true });
    }

    await educonnect({ dom, jar, username, password });

    const loginPage = `${url}${account.value}.html?fd=1&login=true`;
    debug.step('sso.casEduconnect.fetchPronoteStart', { loginPage });

    const html = await getDOM({ url: loginPage, jar, asIs: true });
    return extractStart(html);
}

module.exports = login;
