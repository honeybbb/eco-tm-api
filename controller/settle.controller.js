'use strict';
const service = require("../service/settle.service")

module.exports = function (app) {
    // 정산관리 리스트 조회
    app.route('/v1/settle/site/list').get(service.getSettleList);

    // 정산 데이터 불러오기
    app.route('/v1/settle/payroll').get(service.getSettlePayroll);

    app.route('/v1/settle/payroll/calculate').get(service.getCalculatedPayroll)

    //급여총액 리스트
    app.route('/v1/settle/payroll/summary').get(service.getSettleSummary);

    //청구현황
    app.route('/v1/settle/billing/list').get(service.getSettleBilling);

    // 용역 정산서 저장
    app.route('/v1/settle/site/data/:sIdx').post(service.setSettleData)

    // 정산서 삭제
    app.route('/v1/settle/site/:idx').delete(service.deleteSettleList);

    // 정산서 수정
    app.route('/v1/settle/site/status').post(service.updateSettleStatus);

    // 연차퇴직금 정산서 저장
    app.route('/v1/settle/member').post(service.setSettleMember)
};
