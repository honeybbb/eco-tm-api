const model = require("../model/favorite.model");

// 즐겨찾기 는 관리자(new_tb_manager) 전용 기능이다.
const requireAdmin = (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ result: false, msg: '관리자 전용 기능입니다.' });
        return false;
    }
    return true;
};

exports.getFavoriteList = async function (req, res) {
    if (!requireAdmin(req, res)) return;
    try {
        const result = await model.getFavoriteList(req.user.cIdx, req.user.id);
        res.json({ result: true, data: result });
    } catch (e) {
        console.error(e);
        res.status(500).json({ result: false, msg: '즐겨찾기 조회 실패' });
    }
};

exports.addFavorite = async function (req, res) {
    if (!requireAdmin(req, res)) return;
    const path = (req.body?.path || '').trim();
    const title = (req.body?.title || '').trim();

    if (!path || !title) {
        return res.json({ result: false, msg: 'path, title 은 필수입니다.' });
    }
    if (path === '/') {
        return res.json({ result: false, msg: '홈 탭은 즐겨찾기 대상이 아닙니다.' });
    }

    try {
        const result = await model.addFavorite(req.user.cIdx, req.user.id, path, title);
        res.json({ result: true, data: result });
    } catch (e) {
        console.error(e);
        res.json({ result: false, msg: '즐겨찾기 추가 실패' });
    }
};

exports.removeFavorite = async function (req, res) {
    if (!requireAdmin(req, res)) return;
    const path = (req.body?.path || req.query?.path || '').trim();

    if (!path) {
        return res.json({ result: false, msg: 'path 는 필수입니다.' });
    }

    try {
        const result = await model.removeFavorite(req.user.cIdx, req.user.id, path);
        res.json({ result: true, data: result });
    } catch (e) {
        console.error(e);
        res.json({ result: false, msg: '즐겨찾기 삭제 실패' });
    }
};

exports.reorderFavorites = async function (req, res) {
    if (!requireAdmin(req, res)) return;
    const items = req.body?.items;
    if (!Array.isArray(items)) {
        return res.json({ result: false, msg: 'items 는 배열이어야 합니다.' });
    }
    try {
        const result = await model.reorderFavorites(req.user.cIdx, req.user.id, items);
        res.json({ result: true, data: result });
    } catch (e) {
        console.error(e);
        res.json({ result: false, msg: '즐겨찾기 순서 저장 실패' });
    }
};
