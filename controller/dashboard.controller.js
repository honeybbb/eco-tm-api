'use strict';
const service = require('../service/dashboard.service');
module.exports = function (app) {
    //현장 통계
    // app.route('/v1/dashboard/site/status/:cIdx').get(service.getSiteStatus);

    //직원 통계
    // app.route('/v1/dashboard/member/status/:cIdx').get(service.getEmployeeStatus);

    //승인 대기 업무
    // app.route('/v1/dashboard/approval/status/:cIdx').get(service.getPendingApprovals);

    //대시보드
    app.route('/v1/dashboard/:cIdx').get(service.getDashboards);
}
