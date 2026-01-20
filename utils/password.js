const bcrypt = require('bcrypt');
const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

exports.hashPassword = async function (plain)  {
    // 입력 검증
    if (!plain || typeof plain !== 'string') throw new Error('invalid password');
    return bcrypt.hash(plain, ROUNDS);
};

exports.verifyPassword = async (plain, hashed) => {
    if (!hashed) return false;
    return bcrypt.compare(plain, hashed);
};
