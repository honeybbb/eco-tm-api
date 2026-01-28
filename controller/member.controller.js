'use strict';

const service = require("../service/member.service");

module.exports = function (app) {
    //직원 리스트 조회
    app.route('/v1/member/list').get(service.getMemberList);

    //직원 정보 조회
    app.route('/v1/member/data/:id').get(service.getMemberData);

    //직원 등록
    // app.route('/v1/member/register').post(service.setMemberData);
    app.route('/v1/member/register').post(service.registerFullMember);

    //배치 가능 직원 조회
    app.route('/v1/member/list/available').get(service.getMemberAvailable);

    //직원 기본 급여 정보 조회
    app.route('/v1/member/payroll').get(service.getBaseSalary);

    //직원 기본 급여 등록
    app.route('/v1/member/base/salary/:mIdx').post(service.setBaseSalary);

    //직원 급여 정보 조회 (월급)
    app.route('/v1/member/payroll/month').get(service.getPayrollMonth);

    //직원 급여 정보 등록 (월급)
    app.route('/v1/member/payroll/month/:mIdx').post(service.setPayrollMonth);

    //직원 연차 조회
    app.route('/v1/member/leave').get(service.getMemberLeave);

    //직원 연차 저장
    app.route('/v1/member/leave/register').post(service.setMemberLeave);

    //직원 배치
    app.route('/v1/member/staffing/:mIdx').post(service.setMemberStaffing);

    //로그인
    app.route('/v1/member/auth').post(service.loginUser);

    //운영자 로그인
    app.route('/v1/manager/auth').post(service.loginManager);
}
