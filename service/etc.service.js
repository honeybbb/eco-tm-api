const etcModel = require("../model/etc.model");

exports.getNoticeList = async function (req, res) {
    let result = await etcModel.getNoticeList();

    res.json({'result': true, 'data': result})
}

exports.getNoticeData = async function(req, res) {
    let idx = req.params.idx;

    let result = await etcModel.getNoticeData(idx);

    res.json({'result': true, 'data': result})
}

exports.getBaseCode = async function (req, res) {
    let result = await etcModel.getBaseCode();

    res.json({'result': true, 'data': result})

}

exports.getGroupCode = async function (req, res) {
    let groupCd = req.params.groupCd;
    if(groupCd == ':groupCd') return res.json({'result': false, 'msg':'Invalid Code'});

    let result = await etcModel.getGroupCode(groupCd);

    res.json({'result': true, 'data': result})
}

exports.setBaseCode = async function (req, res) {
    let cIdx = req.params.cIdx,
        groupCd = req.body.groupCd,
        itemCd = req.body.itemCd,
        itemNm = req.body.itemNm,
        sort = req.body.sort,
        useFl = req.body.useFl,
        regDt = new Date();

    let result = await etcModel.setBaseCode(cIdx, groupCd, itemCd, itemNm, sort, useFl, regDt);

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

exports.deleteBaseCode = async function (req, res) {
    let groupCd = req.params.groupCd;
    console.log('deleteBaseCode', groupCd);

    let result = await etcModel.deleteBaseCode(groupCd);

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
        employmentRate = req.body.employment_rate;   //고용보험

    console.log(appliedYear, pensionRate, healthRate, longTermCareRate, employmentRate)

    let result = await etcModel.setTaxRate(appliedYear, pensionRate, healthRate, longTermCareRate, employmentRate);

    res.json({'result': true, 'data': result})
}

exports.getTaxRate = async function (req, res) {
    let year = req.params.year;

    let result = await etcModel.getTaxRate(year);

    res.json({'result': true, 'data': result})
}
