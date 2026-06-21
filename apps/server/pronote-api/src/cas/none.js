const http = require('../http');
const { extractStart } = require('../auth/start');

async function login(url, account) {
    return extractStart(await http({ url: url + account.value + '.html?fd=1&login=true' }));
}

module.exports = login;
