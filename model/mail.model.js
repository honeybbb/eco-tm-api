'use strict';
const pool = require('../config/mysql');
const { encrypt, decrypt } = require('../utils/crypto');

/* =========================================================================
 *  mail_config  (cIdx 별 발신 설정)
 * ========================================================================= */

// 외부 노출용: smtpPassEnc 는 절대 반환하지 않음 (hasSmtpPass 로만 존재 여부 표시)
exports.getMailConfig = async function (cIdx) {
    const sql = `select cIdx, fromEmail, fromName, replyTo, useFl,
                        smtpHost, smtpPort, smtpUser,
                        (smtpPassEnc IS NOT NULL) as hasSmtpPass,
                        settleSubject, settleBodyHtml
                 from new_tb_mail_config where cIdx = ?`;
    try {
        const [res] = await pool.query(sql, [cIdx]);
        if (!res[0]) return null;
        const row = res[0];
        row.hasSmtpPass = !!row.hasSmtpPass;
        return row;
    } catch (e) {
        console.error('getMailConfig err', e);
        return null;
    }
};

// DB 설정이 없으면 .env 의 발신 주소를 사용 (A안 fallback)
exports.getEffectiveMailConfig = async function (cIdx) {
    const row = await exports.getMailConfig(cIdx);
    if (row && row.useFl === 'Y' && row.fromEmail) return row;
    if (row && row.useFl === 'N') return null; // 명시적 비활성화는 fallback 금지

    const envFrom = process.env.MAIL_FROM_EMAIL || process.env.MAIL_SMTP_USER || '';
    if (!envFrom || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(envFrom)) return null;
    return {
        cIdx,
        fromEmail: envFrom,
        fromName: process.env.MAIL_FROM_NAME || '',
        replyTo: process.env.MAIL_REPLY_TO || null,
        useFl: 'Y',
    };
};

// 내부(mailer) 전용: 복호화된 SMTP 자격증명 반환.
//   1순위: DB(cIdx)   2순위: .env (레거시 단일 테넌트 호환)
exports.getEffectiveSmtpCreds = async function (cIdx) {
    const sql = `select smtpHost, smtpPort, smtpUser, smtpPassEnc
                 from new_tb_mail_config where cIdx = ?`;
    try {
        const [rows] = await pool.query(sql, [cIdx]);
        const row = rows[0];
        if (row && row.smtpUser && row.smtpPassEnc) {
            return {
                host: row.smtpHost,
                port: Number(row.smtpPort),
                user: row.smtpUser,
                pass: decrypt(row.smtpPassEnc),
                source: 'db',
            };
        }
    } catch (e) {
        console.error('getEffectiveSmtpCreds db err', e);
    }

    const host = process.env.MAIL_SMTP_HOST;
    const port = Number(process.env.MAIL_SMTP_PORT) || 587;
    const user = process.env.MAIL_SMTP_USER;
    const pass = process.env.MAIL_SMTP_PASS;
    if (host && user && pass) {
        return { host, port, user, pass, source: 'env' };
    }
    return null;
};

exports.upsertMailConfig = async function (cIdx, fields) {
    // fields: fromEmail, fromName, replyTo, useFl, smtpHost, smtpPort, smtpUser,
    //         smtpPass(평문, 생략 시 기존값 유지), settleSubject, settleBodyHtml
    const passEnc = fields.smtpPass ? encrypt(fields.smtpPass) : null;

    // smtpPassEnc 는 전달값이 null 이면 기존 값을 유지 (평문 미입력 시 패스워드 보존)
    const sql = `
        insert into new_tb_mail_config
            (cIdx, fromEmail, fromName, replyTo, useFl,
             smtpHost, smtpPort, smtpUser, smtpPassEnc,
             settleSubject, settleBodyHtml)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on duplicate key update
            fromEmail      = values(fromEmail),
            fromName       = values(fromName),
            replyTo        = values(replyTo),
            useFl          = values(useFl),
            smtpHost       = values(smtpHost),
            smtpPort       = values(smtpPort),
            smtpUser       = values(smtpUser),
            smtpPassEnc    = IF(values(smtpPassEnc) IS NULL, smtpPassEnc, values(smtpPassEnc)),
            settleSubject  = values(settleSubject),
            settleBodyHtml = values(settleBodyHtml),
            modDt          = CURRENT_TIMESTAMP
    `;
    try {
        const [res] = await pool.query(sql, [
            cIdx,
            fields.fromEmail,
            fields.fromName || '',
            fields.replyTo || null,
            fields.useFl || 'Y',
            fields.smtpHost || 'smtp.naver.com',
            Number(fields.smtpPort) || 465,
            fields.smtpUser || '',
            passEnc,
            fields.settleSubject || null,
            fields.settleBodyHtml || null,
        ]);
        return res;
    } catch (e) {
        console.error('upsertMailConfig err', e);
        return { data: '-9999' };
    }
};

/* =========================================================================
 *  mail_queue  (발송 큐)
 * ========================================================================= */

// 단건 enqueue
exports.enqueueMail = async function (payload) {
    const sql = `
        insert into new_tb_mail_queue
        (cIdx, toEmail, toName, subject, bodyHtml, bodyText, attachments,
         status, scheduledAt, refType, refIdx, regMIdx)
        values (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
    `;
    const params = [
        payload.cIdx,
        payload.toEmail,
        payload.toName || null,
        payload.subject,
        payload.bodyHtml || null,
        payload.bodyText || null,
        payload.attachments ? JSON.stringify(payload.attachments) : null,
        payload.scheduledAt || new Date(),
        payload.refType || null,
        payload.refIdx || null,
        payload.regMIdx || null,
    ];
    try {
        const [res] = await pool.query(sql, params);
        return res.insertId;
    } catch (e) {
        console.error('enqueueMail err', e);
        throw e;
    }
};

// 다건 enqueue (트랜잭션)
exports.enqueueMailBulk = async function (items) {
    if (!Array.isArray(items) || items.length === 0) return { enqueued: 0, ids: [] };
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const ids = [];
        const sql = `
            insert into new_tb_mail_queue
            (cIdx, toEmail, toName, subject, bodyHtml, bodyText, attachments,
             status, scheduledAt, refType, refIdx, regMIdx)
            values (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
        `;
        for (const p of items) {
            const [res] = await conn.query(sql, [
                p.cIdx, p.toEmail, p.toName || null, p.subject,
                p.bodyHtml || null, p.bodyText || null,
                p.attachments ? JSON.stringify(p.attachments) : null,
                p.scheduledAt || new Date(),
                p.refType || null, p.refIdx || null, p.regMIdx || null,
            ]);
            ids.push(res.insertId);
        }
        await conn.commit();
        return { enqueued: ids.length, ids };
    } catch (e) {
        await conn.rollback();
        console.error('enqueueMailBulk err', e);
        throw e;
    } finally {
        conn.release();
    }
};

// 큐 폴링: PENDING 중 발송 예정 시각이 지난 N건을 SELECT ... FOR UPDATE 로 집음
// MySQL 5.7 호환: SKIP LOCKED 는 8.0+ 전용이라 사용하지 않음. 단일 워커 전제이며,
// 멀티 워커로 확장할 경우 짧은 lock 대기만 발생함.
exports.claimPendingMails = async function (limit) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `select * from new_tb_mail_queue
             where status = 'PENDING' and scheduledAt <= NOW()
             order by scheduledAt asc, idx asc
             limit ?
             for update`,
            [limit]
        );
        if (rows.length === 0) {
            await conn.commit();
            return [];
        }
        const ids = rows.map(r => r.idx);
        await conn.query(
            `update new_tb_mail_queue set status = 'SENDING', modDt = NOW() where idx in (?)`,
            [ids]
        );
        await conn.commit();
        return rows;
    } catch (e) {
        await conn.rollback();
        console.error('claimPendingMails err', e);
        return [];
    } finally {
        conn.release();
    }
};

exports.markSent = async function (idx, sesMessageId) {
    const sql = `update new_tb_mail_queue
                 set status = 'SENT', sentAt = NOW(), sesMessageId = ?, lastError = null, modDt = NOW()
                 where idx = ?`;
    try {
        const [res] = await pool.query(sql, [sesMessageId || null, idx]);
        return res;
    } catch (e) {
        console.error('markSent err', e);
        return { data: '-9999' };
    }
};

// 재시도 가능 여부에 따라 PENDING 재대기 or FAILED 확정
exports.markFailure = async function (idx, errMsg, maxAttempts, backoffMs) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `select attempts from new_tb_mail_queue where idx = ? for update`,
            [idx]
        );
        if (rows.length === 0) {
            await conn.commit();
            return null;
        }
        const nextAttempts = (rows[0].attempts || 0) + 1;
        if (nextAttempts >= maxAttempts) {
            await conn.query(
                `update new_tb_mail_queue
                 set status = 'FAILED', attempts = ?, lastError = ?, modDt = NOW()
                 where idx = ?`,
                [nextAttempts, String(errMsg).slice(0, 2000), idx]
            );
        } else {
            // exponential backoff: backoffMs * 2^(attempt-1)
            const delay = backoffMs * Math.pow(2, nextAttempts - 1);
            await conn.query(
                `update new_tb_mail_queue
                 set status = 'PENDING', attempts = ?, lastError = ?,
                     scheduledAt = DATE_ADD(NOW(), INTERVAL ? SECOND), modDt = NOW()
                 where idx = ?`,
                [nextAttempts, String(errMsg).slice(0, 2000), Math.floor(delay / 1000), idx]
            );
        }
        await conn.commit();
        return nextAttempts;
    } catch (e) {
        await conn.rollback();
        console.error('markFailure err', e);
        return null;
    } finally {
        conn.release();
    }
};

exports.getMailById = async function (cIdx, idx) {
    const sql = "select * from new_tb_mail_queue where cIdx = ? and idx = ?";
    try {
        const [res] = await pool.query(sql, [cIdx, idx]);
        return res[0] || null;
    } catch (e) {
        console.error('getMailById err', e);
        return null;
    }
};

exports.getMailList = async function (cIdx, status, startDt, endDt, limit, offset, refType, refIdx) {
    let sql = `select idx, toEmail, toName, subject, status, attempts, lastError,
                      scheduledAt, sentAt, regDt, refType, refIdx
               from new_tb_mail_queue
               where cIdx = ?`;
    const params = [cIdx];
    if (status) { sql += ' and status = ?'; params.push(status); }
    if (startDt) { sql += ' and regDt >= ?'; params.push(startDt); }
    if (endDt)   { sql += ' and regDt < DATE_ADD(?, INTERVAL 1 DAY)'; params.push(endDt); }
    if (refType) { sql += ' and refType = ?'; params.push(refType); }
    if (refIdx)  { sql += ' and refIdx = ?'; params.push(refIdx); }
    sql += ' order by regDt desc, idx desc limit ? offset ?';
    params.push(Number(limit) || 50, Number(offset) || 0);
    try {
        const [res] = await pool.query(sql, params);
        return res;
    } catch (e) {
        console.error('getMailList err', e);
        return [];
    }
};

exports.requeueMail = async function (cIdx, idx) {
    const sql = `update new_tb_mail_queue
                 set status = 'PENDING', attempts = 0, lastError = null,
                     scheduledAt = NOW(), modDt = NOW()
                 where cIdx = ? and idx = ? and status in ('FAILED', 'CANCELED')`;
    try {
        const [res] = await pool.query(sql, [cIdx, idx]);
        return res;
    } catch (e) {
        console.error('requeueMail err', e);
        return { data: '-9999' };
    }
};

exports.cancelMail = async function (cIdx, idx) {
    const sql = `update new_tb_mail_queue
                 set status = 'CANCELED', modDt = NOW()
                 where cIdx = ? and idx = ? and status = 'PENDING'`;
    try {
        const [res] = await pool.query(sql, [cIdx, idx]);
        return res;
    } catch (e) {
        console.error('cancelMail err', e);
        return { data: '-9999' };
    }
};

/* =========================================================================
 *  mail_log  (SES/SNS 이벤트)
 * ========================================================================= */

exports.insertMailLog = async function (queueIdx, sesMessageId, eventType, payload) {
    const sql = `insert into new_tb_mail_log (queueIdx, sesMessageId, eventType, payload)
                 values (?, ?, ?, ?)`;
    try {
        const [res] = await pool.query(sql, [
            queueIdx || null, sesMessageId || null, eventType,
            payload ? JSON.stringify(payload) : null,
        ]);
        return res;
    } catch (e) {
        console.error('insertMailLog err', e);
        return { data: '-9999' };
    }
};
