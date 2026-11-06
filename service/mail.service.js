'use strict';
const path = require('path');
const fs = require('fs');
const mailModel = require('../model/mail.model');
const { invalidateTransporter } = require('../config/mailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// multer 로 업로드된 파일 + 기존 서버 저장 PDF 경로를 하나의 attachments 배열로 통합
function buildAttachments(req) {
    const list = [];

    // 1) 기존 서버 저장 파일 경로 (예: 정산서 PDF)
    const raw = req.body.attachPaths;
    if (raw) {
        let arr = [];
        try {
            arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch { arr = []; }
        if (Array.isArray(arr)) {
            for (const p of arr) {
                if (!p) continue;
                const abs = path.join(__dirname, '..', String(p).replace(/^\/+/, ''));
                if (fs.existsSync(abs)) {
                    list.push({
                        filename: path.basename(abs),
                        path: abs,
                        contentType: null,
                    });
                }
            }
        }
    }

    // 2) 새로 업로드된 파일 (multer)
    if (req.files && req.files.length) {
        for (const f of req.files) {
            // multer가 originalname을 latin1로 보관해 한글이 모지바케로 저장되는 이슈 보정
            const name = Buffer.from(f.originalname, 'latin1').toString('utf8');
            list.push({
                filename: name,
                path: f.path,
                contentType: f.mimetype,
            });
        }
    }

    return list;
}

/* =========================================================================
 *  발송 요청 (큐에 적재)
 * ========================================================================= */

// 단건 발송 (multipart; 첨부 업로드 지원)
exports.sendMail = async function (req, res) {
    const cIdx = req.user.cIdx;
    const regMIdx = req.user.idx;

    const toEmail = req.body.toEmail;
    const toName = req.body.toName || null;
    const subject = req.body.subject;
    const bodyHtml = req.body.bodyHtml || null;
    const bodyText = req.body.bodyText || null;
    const refType = req.body.refType || null;
    const refIdx = req.body.refIdx ? Number(req.body.refIdx) : null;

    if (!toEmail || !EMAIL_RE.test(toEmail)) {
        return res.status(400).json({ result: false, msg: '수신자 이메일이 올바르지 않습니다.' });
    }
    if (!subject) {
        return res.status(400).json({ result: false, msg: '제목이 필요합니다.' });
    }

    const config = await mailModel.getEffectiveMailConfig(cIdx);
    if (!config || config.useFl !== 'Y' || !config.fromEmail) {
        return res.status(400).json({ result: false, msg: '회사 발신 메일 설정이 없습니다.' });
    }

    const attachments = buildAttachments(req);

    try {
        const id = await mailModel.enqueueMail({
            cIdx, toEmail, toName, subject, bodyHtml, bodyText,
            attachments, refType, refIdx, regMIdx,
        });
        res.json({ result: true, data: { idx: id, status: 'PENDING' } });
    } catch (e) {
        console.error('sendMail err', e);
        res.status(500).json({ result: false, msg: '서버 에러 발생' });
    }
};

// 다건 발송 (JSON; 기존 서버 저장 PDF 경로만 참조)
exports.sendMailBulk = async function (req, res) {
    const cIdx = req.user.cIdx;
    const regMIdx = req.user.idx;

    const commonSubject = req.body.subject || '';
    const commonBodyHtml = req.body.bodyHtml || null;
    const commonBodyText = req.body.bodyText || null;
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (items.length === 0) {
        return res.status(400).json({ result: false, msg: 'items 가 비어 있습니다.' });
    }

    const config = await mailModel.getEffectiveMailConfig(cIdx);
    if (!config || config.useFl !== 'Y' || !config.fromEmail) {
        return res.status(400).json({ result: false, msg: '회사 발신 메일 설정이 없습니다.' });
    }

    // 각 item 유효성 검사 + attachments 구조 통일
    const prepared = [];
    const skipped = [];
    for (const it of items) {
        if (!it.toEmail || !EMAIL_RE.test(it.toEmail)) {
            skipped.push({ item: it, reason: 'invalid email' });
            continue;
        }
        const subj = it.subject || commonSubject;
        if (!subj) {
            skipped.push({ item: it, reason: 'missing subject' });
            continue;
        }
        const atts = Array.isArray(it.attachPaths)
            ? it.attachPaths
                .filter(Boolean)
                .map(p => {
                    const abs = path.join(__dirname, '..', String(p).replace(/^\/+/, ''));
                    return fs.existsSync(abs)
                        ? { filename: path.basename(abs), path: abs, contentType: null }
                        : null;
                })
                .filter(Boolean)
            : [];
        prepared.push({
            cIdx,
            toEmail: it.toEmail,
            toName: it.toName || null,
            subject: subj,
            bodyHtml: it.bodyHtml || commonBodyHtml,
            bodyText: it.bodyText || commonBodyText,
            attachments: atts,
            refType: it.refType || null,
            refIdx: it.refIdx || null,
            regMIdx,
        });
    }

    try {
        const result = await mailModel.enqueueMailBulk(prepared);
        res.json({
            result: true,
            data: { enqueued: result.enqueued, skipped: skipped.length, skippedDetails: skipped },
        });
    } catch (e) {
        console.error('sendMailBulk err', e);
        res.status(500).json({ result: false, msg: '서버 에러 발생' });
    }
};

// 테스트 발송: 수신자를 요청자 본인 이메일로 강제
exports.sendMailTest = async function (req, res) {
    const cIdx = req.user.cIdx;
    const regMIdx = req.user.idx;
    const toEmail = req.user.email || req.body.toEmail;

    if (!toEmail || !EMAIL_RE.test(toEmail)) {
        return res.status(400).json({ result: false, msg: '테스트 수신자 이메일이 없습니다.' });
    }

    const config = await mailModel.getEffectiveMailConfig(cIdx);
    if (!config || !config.fromEmail) {
        return res.status(400).json({ result: false, msg: '회사 발신 메일 설정이 없습니다.' });
    }

    try {
        const id = await mailModel.enqueueMail({
            cIdx,
            toEmail,
            toName: '테스트 수신자',
            subject: `[테스트] ${req.body.subject || '메일 테스트'}`,
            bodyHtml: req.body.bodyHtml || '<p>테스트 메일입니다.</p>',
            attachments: buildAttachments(req),
            regMIdx,
        });
        res.json({ result: true, data: { idx: id } });
    } catch (e) {
        console.error('sendMailTest err', e);
        res.status(500).json({ result: false, msg: '서버 에러 발생' });
    }
};

/* =========================================================================
 *  큐 조회 / 재시도 / 취소
 * ========================================================================= */

exports.getMailList = async function (req, res) {
    const cIdx = req.user.cIdx;
    const status = req.query.status || null;
    const startDt = req.query.startDt || null;
    const endDt = req.query.endDt || null;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const refType = req.query.refType || null;
    const refIdx = req.query.refIdx ? Number(req.query.refIdx) : null;

    const list = await mailModel.getMailList(cIdx, status, startDt, endDt, limit, offset, refType, refIdx);
    res.json({ result: true, data: list });
};

exports.getMailDetail = async function (req, res) {
    const cIdx = req.user.cIdx;
    const idx = Number(req.params.idx);
    const row = await mailModel.getMailById(cIdx, idx);
    if (!row) return res.status(404).json({ result: false, msg: '해당 메일을 찾을 수 없습니다.' });
    res.json({ result: true, data: row });
};

exports.retryMail = async function (req, res) {
    const cIdx = req.user.cIdx;
    const idx = Number(req.params.idx);
    const result = await mailModel.requeueMail(cIdx, idx);
    const affected = result?.affectedRows ?? 0;
    if (affected === 0) {
        return res.status(400).json({ result: false, msg: '재시도 가능한 상태가 아닙니다.' });
    }
    res.json({ result: true, data: { idx, status: 'PENDING' } });
};

exports.cancelMail = async function (req, res) {
    const cIdx = req.user.cIdx;
    const idx = Number(req.params.idx);
    const result = await mailModel.cancelMail(cIdx, idx);
    const affected = result?.affectedRows ?? 0;
    if (affected === 0) {
        return res.status(400).json({ result: false, msg: '취소 가능한 상태가 아닙니다.' });
    }
    res.json({ result: true, data: { idx, status: 'CANCELED' } });
};

/* =========================================================================
 *  발신 설정 (cIdx 별 fromEmail)
 * ========================================================================= */

exports.getConfig = async function (req, res) {
    const cIdx = req.user.cIdx;
    const row = await mailModel.getMailConfig(cIdx);
    res.json({ result: true, data: row });
};

exports.updateConfig = async function (req, res) {
    const cIdx = req.user.cIdx;
    const fromEmail = req.body.fromEmail;
    const fromName = req.body.fromName || '';
    const replyTo = req.body.replyTo || null;
    const useFl = req.body.useFl === 'N' ? 'N' : 'Y';
    const smtpHost = req.body.smtpHost || 'smtp.naver.com';
    const smtpPort = Number(req.body.smtpPort) || 465;
    const smtpUser = req.body.smtpUser || '';
    // smtpPass 가 빈값이면 기존 암호 유지 (모델 upsert 가 처리)
    const smtpPass = req.body.smtpPass ? String(req.body.smtpPass) : null;
    const settleSubject = req.body.settleSubject || null;
    const settleBodyHtml = req.body.settleBodyHtml || null;

    if (!fromEmail || !EMAIL_RE.test(fromEmail)) {
        return res.status(400).json({ result: false, msg: '발신 이메일이 올바르지 않습니다.' });
    }
    if (smtpUser && !EMAIL_RE.test(smtpUser)) {
        return res.status(400).json({ result: false, msg: 'SMTP 계정이 올바르지 않습니다.' });
    }
    const result = await mailModel.upsertMailConfig(cIdx, {
        fromEmail, fromName, replyTo, useFl,
        smtpHost, smtpPort, smtpUser, smtpPass,
        settleSubject, settleBodyHtml,
    });
    // 자격증명/호스트 변경이 즉시 반영되도록 캐시된 transporter 폐기
    invalidateTransporter(cIdx);
    res.json({ result: true, data: result });
};
