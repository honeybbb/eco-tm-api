'use strict';

const service = require("../service/equipment.service")

module.exports = function (app) {
    //장비 등록
    app.route('/v1/eq/register').post(service.setEquipment);

    //장비 리스트
    app.route('/v1/eq/list/:cIdx').get(service.getEquipmentList);

    //장비 조회
    app.route('/v1/eq/data/:idx').get(service.getEquipmentData);
}
