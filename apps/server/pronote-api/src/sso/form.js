const { JSDOM } = require('jsdom');

const http = require('../http');
const debug = require('../debug');

function getParams(dom, extra = {}) {
    const params = {};

    Array.prototype.forEach.call(
        dom.window.document.getElementsByTagName('input'),
        input => {
            if (input.name === '') {
                return;
            }
            if ((input.type === 'radio' || input.type === 'checkbox') && !input.checked) {
                return;
            }
            params[input.name] = input.value;
        },
    );

    return { ...params, ...extra };
}

function resolveFormAction(dom, actionRoot) {
    const form = dom.window.document.getElementsByTagName('form')[0];
    if (!form) {
        throw new Error('No HTML form found on page');
    }

    let url = form.action;

    if (url.startsWith('/')) {
        url = url.substring(1);
    }

    if (url.indexOf('http') === -1) {
        url = actionRoot + url;
    }

    return url;
}

async function getDOM({ url, jar, method = 'GET', data = '', runScripts, hook, followRedirects, asIs, _step }) {
    if (_step) {
        debug.step(_step, { method, url });
    }

    let result = await http({
        url,
        method,
        data,
        jar,
        followRedirects,
    });

    if (asIs) {
        debug.step('sso.form.response', debug.htmlHint(result));
        return result;
    }

    if (result.indexOf('<script>$(function() { startup() });</script>') !== -1) {
        result = result
            .replace('<script>$(function() { startup() });</script>', '')
            .replace('console.log(user+" "+pwd);', '');
    }

    return new JSDOM(result, {
        runScripts: runScripts ? 'dangerously' : 'outside-only',
        beforeParse(window) {
            if (hook) {
                hook(window);
            }
        },
        cookieJar: jar,
    });
}

async function submitForm({
    dom,
    jar,
    asIs,
    runScripts,
    hook,
    method = 'POST',
    actionRoot,
    extraParams,
    followRedirects = true,
}) {
    const url = resolveFormAction(dom, actionRoot);
    const params = getParams(dom, extraParams);
    const paramNames = Object.keys(params).filter(n => !/password|pwd|j_password/i.test(n));

    debug.step('sso.form.submit', {
        method,
        url,
        paramNames,
    });

    return getDOM({
        url,
        jar,
        asIs,
        followRedirects,
        runScripts,
        hook,
        data: params,
        method,
        _step: 'sso.form.submit.response',
    });
}

module.exports = {
    getParams,
    getDOM,
    submitForm,
};
