'use strict';
const service = require("../service/notice.service");

module.exports = function (app) {
    /* ======= 공지 관련 ======= */
    //공지 리스트
    app.route('/v1/notice/list/:cIdx').get(service.getNoticeList)

    //공지 조회
    app.route('/v1/notice/data').get(service.getNoticeData)

    //공지 등록
    app.route('/v1/notice/register').post(service.setNotice);

    //공지 삭제
    app.route('/v1/notice/remove/:idx').delete(service.removeNotice);
}
