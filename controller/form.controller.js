'use strict';
const service = require("../service/form.service");

module.exports = function (app) {
    //사고보고서 저장
    app.route('/v1/form/accident/register').post(service.setFormAccident);

    //사고보고서 조회
    app.route('/v1/form/accident/data/:idx').get(service.getFormAccidentData);

    //피복주문서 저장
    app.route('/v1/form/cloth/order/register').post(service.setFormClothOrder);

    //피복주문서 조회
    app.route('/v1/form/cloth/order/data/:idx').get(service.getFormClothOrder);

    //장비수리 의뢰 보고서
    app.route('/v1/form/repair/register').post(service.setFormRepairRequest);

    //장비수리 의뢰 보고서 조회
    app.route('/v1/form/repair/data/:idx').get(service.getFormRepairRequest);
}
