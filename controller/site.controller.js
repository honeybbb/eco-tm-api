'use strict';
const { verifyAdmin} = require('../middleware/auth');
const service = require("../service/site.service");

module.exports = function (app) {
    // 현장 리스트 조회
    app.route('/v1/site/list').get(service.getSiteList);

    //현장 비고 저장
    app.route('/v1/site/bigo/register').post(service.setSiteBigo);

    //현장 비고 수정
    // app.route('/v1/site/bigo/update').put(service.updateSiteBigo);

    //현장 비고 삭제
    // app.route('/v1/site/bigo/:idx').delete(service.DeleteSiteBigo);

    //현장 비품 예산 설정
    app.route('/v1/site/order/budgets').post(service.setSiteOrderBudgets);

    // 현장 데이터 조회
    app.route('/v1/site/data/:sIdx').get(service.getSiteData);

    app.route('/v2/site/data/:sIdx').get(service.getSiteData_v2);

    // 현장 위도,경도 조회
    app.route('/v1/site/coords/:sIdx').get(service.getSiteCoords);

    // 현장 배치 조회
    app.route('/v1/site/staff/:sIdx').get(service.getAssignedStaff)

    // 현장 및 계약 등록
    app.route('/v1/site/register').post(service.registerSiteWithContract);

    //산출내역서 저장
    app.route('/v1/site/estimate/:sIdx').post(service.setSiteEstimate);

    //산출내역서 업데이트
    app.route('/v1/site/contract/budget').post(service.registerBudget);

    //산출내역서 조회
    app.route('/v1/site/contract/budget').get(service.getSiteBudget);

    //대청소 스케줄 조회
    app.route('/v1/site/cleaning/schedule').get(service.getSiteCleaningSchedule);

    app.route('/v1/site/modify').post(service.updateSiteData);

    app.route('/v1/site/:id').delete(service.DeleteSite);

    //청구담당/급여담당 수정
    app.route('/v1/site/manager/batch').put(service.updateSiteManager);

    //현장 배치 정보 저장
    /*
    app.route('/v1/site/headcount').post(service.setSiteHeadCount);

    app.route('/v1/site/headcount/:sIdx').get(service.getSiteHeadCount)

    //청구서 보기
    // app.route('/v1/site/account/bill').get(service)

    //청구서 저장
    app.route('/v1/site/account/bill').post(service.setAccountBill);

     */
}
