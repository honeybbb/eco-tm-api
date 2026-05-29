'use strict';

const service = require("../service/member.service");
const {verifyAdmin} = require("../middleware/auth");

module.exports = function (app) {
    // 관리자 등록
    app.route('/v1/manager/register').post(service.registerManager);

    //관리자 조회
    app.route('/v1/manager/list/:cIdx').get(service.getManagerList);

    //관리자 삭제
    app.route('/v1/manager/:managerId').delete(service.deleteManager);

    //직원 리스트 조회
    app.route('/v1/member/list').get(service.getMemberList);

    app.route('/v1/member/rrn/batch').post(service.getMemberRRNBatch);

    //직원 정보 조회
    app.route('/v1/member/data/:id').get(service.getMemberData);

    //직원 등록
    app.route('/v1/member/register').post(service.registerFullMember);

    app.route('/v1/member/data/:idx').put(service.updateMemberData);

    app.route('/v1/member/status/four/ins/:idx').put(service.updateMemberFourInsStatus);

    //직원 삭제
    app.route('/v1/member/:id').delete(service.deleteMember);

    //직원 연차 조회
    app.route('/v1/member/annual/list').get(service.getMemberLeave);

    //직원 연차 저장
    app.route('/v1/member/annual/register').post(service.setMemberLeave);

    //직원 연차 수정
    app.route('/v1/member/annual/data/:mIdx').put(service.updateMemberLeave);

    //직원 연차 신청
    app.route('/v1/member/off/request/:mIdx').post(service.setMemberOff);

    //직원 연차 신청 현황
    app.route('/v1/member/off').get(service.getMemberOff);

    //직원 연차 승인 or 반려
    app.route('/v1/member/off/status').post(service.updateOffStatus);

    //연차 중간 정산
    app.route('/v1/member/annual/settle').post(service.setAnnualSettlement)

    //배치 가능 직원 조회
    app.route('/v1/member/staffing/:sIdx').get(service.getMemberAvailable);

    //직원 배치
    app.route('/v1/member/staffing/:mIdx').post(service.setMemberStaffing);

    //직원 배치 해제
    app.route('/v1/member/staffing/:idx').put(service.updateMemberStaffing);

}
