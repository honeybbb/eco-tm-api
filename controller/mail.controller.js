'use strict';
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const service = require('../service/mail.service');

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const unique = Date.now() + '_' + Math.round(Math.random() * 1e9);
        cb(null, unique + ext);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB (SMTP 호환 범위)
});

module.exports = function (app) {
    // 단건 발송 (multipart; 첨부파일 업로드 지원)
    app.route('/v1/mail/send')
        .post(upload.array('attachFiles', 10), service.sendMail);

    // 다건 발송 (JSON; 서버 저장 PDF 경로 참조)
    app.route('/v1/mail/send/bulk').post(service.sendMailBulk);

    // 테스트 발송 (본인에게)
    app.route('/v1/mail/send/test')
        .post(upload.array('attachFiles', 10), service.sendMailTest);

    // 발송 현황 (리스트/상세)
    app.route('/v1/mail/queue').get(service.getMailList);
    app.route('/v1/mail/queue/:idx').get(service.getMailDetail);

    // 재시도 / 취소
    app.route('/v1/mail/queue/:idx/retry').post(service.retryMail);
    app.route('/v1/mail/queue/:idx/cancel').post(service.cancelMail);

    // 회사별 발신 설정
    app.route('/v1/mail/config')
        .get(service.getConfig)
        .put(service.updateConfig);
};
