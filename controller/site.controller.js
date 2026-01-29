'use strict';

const service = require("../service/site.service");

module.exports = function (app) {
    // 현장 리스트 조회
    app.route('/v1/site/list/:cIdx').get(service.getSiteList);

    //현장 비고 저장
    app.route('/v1/site/bigo/register').post(service.setSiteBigo);

    // 현장 데이터 조회
    app.route('/v1/site/data/:sIdx').get(service.getSiteData);

    // 현장 및 계약 등록
    app.route('/v1/site/register').post(service.registerSiteWithContract);

    app.route('/v1/site/modify').post(service.updateSiteData);

    //현장 배치 정보 저장
    app.route('/v1/site/headcount').post(service.setSiteHeadCount);

    app.route('/v1/site/headcount/:sIdx').get(service.getSiteHeadCount)

    //청구서 보기
    // app.route('/v1/site/account/bill').get(service)

    //청구서 저장
    app.route('/v1/site/account/bill').post(service.setAccountBill);

    //정산내역서 조회
    // app.route('/v1/account/bill')

    //산출내역서 저장
    app.route('/v1/site/estimate/:sIdx').post(service.setSiteEstimate);
}
