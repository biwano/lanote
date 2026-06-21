const axioRequest = require('./axioRequest');
const debug = require('./debug');

async function http({ url, body, data, method = 'GET', binary, jar = null, followRedirects = true, headers = null }) {
    const response = await axioRequest({
        url,
        body,
        data,
        method,
        binary,
        jar,
        headers,
    });

    if (response.headers.location && followRedirects) {
        let location = response.headers.location;
        if (!location.startsWith('http')) {
            location = getOrigin(url) + location;
        }

        debug.step('http.redirect', { from: url, to: location });

        if (followRedirects === 'get') {
            return location;
        }

        return await http({
            url: location,
            jar,
            headers,
        });
    }
    return response.data;
}

function getOrigin(url) {
    const noProtocol = url.substring(url.indexOf('/') + 2);
    return url.substring(0, url.indexOf('/')) + '//' + noProtocol.substring(0, noProtocol.indexOf('/'));
}

module.exports = http;
