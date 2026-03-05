'use strict';
const multer = require('multer');
const memberService = require("../service/member.service");
const workService = require("../service/work.service");
const upload = multer({ storage: multer.memoryStorage() });

module.exports = function (app) {
    //직원 등록 - 엑셀 업로드
    app.route('/v1/upload/member').post(upload.single('file'), memberService.uploadExcel);

    //출근 등록 - 엑셀 업로드
    app.route('/v1/upload/work').post(upload.single('file'), workService.uploadExcel);

}
