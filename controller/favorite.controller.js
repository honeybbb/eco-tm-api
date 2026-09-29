'use strict';
const service = require("../service/favorite.service");

module.exports = function (app) {
    /* ======= 관리자 탭 즐겨찾기 ======= */

    // 목록 조회
    app.route('/v1/favorite/list').get(service.getFavoriteList);

    // 추가
    app.route('/v1/favorite').post(service.addFavorite);

    // 삭제 (body.path 또는 query.path)
    app.route('/v1/favorite').delete(service.removeFavorite);

    // 순서 저장 { items: [{ path, sort }] }
    app.route('/v1/favorite/reorder').put(service.reorderFavorites);
};
