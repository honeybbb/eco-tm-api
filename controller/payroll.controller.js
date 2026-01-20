'use strict';

const service = require("../service/payroll.service");

module.exports = function (app) {
    //직원 출근일수에 따른 급여
    app.route('/v1/payroll/member/workday').get(service.getWorkPayroll);
    //직원 급여 조회
    // app.route('/v1/payroll/member/:mIdx').get(service.getPayroll);

    //직원 급여 도급 저장
    app.route('/v1/payroll/member').post(service.setPayrollDetail);

    //직원 급여 도급 내역 (관리자)
    app.route('/v1/payroll/member').get(service.getMonthlyWage);

    //직원 급여 상세 조회
    app.route('/v1/payroll/member/detail/:mIdx').get(service.getPayrollDetail);

    //연차 추계액 조회
    // app.route('/v1/annual/leave').get(service.getAnnualLeave);
}
