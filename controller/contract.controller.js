'use strict';

const service = require("../service/contract.service")

module.exports = function (app) {
    //직원 근로계약서 작성
    app.route('/v1/contract/member/:mIdx').post(service.setMemberContract);

    //직원 근로계약서 조회
    app.route('/v1/contract/member/:mIdx').get(service.getMemberContract);

    //현장 계약서 작성
    app.route('/v1/contract/site/:sIdx').post(service.setSiteContract);
}
