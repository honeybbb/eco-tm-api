'use strict';

const service = require('../service/auth.service');

module.exports = function (app) {
    //로그인
    app.route('/v1/auth/member').post(service.loginUser);

    //관리자 로그인
    app.route('/v1/auth/manager').post(service.loginManager);

    app.route('/v1/auth/refresh').post(service.refreshToken);

    // 관리자 메뉴 컬럼 설정
    app.route('/v1/auth/menu/setting').post(service.setMenuSettings);

    // 관리자 메뉴 컬럼 가져오기
    app.route('/v1/auth/menu/setting').get(service.getMenuSettings);
};
