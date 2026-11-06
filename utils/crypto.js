'use strict';
// AES-256-GCM 암·복호화 헬퍼
//   마스터 키: process.env.MAIL_ENC_KEY (32바이트, hex 64자)
//     발급: openssl rand -hex 32
//   저장 형식: iv(12B) || authTag(16B) || ciphertext  → VARBINARY 로 그대로 저장

const crypto = require('crypto');

const IV_LEN  = 12;
const TAG_LEN = 16;

let cachedKey = null;
function getKey() {
    if (cachedKey) return cachedKey;
    const hex = process.env.MAIL_ENC_KEY;
    if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
        throw new Error('MAIL_ENC_KEY 가 설정되지 않았거나 32바이트 hex가 아닙니다.');
    }
    cachedKey = Buffer.from(hex, 'hex');
    return cachedKey;
}

// 평문 문자열 → Buffer (iv||tag||cipher)
exports.encrypt = function (plaintext) {
    if (plaintext == null || plaintext === '') return null;
    const key = getKey();
    const iv  = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]);
};

// Buffer (iv||tag||cipher) → 평문 문자열
exports.decrypt = function (buf) {
    if (!buf || !Buffer.isBuffer(buf) || buf.length < IV_LEN + TAG_LEN + 1) return null;
    const key = getKey();
    const iv     = buf.subarray(0, IV_LEN);
    const tag    = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const cipher = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(cipher), decipher.final()]);
    return dec.toString('utf8');
};
