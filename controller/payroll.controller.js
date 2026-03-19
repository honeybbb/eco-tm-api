'use strict';

const service = require("../service/payroll.service");

module.exports = function (app) {
    //직원 기본 급여 정보 조회
    app.route('/v1/member/payroll').get(service.getBaseSalary);

    //직원 기본 급여 등록
    app.route('/v1/member/base/salary/:mIdx').post(service.setBaseSalary);

    //직원 급여 정보 조회 (월급)
    app.route('/v1/member/payroll/month').get(service.getPayrollMonth);

    //직원 급여 계산
    app.route('/v1/member/payroll/calculate').get(service.getPayrollCalculate)

    // 특정 직원의 전체 급여 이력 조회
    app.route('/v1/member/payroll/history/:mIdx').get(service.getMemberPayrollHistory);

    //직원 급여 정보 등록 (월급)
    app.route('/v1/member/payroll/month/:mIdx').post(service.setPayrollMonth);

    //직원 퇴직금 추계액 조회
    app.route('/v1/payroll/retirement').get(service.getRetirementEstimation);

    //직원 출근일수에 따른 급여
    app.route('/v1/payroll/member/workday').get(service.getWorkPayroll);

    app.route('/v1/payroll/annual').get(service.getAnnualLeaveEstimation);
    /*

    //직원 급여 도급 저장
    app.route('/v1/payroll/member').post(service.setPayrollDetail);

    //직원 급여 도급 내역 (관리자)
    app.route('/v1/payroll/member').get(service.getMonthlyWage);

    //직원 급여 상세 조회
    app.route('/v1/payroll/member/detail/:mIdx').get(service.getPayrollDetail);

    //연차 추계액 조회
    // app.route('/v1/annual/leave').get(service.getAnnualLeave);

    //정산관리 조회
    app.route('/v1/payroll/list').get(service.getPayrollList);

     */
}
