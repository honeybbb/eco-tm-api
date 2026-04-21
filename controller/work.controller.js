'use strict';

const service = require("../service/work.service");
module.exports = function (app) {
    //출근 확인
    app.route('/v1/work/status').get(service.getWorkFl);

    //직원 출근
    app.route('/v1/work/start').post(service.workStart);

    //직원 퇴근
    app.route('/v1/work/end').post(service.workEnd);

    //직원 근무현황 조회 (직원화면)
    app.route('/v1/work/sheet/:mIdx').get(service.getWorkSheet);

    //직원 근태 수정
    app.route('/v1/work/modify/:idx').put(service.modifyWork);

    //직원 근무현황
    app.route('/v1/work/list').get(service.getWorkList);

    //직원 연차신청현황
    app.route('/v1/work/off').get(service.getWorkOffList);

    //직원 출근 일수에 따른 급여
    //app.route('/v1/work/day/count').get(service.getWorkDayCount);

    //직원 출근일괄 등록
    app.route('/v1/work/bulk').post(service.bulkRegisterWork);

    // 수동 등록/수정
    app.route('/v1/work/upsert').post(service.upsertWork);

    // 근태 삭제
    app.route('/v1/work/:idx').delete(service.deleteWork);
}
