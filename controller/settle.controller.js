'use strict';
const service = require("../service/settle.service")

module.exports = function (app) {
    app.route('/v1/settlements').get(service.getSettleMents);
};
