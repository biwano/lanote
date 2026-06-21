/**
 * Parse cookies copied from browser DevTools (CAS domain).
 *
 * Accepted formats:
 *   TGC-abc…                          (lone TGC token)
 *   TGC=TGC-abc…                      (single pair)
 *   TGC=…; JSESSIONID=…               (Cookie header style)
 *   TGC=…\nJSESSIONID=…               (one name=value per line)
 */
function parseBrowserCookies(input) {
    const trimmed = input.trim();
    if (!trimmed) {
        return [];
    }

    const cookies = new Map();
    const header = trimmed.replace(/^Cookie:\s*/i, '');

    for (const part of header.split(/[;\n]+/)) {
        const line = part.trim();
        if (!line) {
            continue;
        }

        const eq = line.indexOf('=');
        if (eq === -1) {
            cookies.set('TGC', normalizeTgcValue(line));
            continue;
        }

        const name = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (name) {
            cookies.set(name, value);
        }
    }

    return [...cookies.entries()].map(([name, value]) => ({ name, value }));
}

function normalizeTgcValue(tgc) {
    let value = tgc.trim();
    if (value.startsWith('TGC=')) {
        value = value.substring(4);
    }
    if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
    }
    return value;
}

module.exports = {
    parseBrowserCookies,
    normalizeTgcValue,
};
