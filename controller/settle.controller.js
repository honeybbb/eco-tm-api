'use strict';
const service = require("../service/settle.service")

module.exports = function (app) {
    app.route('/v1/settle/site/list').get(service.getSettleList);

    app.route('/v1/settle/site/data/:sIdx').post(service.setSettleData)

    app.route('/v1/settle/site/:idx').delete(service.deleteSettleList);

    app.route('/v1/settle/site/status').post(service.updateSettleStatus);
};
