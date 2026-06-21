const casEduconnect = require('../sso/cas-educonnect');

module.exports = (url, account, username, password) => casEduconnect({
    url,
    account,
    username,
    password,
    casUrl: 'cas.ecollege.haute-garonne.fr',
    idp: 'EDU_parent_eleve',
});
