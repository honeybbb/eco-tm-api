'use strict';

const service = require("../service/work.service");
module.exports = function (app) {
    //출근 확인
    app.route('/v1/work/flag/:mIdx').get(service.getWorkFl);

    //직원 출근
    app.route('/v1/work/start').post(service.workStart);

    //직원 퇴근
    app.route('/v1/work/end').post(service.workEnd);

    //직원 근무현황 조회
    app.route('/v1/work/sheet/:mIdx').get(service.getWorkSheet);

    //직원 근태 수정
    app.route('/v1/work/modify/:idx').put(service.modifyWork);

    //직원 근무현황
    app.route('/v1/work/list').get(service.getWorkList);

    //직원 출근 일수에 따른 급여
    //app.route('/v1/work/day/count').get(service.getWorkDayCount);
}
