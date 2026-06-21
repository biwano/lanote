/**
 * CAS TGC login — replays the browser flow captured in docs/agents/login.har.
 *
 * ENT schools (e.g. Haute-Garonne) protect PRONOTE behind CAS. After the learner
 * logs in via EduConnect in their browser, the CAS server sets a TGC (Ticket
 * Granting Cookie) on the CAS domain. LaNote cannot automate EduConnect, but it
 * can reuse that cookie to obtain a fresh PRONOTE Start({…}) token server-side.
 *
 * Redirect chain (see login.har):
 *   GET pronote/           → 302 CAS /login?service=…
 *   GET CAS /login + cookies → 302 pronote/?ticket=ST-…
 *   GET pronote/?ticket=…  → 302 eleve.html?identifiant=…
 *   GET eleve.html         → 200 HTML with Start({h,a,e,f,g}) in onload
 *
 * The Start token is single-use; we fetch a new one on each login rather than
 * asking the user to paste it (which fails if already consumed).
 */
const jsdom = require('jsdom');

const debug = require('../debug');
const errors = require('../errors');
const http = require('../http');
const { navigationHeaders } = require('../browser-headers');
const { parseBrowserCookies } = require('./parse-cookies');
const { extractStart } = require('./start');

/** Scheme + host, e.g. https://cas.ecollege.haute-garonne.fr */
function getOrigin(url) {
    const noProtocol = url.substring(url.indexOf('/') + 2);
    return url.substring(0, url.indexOf('/')) + '//' + noProtocol.substring(0, noProtocol.indexOf('/'));
}

/** Ensure we hit the PRONOTE root (trailing slash), not eleve.html or a deep path. */
function normalizeServer(url) {
    if (url.endsWith('.html')) {
        return url.substring(0, url.lastIndexOf('/') + 1);
    }
    if (!url.endsWith('/')) {
        url += '/';
    }
    return url;
}

function setCookieAsync(jar, cookie, url) {
    return new Promise((resolve, reject) => {
        jar.setCookie(cookie, url, err => (err ? reject(err) : resolve()));
    });
}

/**
 * Inject all CAS cookies from the browser into the jar (TGC, JSESSIONID, …).
 * Responses during the redirect chain may add further cookies (e.g. on PRONOTE).
 */
async function setCasCookiesOnJar(jar, casUrl, cookiesInput) {
    const cookies = parseBrowserCookies(cookiesInput);
    if (cookies.length === 0) {
        throw errors.INVALID_TGC.drop();
    }

    for (const { name, value } of cookies) {
        if (!value) {
            continue;
        }
        const cookie = `${name}=${value}; Path=/; Secure; HttpOnly`;
        console.log('cookie', cookie);
        await setCookieAsync(jar, cookie, casUrl);
    }

    debug.step('login.tgc.setCookies', {
        casUrl: getOrigin(casUrl),
        names: cookies.map(c => c.name),
    });
}

/**
 * Discover CAS, replay TGC, follow redirects to eleve.html, return parsed Start.
 *
 * @param {string} pronoteUrl - School PRONOTE root URL
 * @param {string} tgcValue   - TGC alone, or all CAS cookies from DevTools (TGC, JSESSIONID, …)
 * @returns {Promise<object>} Parsed Start fields (h, a, e, f, …)
 */
async function fetchStartFromTgc(pronoteUrl, tgcValue) {
    const server = normalizeServer(pronoteUrl);
    const jar = new jsdom.CookieJar();

    debug.step('login.tgc.begin', { server });

    // Step 1: unauthenticated GET — PRONOTE redirects to the school's CAS login page.
    // followRedirects: 'get' stops at the redirect and returns the Location URL only.
    const headers = navigationHeaders();

    let casLoginUrl = await http({
        url: server,
        jar,
        headers,
        followRedirects: 'get',
    });

    if (!casLoginUrl || typeof casLoginUrl !== 'string') {
        debug.fail('login.tgc', errors.INVALID_TGC.drop(), { reason: 'no_cas_redirect' });
        throw errors.INVALID_TGC.drop();
    }

    debug.step('login.tgc.casLoginUrl', { casLoginUrl });

    // Step 2: inject browser CAS cookies, then GET CAS login — CAS issues a service ticket
    // and redirects through pronote/?ticket=… → eleve.html (Set-Cookie responses kept in jar).
    await setCasCookiesOnJar(jar, casLoginUrl, tgcValue);

    console.log('html', casLoginUrl,jar, headers);
    const html = await http({
        url: casLoginUrl,
        jar,
        headers,
        followRedirects: true,
    });

    if (typeof html !== 'string') {
        debug.fail('login.tgc', errors.INVALID_TGC.drop(), { reason: 'unexpected_response_type' });
        throw errors.INVALID_TGC.drop();
    }

    // Step 3: parse Start({…}) from eleve.html body (see auth/start.js).
    return extractStart(html);
}

module.exports = {
    fetchStartFromTgc,
    normalizeServer,
};
