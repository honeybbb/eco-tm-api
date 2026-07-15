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

    //계약서 파일 업로드 - 임의의 필드명(file_contract_0, file_contract_1 등)을 모두 허용하기 위해 upload.any() 사용
    app.route('/v1/upload/file/:sIdx').post(upload.any(), contractService.uploadContractFile);

    //계약서 파일 다운로드
    app.route('/v1/download/file/:sIdx').get(contractService.downLoadContractFile);

    //이미지 업로드
    app.route('/v1/upload/image').post(upload.single('image'), uploadImage);

    //파일 업로드
    app.route('/v1/upload/file').post(upload.single('file'), uploadFile);
}

function uploadImage(req, res) {
    try {
        // multer가 이미지를 받지 못한 경우 예외 처리
        if (!req.file) {
            return res.status(400).json({ 'result': false, 'msg': '업로드된 이미지 파일이 없습니다.' });
        }

        // 프론트엔드 에디터에서 필요한 이미지 주소(URL) 생성
        // 위에서 uniqueSuffix + ext 구조로 저장한 파일명이 req.file.filename에 담깁니다.
        const imageUrl = `/uploads/${req.file.filename}`;

        // 프론트엔드 axios 요청 응답 구조(response.data.url)에 맞춰 리턴
        return res.json({
            'result': true,
            'url': imageUrl
        });

    } catch (error) {
        console.error('이미지 업로드 에러:', error);
        return res.status(500).json({ 'result': false, 'msg': '서버 오류가 발생했습니다.' });
    }
}

function uploadFile(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ 'result': false, 'msg': '업로드된 파일이 없습니다.' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;

        return res.json({
            'result': true,
            'url': fileUrl,
            'originalName': req.file.originalname   // ← 프론트에서 표시용 파일명 쓸 수 있게 추가
        });

    } catch (error) {
        console.error('파일 업로드 에러:', error);
        return res.status(500).json({ 'result': false, 'msg': '서버 오류가 발생했습니다.' });
    }
}
