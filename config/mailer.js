'use strict';
// SMTP 트랜스포터 (회사별 자격증명 지원)
//   - cIdx 를 받아 DB(new_tb_mail_config) 의 자격증명으로 transporter 생성
//   - 자격증명이 없으면 .env (MAIL_SMTP_*) 로 폴백 (레거시 단일 테넌트)
//   - cIdx 별로 캐싱 — 설정 변경 시 invalidateTransporter(cIdx) 로 무효화

const nodemailer = require('nodemailer');
const mailModel = require('../model/mail.model');

const cache = new Map(); // cIdx -> transporter

function build(creds) {
    return nodemailer.createTransport({
        host: creds.host,
        port: creds.port,
        secure: creds.port === 465,   // 465 → SSL, 587 → STARTTLS
        auth: { user: creds.user, pass: creds.pass },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
    });
}

exports.getTransporter = async function (cIdx) {
    if (cache.has(cIdx)) return cache.get(cIdx);
    const creds = await mailModel.getEffectiveSmtpCreds(cIdx);
    if (!creds) {
        throw new Error(`SMTP 자격증명이 없습니다 (cIdx=${cIdx}). mail_config 또는 .env 를 확인하세요.`);
    }
    const t = build(creds);
    cache.set(cIdx, t);
    return t;
};

exports.invalidateTransporter = function (cIdx) {
    const t = cache.get(cIdx);
    if (t && typeof t.close === 'function') {
        try { t.close(); } catch (_) { /* noop */ }
    }
    cache.delete(cIdx);
};

// 테스트/연결 확인용
exports.verify = async function (cIdx) {
    const t = await exports.getTransporter(cIdx);
    return t.verify();
};
