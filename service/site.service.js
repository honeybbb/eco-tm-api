const siteModel = require("../model/site.model");

exports.getSiteList = async function (req, res) {
    let cIdx = req.params.cIdx;

    let result = await siteModel.getSiteList(cIdx);

    res.json({'result': true, 'data': result})
}

exports.setSiteData = async function (req, res) {
    let cIdx = req.body.cIdx,
        name = req.body.name,
        address = req.body.address,
        phone = req.body.phone,
        bigo = req.body.bigo,
        building_su = req.body.building_su,
        unit_su = req.body.unit_su,
        area = req.body.area;

    console.log(cIdx, name, address, phone, bigo, building_su, unit_su, area);
    //return;

    let result = await siteModel.setSiteData(cIdx, name, address, phone, bigo, building_su, unit_su, area);

    res.json({'result': true, 'data': result})
}

exports.registerSiteWithContract = async function (req, res) {
    // 1. 현장(Site) 데이터
    let siteData = {
        cIdx: req.body.cIdx,
        name: req.body.name,
        address: req.body.address,
        phone: req.body.phone, // 담당자 연락처
        bigo: req.body.bigo,
        building_su: req.body.building_su,
        unit_su: req.body.unit_su,
        area: req.body.area
    };

    // 2. 계약(Contract) 데이터
    let contractData = {
        cIdx: req.body.cIdx, // 현장과 동일한 회사 ID라고 가정
        contract: req.body.contract || {}, // JSON 데이터 등
        totalCost: req.body.totalCost || 0, // 금액 (없으면 0 처리 등)
        startDt: req.body.contractStart,
        endDt: req.body.contractEnd
    };

    console.log('등록 요청:', siteData, contractData);

    // Model 호출 (하나의 함수로 두 가지를 다 처리)
    let result = await siteModel.insertSiteAndContract(siteData, contractData);

    if (result.success) {
        res.json({ 'result': true, 'data': result.sIdx });
    } else {
        res.json({ 'result': false, 'message': '등록 실패', error: result.error });
    }
}

exports.updateSiteData = async function (req, res) {
    let sIdx = req.body.sIdx,
        name = req.body.name,
        address = req.body.address,
        phone = req.body.phone,
        bigo = req.body.bigo,
        building_su = req.body.building_su,
        unit_su = req.body.unit_su,
        area = req.body.area;

    let result = await siteModel.updateSiteData(sIdx, name, address, phone, bigo, building_su, unit_su, area);

    res.json({'result': true, 'data': result})
}

//현장 배치 정보 저장
exports.setSiteHeadCount = async function (req, res) {
    let cIdx = req.params.cIdx,
        sIdx = req.body.sIdx,
        jsonData = req.body.jsonData;

    let result = await siteModel.setSiteHeadCount(cIdx, sIdx, jsonData);

    res.json({'result': true, 'data': result})
}

exports.getSiteData = async function (req, res) {
    let sIdx = req.params.sIdx;

    let result = await siteModel.getSiteData(sIdx)

    res.json({'result': true, 'data': result})
}

exports.setAccountBill = async function (req, res) {
    let dno = req.body.dno, //문서번호
        cIdx = req.body.cIdx,
        sIdx = req.body.sIdx,
        date = req.body.date,
        receiver  = req.body.receiver,
        title = req.body.title,
        period1 = req.body.period1,
        period2 = req.body.period2,
        jsonData = req.body.jsonData,
        areaData = req.body.areaData,
        amount = req.body.amount;   //합계

    let result = await siteModel.setAccountBill(dno, cIdx, sIdx, date, receiver, title, period1, period2, jsonData, areaData, amount)

    res.json({'result': true, 'data': result})
}

exports.getAccountBillList = async function (req, res) {
    let year = req.query.year,
        month = req.query.month;

    let result = await siteModel.getAccountBillList(year, month);

    res.json({'result': true, 'data': result})
}

exports.getAccountBill = async function (req, res) {
    let year = req.query.year,
        month = req.query.month,
        sIdx = req.query.sIdx,
        cIdx = req.query.cIdx;

    let result = await siteModel.getAccountBill(year, month, sIdx, cIdx);

    res.json({'result': true, 'data': result})
}

exports.setSiteEstimate = async function (req, res) {
    let sIdx = req.params.sIdx,
        cIdx = req.body.cIdx,
        jsonData = req.body.jsonData,
        total = req.body.total;

    let result = await siteModel.setSiteEstimate(sIdx, cIdx, jsonData, total);

    res.json({'result': true, 'data': result})
}
