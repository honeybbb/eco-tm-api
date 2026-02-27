'use strict';

const service = require("../service/etc.service");

module.exports = function (app) {
    //관리자 메뉴 조회
    app.route('/v1/menu/:companyNo').get(service.getMenus);

    /* ======= 공지 관련 ======= */
    //공지 리스트
    app.route('/v1/notice/list').get(service.getNoticeList)

    //공지 조회
    app.route('/v1/notice/data').get(service.getNoticeData)

    //공지 등록
    app.route('/v1/notice/register').post(service.setNotice);

    //공지 삭제
    app.route('/v1/notice/remove').delete(service.removeNotice);

    /* ======= 코드 관련 ======= */

    //기본 코드 조회
    app.route('/v1/code/:cIdx').get(service.getBaseCode);

    //그룹 코드 조회
    app.route('/v1/code/:groupCd').get(service.getGroupCode);

    //기본 코드 저장
    app.route('/v1/code/:cIdx').post(service.setBaseCode);

    //기본 코드 삭제
    app.route('/v1/code/:itemCd').delete(service.deleteBaseCode);

    //company 정보 조회
    app.route('/v1/config/company/:idx').get(service.getCompanyConfig);

    //급여항목 조회
    app.route('/v1/config/code/wage/:cIdx').get(service.getWageCode);

    //당해년도 세율 저장
    app.route('/v1/config/tax/rate').post(service.setTaxRate);

    //당해년도 세율 조회
    app.route('/v1/config/tax/rate/:year').get(service.getTaxRate);
}
