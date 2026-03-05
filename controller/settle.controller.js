'use strict';
const service = require("../service/settle.service")

module.exports = function (app) {
    app.route('/v1/settlements/:sIdx').get(service.getSettleMents);

    app.route('/v1/settlements/:sIdx').post(service.setSettleMents)
};
