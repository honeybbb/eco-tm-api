'use strict';

const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: '토큰이 만료되었습니다.' });
        }
        return res.status(403).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }
};

// 관리자 전용
const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }
        next();
    });
};

module.exports = { verifyToken, verifyAdmin };
