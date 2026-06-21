/**
 * PRONOTE Start({…}) parsing — extracted from eleve.html after CAS login.
 *
 * PRONOTE embeds session bootstrap data in the HTML onload handler, e.g.:
 *   Start ({h:9414455,a:3,e:'…',f:'…',g:3})
 *
 * Field meanings (2025+ protocol):
 *   h — session id (used in appelfonction URLs)
 *   a — app key
 *   e, f — CAS auth material (when present, login uses these instead of username/password)
 *   d — http mode flag
 *
 * Sample HTML: docs/agents/eleve.html
 */
const errors = require('../errors');
const debug = require('../debug');

/** Convert JS object literal syntax (unquoted keys, single quotes) to JSON. */
function startObjectToJson(start) {
    return start
        .replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/gu, '"$2": ')
        .replace(/'/gu, '"');
}

function parseStartObject(start) {
    const json = startObjectToJson(start.trim());

    try {
        return JSON.parse(json);
    } catch (error) {
        debug.fail('start.parse', error, { reason: 'start_json_parse_failed', snippet: json.slice(0, 120) });
        throw errors.INVALID_START.drop();
    }
}

/**
 * Locate the `{…}` argument of Start(…) inside PRONOTE HTML.
 * Tries a regex on whitespace-normalized HTML first, then a compact fallback
 * for minified pages where Start sits inside try/catch onload code.
 */
function findStartObjectInHtml(html) {
    const normalized = html.replace(/\s+/g, ' ');
    const match = normalized.match(/Start\s*\(\s*(\{[^}]+\})/i);
    if (match) {
        return match[1];
    }

    const compact = html.replace(/ /ug, '').replace(/\n/ug, '');
    const from = 'Start(';
    const to = ')}catch';
    if (compact.includes(from) && compact.includes(to)) {
        return compact.substring(compact.indexOf(from) + from.length, compact.indexOf(to));
    }

    return null;
}

function extractStartFromHtml(html) {
    const hint = debug.htmlHint(html);
    debug.step('start.extract', hint);

    if (html.includes('Votre adresse IP est provisoirement suspendue')) {
        throw errors.BANNED.drop();
    }

    if (html.includes('Le site n\'est pas disponible')) {
        throw errors.CLOSED.drop();
    }

    const startObject = findStartObjectInHtml(html);
    if (!startObject) {
        // Still on CAS login page → TGC missing, expired, or wrong domain.
        if (html.includes('login') && html.includes('cas.')) {
            debug.fail('start.extract', errors.INVALID_TGC.drop(), { reason: 'landed_on_cas_login', ...hint });
            throw errors.INVALID_TGC.drop();
        }
        debug.fail('start.extract', errors.INVALID_START.drop(), { reason: 'start_call_missing', ...hint });
        throw errors.INVALID_START.drop();
    }

    const parsed = parseStartObject(startObject);
    debug.step('start.extract.ok', { sessionId: parsed.h, appKey: parsed.a, fromCas: parsed.e !== undefined });
    return parsed;
}

/** Public entry for login-tgc.js — expects full eleve.html response body. */
function extractStart(html) {
    return extractStartFromHtml(html);
}

/** Legacy path: user-pasted Start({…}) string or raw JSON (loginStudentFromStart). */
function parseStartPayload(input) {
    const trimmed = input.trim();
    if (!trimmed) {
        throw errors.INVALID_START.drop();
    }

    if (trimmed.includes('Start(') || trimmed.includes('Start (')) {
        return extractStartFromHtml(trimmed);
    }

    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed.h === undefined) {
                throw errors.INVALID_START.drop();
            }
            debug.step('start.parse.ok', { sessionId: parsed.h, appKey: parsed.a, fromCas: parsed.e !== undefined });
            return parsed;
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error) {
                throw error;
            }
            throw errors.INVALID_START.drop();
        }
    }

    throw errors.INVALID_START.drop();
}

module.exports = {
    extractStart,
    parseStartPayload,
};
