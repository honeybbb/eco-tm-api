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

    app.route('/v1/member/data/:id').put(service.updateMemberData);

    //직원 연차 조회
    app.route('/v1/member/leave').get(service.getMemberLeave);

    //직원 연차 저장
    app.route('/v1/member/leave/register').post(service.setMemberLeave);

    //직원 연차 신청
    app.route('/v1/member/off/request/:mIdx').post(service.setMemberOff);

    //직원 연차 신청 현황
    app.route('/v1/member/off/:cIdx').get(service.getMemberOff);

    //직원 연차 승인 or 반려
    app.route('/v1/member/off/status').post(service.updateOffStatus);

    //배치 가능 직원 조회
    app.route('/v1/member/staffing/:sIdx').get(service.getMemberAvailable);

    //직원 배치
    app.route('/v1/member/staffing/:mIdx').post(service.setMemberStaffing);

    //직원 배치 해제
    app.route('/v1/member/staffing/:idx').delete(service.removeMemberStaffing);

}
