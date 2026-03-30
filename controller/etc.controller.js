'use strict';

const service = require("../service/etc.service");

module.exports = function (app) {
    //관리자 메뉴 조회
    app.route('/v1/menu/:companyNo').get(service.getMenus);

    app.route('/v1/menu/update/:companyNo').put(service.updateMenus);

    /* ======= 코드 관련 ======= */

    //기본 코드 조회
    app.route('/v1/code/:cIdx').get(service.getBaseCode);

    //그룹 코드 조회
    app.route('/v1/code/group/:groupCd').get(service.getGroupCode);

    //기본 코드 저장
    app.route('/v1/code/:cIdx').post(service.setBaseCode);

    app.route('/v1/code/:itemCd').put(service.updateBaseCode);

    //기본 코드 삭제
    app.route('/v1/code/:itemCd').delete(service.deleteBaseCode);

    //company 정보 조회
    app.route('/v1/config/company/:idx').get(service.getCompanyData);

    //급여항목 조회
    app.route('/v1/config/code/wage/:cIdx').get(service.getWageCode);

    //당해년도 세율 저장
    app.route('/v1/config/tax/rate').post(service.setTaxRate);

    //당해년도 세율 조회
    app.route('/v1/config/tax/rate/:year').get(service.getTaxRate);

    //당해년도 간이세액표 저장
    // app.route('/v1/config/tax/income').post(service.setTaxIncome);

    //소득세, 지방소득세 조회
    app.route('/v1/config/tax/income/:year').get(service.getTaxIncome);

    //청소용품 및 피복용품 신청
    app.route('/v1/code/item/order/:sIdx').post(service.setOrders);

    //청소용품 및 피복용품 신청 리스트
    app.route('/v1/code/item/order').get(service.getOrders);

    app.route('/v1/code/item/order/status').put(service.updateOrderStatus);
}
