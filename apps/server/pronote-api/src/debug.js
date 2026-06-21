const PREFIX = '[pronote-login]';

function enabled() {
    return process.env.PRONOTE_DEBUG !== '0';
}

function redactUrl(url) {
    if (!url || typeof url !== 'string') {
        return url;
    }
    return url.length > 160 ? `${url.slice(0, 160)}…` : url;
}

function step(name, details) {
    if (!enabled()) {
        return;
    }

    const payload = details ? ` ${JSON.stringify(details)}` : '';
    console.log(`${PREFIX} ${name}${payload}`);
}

function fail(name, error, details) {
    if (!enabled()) {
        return;
    }

    const extra = details ? ` ${JSON.stringify(details)}` : '';
    const message = error && typeof error === 'object' && 'message' in error
        ? error.message
        : String(error);
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    console.error(`${PREFIX} FAIL ${name}${extra} → ${message}${code !== undefined ? ` (code ${code})` : ''}`);
    if (error instanceof Error && error.stack) {
        console.error(error.stack);
    }
}

function http(method, url, status, extra) {
    if (!enabled()) {
        return;
    }

    const payload = {
        status,
        url: redactUrl(url),
        ...extra,
    };
    console.log(`${PREFIX} HTTP ${method} ${JSON.stringify(payload)}`);
}

function htmlHint(html) {
    if (!html || typeof html !== 'string') {
        return { length: 0 };
    }

    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return {
        length: html.length,
        hasPronote: html.includes('PRONOTE'),
        hasStart: html.includes('Start('),
        hasSamlResponse: html.includes('name="SAMLResponse"') || html.includes("name='SAMLResponse'"),
        title: title ? title[1].trim().slice(0, 80) : undefined,
    };
}

module.exports = {
    step,
    fail,
    http,
    htmlHint,
};
