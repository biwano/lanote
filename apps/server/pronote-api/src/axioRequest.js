const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');
const debug = require('./debug');

async function axioRequest({ url, body, data, method = 'GET', binary, jar = null, headers = null }) {
    let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    if (url.includes('teleservices.ac-nancy-metz.fr')) {
        userAgent = 'FuckTheUselessProtection/1.0';
    }

    const params = encodeParams(data);
    const requestHeaders = {
        'User-Agent': userAgent,
        ...(headers || {}),
    };

    if (body !== undefined) {
        requestHeaders['Content-Type'] = 'application/json';
    } else if (params !== '' && method.toUpperCase() !== 'GET') {
        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const cookie = encodeCookies(jar, url);
    if (cookie) {
        requestHeaders.Cookie = cookie;
    }

    const content = {
        url,
        method: method.toLowerCase(),
        headers: requestHeaders,
        maxRedirects: 0,
        validateStatus(status) {
            return status === 401 || (status >= 200 && status <= 302)
        },
        // eslint-disable-next-line no-process-env
        httpsAgent: process.env.PRONOTE_API_PROXY ? new HttpsProxyAgent(process.env.PRONOTE_API_PROXY) : undefined
    };

    if (binary) {
        content.responseType = 'arraybuffer';
    }

    if (params) {
        if (method.toUpperCase() === 'GET') {
            content.url += '?' + params;
        } else {
            content.data = params;
        }
    } else if (body) {
        content.data = body;
    }
    const response = await axios(content)

    debug.http(method.toUpperCase(), content.url, response.status, {
        redirect: response.headers.location ? redactLocation(response.headers.location) : undefined,
    });

    if (response.headers['set-cookie'] && jar !== null) {
        await updateCookies(response, jar, url);
    }

    return response;
}

function normalizeSetCookieHeaders(headers) {
    const raw = headers['set-cookie'];
    if (!raw) {
        return [];
    }
    return Array.isArray(raw) ? raw : [raw];
}

function sanitizeSetCookie(cookie) {
    return cookie
        .replace(/;\s*Domain=""\s*/gi, '; ')
        .replace(/;\s*Domain=''\s*/gi, '; ')
        .trim();
}

function setCookieAsync(jar, cookie, url) {
    return new Promise((resolve, reject) => {
        jar.setCookie(cookie, url, err => (err ? reject(err) : resolve()));
    });
}

async function updateCookies(response, jar, url) {
    const cookieUrl = response.request?.res?.responseUrl || url;
    const cookies = normalizeSetCookieHeaders(response.headers);

    for (const raw of cookies) {
        if (!raw) {
            continue;
        }

        const cookie = sanitizeSetCookie(raw);
        if (!cookie) {
            continue;
        }

        try {
            await setCookieAsync(jar, cookie, cookieUrl);
        } catch (err) {
            debug.step('http.setCookie.skip', {
                reason: err.message,
                cookie: cookie.slice(0, 80),
            });
        }
    }
}

function encodeCookies(jar, url) {
    if (!jar) {
        return '';
    }

    if (url && typeof jar.getCookieStringSync === 'function') {
        return jar.getCookieStringSync(url) || '';
    }

    let cookies = '';
    jar.toJSON().cookies.forEach(cookie => cookies += cookie.key + '=' + cookie.value + '; ');

    if (cookies.length !== 0) {
        cookies = cookies.substring(0, cookies.length - 2);
    }

    return cookies;
}

function encodeParams(data) {
    if (!data) {
        return '';
    }

    let params = '';
    for (const k of Object.keys(data)) {
        const v = data[k];
        params += `${k}=${encodeURIComponent(v)}&`
    }

    return params.substring(0, params.length - 1)
}

function redactLocation(location) {
    return location.length > 160 ? `${location.slice(0, 160)}…` : location;
}


module.exports = axioRequest
