const etcModel = require("../model/etc.model");

exports.getMenus = async function (req, res) {
    let companyNo = req.params.companyNo,
        isMaster = req.query.isMaster == 'Y'? true:false;

    try {
        let result = await etcModel.getMenus(companyNo, isMaster);

        res.json({'result': true, 'data': result})

    } catch(err) {
        res.json({'result': false, 'msg': '관리자 메뉴를 찾을 수 없습니다.'})
    }
}

exports.getNoticeList = async function (req, res) {
    let result = await etcModel.getNoticeList();

    res.json({'result': true, 'data': result})
}

exports.getNoticeData = async function(req, res) {
    let idx = req.params.idx;

    let result = await etcModel.getNoticeData(idx);

    res.json({'result': true, 'data': result})
}

exports.setNotice = async function (req, res) {
    let must = req.body.must,
        type = req.body.type,
        target = req.body.target,
        title = req.body.title,
        content = req.body.content,
        regDt = new Date();

    try {
        let result = await etcModel.setNotice(must, type, target, title, content, regDt);

        res.json({'result': true, 'data': result})

    }catch(err) {
        res.json({'result': false, 'msg': '공지 등록에 실패했습니다.'})
    }

}

exports.removeNotice = async function (req, res) {
    let idx = req.query.idx,
        author = req.query.author;

    try {
        let result = await etcModel.removeNotice(idx, author);

        res.json({'result': true, 'data': result})

    }catch(err) {
        res.json({'result': false, 'msg': '공지 삭제에 실패했습니다.'})
    }
}

exports.getBaseCode = async function (req, res) {
    let cIdx = req.params.cIdx;
    if(cIdx == ':cIdx') return res.json({'result': false, 'msg':'회사 정보가 없습니다.'});
    let result = await etcModel.getBaseCode(cIdx);

    res.json({'result': true, 'data': result})

}

exports.getGroupCode = async function (req, res) {
    let groupCd = req.params.groupCd;
    if(groupCd == ':groupCd') return res.json({'result': false, 'msg':'그룹코드가 없습니다.'});

    let result = await etcModel.getGroupCode(groupCd);

    res.json({'result': true, 'data': result})
}

exports.setWageCode = async function (req, res) {
    let cIdx = req.params.cIdx,
        groupCd = req.body.groupCd,
        itemCd = req.body.itemCd,
        itemNm = req.body.itemNm,
        sort = req.body.sort || 0,
        useFl = req.body.useFl,
        option = req.body.option || 0,//비과세한도
        regDt = new Date();

    let result = await etcModel.setWageCode(cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt);

    res.json({'result': true, 'data': result})
}

exports.setBaseCode = async function (req, res) {
    let cIdx = req.params.cIdx,
        groupCd = req.body.groupCd,
        itemCd = req.body.itemCd,
        itemNm = req.body.itemNm,
        sort = req.body.sort,
        useFl = req.body.useFl,
        option = req.body.option,
        regDt = new Date();

    console.log(cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt);

    let result = await etcModel.setBaseCode(cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt);

    res.json({'result': true, 'data': result})
}

exports.getCompanyConfig = async function (req, res) {
    let idx = req.params.idx;

    let result = await etcModel.getCompanyConfig(idx);

    res.json({'result': true, 'data': result})
}

exports.getWageCode = async function (req, res) {
    let cIdx = req.params.cIdx;

    let result = await etcModel.getWageCode(cIdx);

    res.json({'result': true, 'data': result})
}

exports.deleteWageCode = async function (req, res) {
    let itemCd = req.params.itemCd;
    //console.log('deleteBaseCode', groupCd);

    let result = await etcModel.deleteWageCode(itemCd);

    res.json({'result': true, 'data': result})
}

exports.deleteBaseCode = async function (req, res) {
    let itemCd = req.params.itemCd;

    let result = await etcModel.deleteBaseCode(itemCd);

    res.json({'result': true, 'data': result})
}

exports.setWorkDays = async function (req, res) {
    let cIdx = req.body.cIdx,
        sIdx = req.body.sIdx,
        year = req.body.year,
        month = req.body.month,
        days = req.body.days,
        bigo = req.body.bigo;

    let uIdx = `${cIdx}${year}${month}`;

    let result = await etcModel.setWorkDays(uIdx, cIdx, sIdx, year, month, days, bigo);

    res.json({'result': true, 'data': result})
}

exports.getWorkDays = async function (req, res) {
    let cIdx = req.query.cIdx,
        from = req.query.from,
        to = req.query.to;

    let result = await etcModel.getWorkDays(cIdx, from, to);

    if(result) {
        res.json({'result': true, 'data': result})
    }else {
        res.json({'result': false, 'msg': '조회된 결과가 없습니다.'})
    }
}

exports.delWorkDays = async function (req, res) {
    let uIdx = req.params.uIdx;

    let result = await etcModel.delWorkDays(uIdx);

    res.json({'result': true, 'data': result})
}

exports.setTaxRate = async function (req, res) {
    let appliedYear = req.body.applied_year, //당해년도
        pensionRate = req.body.pension_rate, //국민연금
        healthRate = req.body.health_rate,   //건강보험
        longTermCareRate = req.body.long_term_care_rate,   //장기요양보험
        employmentRate = req.body.employment_rate,   //고용보험
        industrialRate = req.body.industrial_rate;   //산재보험

    //console.log(appliedYear, pensionRate, healthRate, longTermCareRate, employmentRate)

    let result = await etcModel.setTaxRate(appliedYear, pensionRate, healthRate, longTermCareRate, employmentRate, industrialRate);

    res.json({'result': true, 'data': result})
}

exports.getTaxRate = async function (req, res) {
    let year = req.params.year;

    let result = await etcModel.getTaxRate(year);

    res.json({'result': true, 'data': result})
}
