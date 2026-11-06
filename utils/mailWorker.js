'use strict';
// 메일 큐 폴링 워커
//   - 5초 간격으로 PENDING 메일을 집어 SMTP 로 전송
//   - FOR UPDATE SKIP LOCKED 로 멀티 인스턴스 중복 발송 방지
//   - 실패 시 exponential backoff 재시도, 최대 3회

const fs = require('fs');
const path = require('path');
const mailModel = require('../model/mail.model');
const { getTransporter } = require('../config/mailer');

const BATCH_SIZE   = Number(process.env.MAIL_WORKER_BATCH_SIZE) || 10;
const INTERVAL_MS  = Number(process.env.MAIL_WORKER_INTERVAL_MS) || 5000;
const MAX_ATTEMPTS = Number(process.env.MAIL_WORKER_MAX_ATTEMPTS) || 3;
const BACKOFF_MS   = Number(process.env.MAIL_WORKER_BACKOFF_MS) || 2000;

let running = false;
let timer = null;

// mail_queue 행 → nodemailer sendMail 옵션으로 변환
async function toMailOptions(row, config) {
    const fromAddr = config.fromName
        ? `"${config.fromName}" <${config.fromEmail}>`
        : config.fromEmail;

    let attachments = [];
    if (row.attachments) {
        const raw = typeof row.attachments === 'string'
            ? JSON.parse(row.attachments)
            : row.attachments;
        if (Array.isArray(raw)) {
            attachments = raw
                .filter(a => a && a.path && fs.existsSync(a.path))
                .map(a => ({
                    filename: a.filename || path.basename(a.path),
                    path: a.path,
                    contentType: a.contentType || undefined,
                }));
        }
    }

    const opts = {
        from: fromAddr,
        to: row.toName ? `"${row.toName}" <${row.toEmail}>` : row.toEmail,
        subject: row.subject,
        html: row.bodyHtml || undefined,
        text: row.bodyText || undefined,
        attachments,
    };
    if (config.replyTo) opts.replyTo = config.replyTo;
    return opts;
}

async function sendOne(row) {
    const config = await mailModel.getEffectiveMailConfig(row.cIdx);
    if (!config || config.useFl !== 'Y' || !config.fromEmail) {
        await mailModel.markFailure(row.idx, 'mail_config missing or disabled', MAX_ATTEMPTS, BACKOFF_MS);
        return;
    }
    try {
        const transporter = await getTransporter(row.cIdx);
        const opts = await toMailOptions(row, config);
        const info = await transporter.sendMail(opts);
        await mailModel.markSent(row.idx, info.messageId);
    } catch (e) {
        console.error(`[mailWorker] send fail idx=${row.idx}`, e.message);
        await mailModel.markFailure(row.idx, e.message || String(e), MAX_ATTEMPTS, BACKOFF_MS);
    }
}

async function tick() {
    if (running) return;
    running = true;
    try {
        const rows = await mailModel.claimPendingMails(BATCH_SIZE);
        if (rows.length === 0) return;
        // 회사별 transporter 를 cIdx 로 가져다 쓰므로 각 메일을 독립적으로 처리
        await Promise.all(rows.map(r => sendOne(r)));
    } catch (e) {
        console.error('[mailWorker] tick err', e);
    } finally {
        running = false;
    }
}

exports.start = function () {
    if (process.env.MAIL_WORKER_ENABLED !== 'Y') {
        console.log('[mailWorker] disabled (MAIL_WORKER_ENABLED != Y)');
        return;
    }
    if (timer) return;
    console.log(`[mailWorker] start — interval=${INTERVAL_MS}ms, batch=${BATCH_SIZE}, maxAttempts=${MAX_ATTEMPTS}`);
    timer = setInterval(tick, INTERVAL_MS);
    // 부팅 직후 즉시 1회
    tick().catch(() => {});
};

exports.stop = function () {
    if (timer) {
        clearInterval(timer);
        timer = null;
        console.log('[mailWorker] stopped');
    }
};
