const bcrypt = require('bcrypt');
const crypto = require('crypto');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

// 1. 기존 설정 키 (길이가 32자가 아니어도 상관없습니다)
const RAW_KEY = process.env.RRN_ENCRYPTION_KEY || 'ECO_PERSONAL_NUMBER';

// 2. ✨ 핵심: 입력된 키를 SHA-256으로 해싱하여 "무조건 32바이트(256비트) 버퍼"로 고정 생성!
const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(RAW_KEY)).digest();
const IV_LENGTH = 16;

exports.hashPassword = async function (plain)  {
    if (!plain || typeof plain !== 'string') throw new Error('invalid password');
    return bcrypt.hash(plain, ROUNDS);
};

exports.verifyPassword = async (plain, hashed) => {
    if (!hashed) return false;
    return bcrypt.compare(plain, hashed);
};

// 암호화 함수
exports.encryptRRN = function(text) {
    if (!text) return null;
    let iv = crypto.randomBytes(IV_LENGTH);
    // ENCRYPTION_KEY가 이미 Buffer 타입이므로 Buffer.from() 생략
    let cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// 복호화 함수
exports.decryptRRN = function(text) {
    if (!text) return null;
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

// 깨진 문자열(ISO-8859-1)을 정상 한글(UTF-8)로 복구하는 헬퍼 함수
exports.decodeLatin1ToUtf8 = (str) => {
    if (!str) return '';

    // 깨진 문자열 특성상 Latin-1 보충 구역(ë, ì, í 등)의 문자가 포함됩니다.
    // 이미 정상적인 한글("별내")인 문자열은 변환하면 오히려 깨지므로 패턴 검사 후 변환합니다.
    const isBroken = /[\u00c0-\u00ff]/.test(str);

    if (isBroken) {
        try {
            return Buffer.from(str, 'latin1').toString('utf8');
        } catch (e) {
            console.error("인코딩 변환 실패:", e);
            return str;
        }
    }
    return str;
};
