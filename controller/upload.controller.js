'use strict';
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { execFile } = require('child_process');
const os = require('os');
const crypto = require('crypto');
const memberService = require("../service/member.service");
const workService = require("../service/work.service");
const contractService = require("../service/contract.service");
const settleService = require("../service/settle.service");

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
const uploadMemory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB 제한
});

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

    //정산서 양식 업로드
    app.route('/v1/upload/settle/template').post(upload.single('file'), settleService.uploadSettleTemplate);

    app.route('/v1/download/settle/template').post(settleService.downloadSettleTemplate);

    app.route('/v1/excel-to-pdf').post(uploadMemory.single('file'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ result: false, msg: '파일이 없습니다.' });
        }

        // 요청마다 격리된 임시 폴더 사용 (동시 요청 충돌 방지)
        const workDir = path.join(os.tmpdir(), 'xlsx2pdf-' + crypto.randomUUID());
        const inputPath = path.join(workDir, 'input.xlsx');

        try {
            fs.mkdirSync(workDir, { recursive: true });
            fs.writeFileSync(inputPath, req.file.buffer);

            await convertToPdf(inputPath, workDir);

            const outputPath = path.join(workDir, 'input.pdf');
            if (!fs.existsSync(outputPath)) {
                throw new Error('PDF 생성 실패: 출력 파일 없음');
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.sendFile(outputPath, (err) => {
                // 응답 후 임시 파일 정리
                fs.rm(workDir, { recursive: true, force: true }, () => {});
                if (err) console.error('파일 전송 오류:', err);
            });
        } catch (err) {
            console.error('PDF 변환 오류:', err);
            fs.rm(workDir, { recursive: true, force: true }, () => {});
            res.status(500).json({ result: false, msg: 'PDF 변환 중 오류가 발생했습니다.' });
        }
    });

    app.route('/v1/convert-saved-file').post(async (req, res) => {
        // 1. 이미 저장된 파일의 경로
        const inputPath = path.join(__dirname, '../uploads', '1789365197581_467163209.xlsx');
        const outDir = path.join(__dirname, '../uploads');
        const outputPath = path.join(outDir, 'saved_excel.pdf');

        try {
            // 2. 바로 변환 실행
            await convertToPdf(inputPath, outDir);

            // 3. 변환된 PDF 전송 (끝)
            res.sendFile(outputPath);
        } catch (err) {
            res.status(500).json({ msg: '변환 실패' });
        }
    });

    function convertToPdf(inputPath, outDir, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            let sofficePath = 'soffice';

            if (os.platform() === 'win32') {
                sofficePath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
            }

            // 충돌 방지를 위해 임시 폴더 내에 독립적인 LibreOffice 프로필 경로 설정
            // (Windows 환경에서는 경로의 역슬래시를 슬래시로 변경해야 LibreOffice가 인식합니다)
            const profilePath = path.join(outDir, 'profile').replace(/\\/g, '/');

            const child = execFile(
                sofficePath,
                [
                    '--headless',               // 백그라운드 실행
                    '--nologo',                 // 로고 숨김
                    '--nofirststartwizard',     // 초기 설정 마법사 무시
                    `-env:UserInstallation=file:///${profilePath}`, // 🌟 핵심: 독립적인 프로필 강제 적용
                    '--convert-to', 'pdf',
                    '--outdir', outDir,
                    inputPath
                ],
                { timeout: timeoutMs },
                (error, stdout, stderr) => {
                    if (error) {
                        console.error('LibreOffice Error Output:', stderr); // 에러 발생 시 상세 로그 출력
                        return reject(error);
                    }
                    resolve(stdout);
                }
            );
        });
    }
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