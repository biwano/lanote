const { extractStart } = require('../auth/start');
const { getParams, getDOM, submitForm } = require('../sso/form');

module.exports = {
    submitForm,
    getDOM,
    getParams,
    extractStart,
};
