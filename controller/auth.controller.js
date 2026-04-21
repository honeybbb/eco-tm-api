'use strict';

const service = require('../service/auth.service');

module.exports = function (app) {
    //로그인
    app.route('/v1/auth/member').post(service.loginUser);

    //관리자 로그인
    app.route('/v1/auth/manager').post(service.loginManager);

    app.route('/v1/auth/refresh').post(service.refreshToken);
};
