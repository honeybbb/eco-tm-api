'use strict';
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const memberService = require("../service/member.service");
const workService = require("../service/work.service");
const contractService = require("../service/contract.service");

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname); // 원래 파일의 확장자 추출 (.pdf)
        const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });
// const upload = multer({ storage: multer.memoryStorage() });
const uploadMemory = multer({ storage: multer.memoryStorage() });

module.exports = function (app) {
    //직원 등록 - 엑셀 업로드
    app.route('/v1/upload/member').post(uploadMemory.single('file'), memberService.uploadExcel);

    //출근 등록 - 엑셀 업로드
    app.route('/v1/upload/work').post(upload.single('file'), workService.uploadExcel);

    //출근 등록 - 엑셀 다운로드
    app.route('/v1/download/work/template').get(workService.downloadTemplate);

    //계약서 파일 업로드
    app.route('/v1/upload/file/:sIdx').post(upload.array('file', 10), contractService.uploadContractFile);

    //계약서 파일 다운로드
    app.route('/v1/download/file/:sIdx').get(contractService.downLoadContractFile);

}
