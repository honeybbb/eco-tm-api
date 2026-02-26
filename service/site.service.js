const siteModel = require("../model/site.model");

exports.getSiteList = async function (req, res) {
    let cIdx = req.params.cIdx;

    let result = await siteModel.getSiteList(cIdx);

    res.json({'result': true, 'data': result})
}

exports.setSiteBigo = async function (req, res) {
    let sIdx = req.body.sIdx,
        bigo = req.body.bigo,
        admin = req.body.admin;

    let result = await siteModel.setSiteBigo(sIdx, bigo, admin);
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
    try {
        // ====================================================
        // Step 1. 현장(Site) 데이터 준비
        // ====================================================
        let siteData = {
            sIdx: req.body.sIdx,
            sType: req.body.sType, //건물타입
            cIdx: req.body.cIdx,
            name: req.body.name,
            // site_id: req.body.site_id,
            // type: req.body.type,
            status: req.body.status,
            area: req.body.area,
            is_vat: req.body.is_vat,
            building_su: req.body.building_su,
            unit_su: req.body.unit_su,
            address: req.body.address,
            address_detail: req.body.addressDetail,
            payment_day: req.body.payment_day,

            phone: req.body.phone || '',
            manager: req.body.manager || '',
            director: req.body.director,
            director_phone: req.body.directorContact,
            bigo: req.body.bigo || '',
        };

        console.log(siteData, 'siteData');

        // 현장 정보 저장 (INSERT or UPDATE)
        // 결과로 sIdx(현장 키값)를 받아옵니다.
        let siteResult = await siteModel.saveSite(siteData);

        if (!siteResult.success) {
            return res.json({ 'result': false, 'message': '현장 저장 실패', error: siteResult.error });
        }

        const targetSIdx = siteResult.sIdx; // 저장/수정된 현장 ID

        // ====================================================
        // Step 2. 계약(Contract) 데이터 반복 처리
        // ====================================================

        // JSON 파싱
        let contractList = [];
        try {
            if (req.body.contract_details) {
                contractList = (typeof req.body.contract_details === 'string')
                    ? JSON.parse(req.body.contract_details)
                    : req.body.contract_details;
            }
        } catch (e) {
            console.error("JSON Parse Error", e);
        }

        if (Array.isArray(contractList) && contractList.length > 0) {
            for (const contractItem of contractList) {

                // 인원수 합계 계산 (데이터 무결성을 위해 서버에서 계산 추천)
                let currentStaffCount = 0;
                if(contractItem.staffList && Array.isArray(contractItem.staffList)){
                    currentStaffCount = contractItem.staffList.reduce((acc, cur) => acc + (Number(cur.count)||0), 0);
                }
                console.log(contractItem)
                // 개별 계약 데이터 객체 생성
                let contractData = {
                    scIdx: contractItem.scIdx, // ★ 계약 고유키 (수정 시 필요)
                    sIdx: targetSIdx,          //현장idx
                    cIdx: req.body.cIdx,
                    type: contractItem.type,

                    // 상세 데이터
                    workDays: contractItem.workDays,
                    totalCost: contractItem.totalCost || 0,
                    startDt: contractItem.contractStart,
                    endDt: contractItem.contractEnd,
                    staffCount: currentStaffCount,
                    staffDetail: JSON.stringify(contractItem.staffList),
                    workSchedule: contractItem.workSchedule,
                    breaktime: contractItem.breakTime
                };

                // 개별 계약 저장
                await siteModel.saveContract(contractData);
            }
        }

        // 성공 응답
        res.json({ 'result': true, 'data': targetSIdx });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'result': false, 'message': '서버 에러 발생' });
    }
};

exports.registerBudget = async function (req, res) {
    let sIdx = req.body.sIdx,
        jsonData = req.body.jsonData;

    let result = await siteModel.registerBudget(sIdx, jsonData);

    res.json({ 'result': true, 'data': result });
}

exports.getSiteBudget = async function (req, res) {
    let sIdx = req.query.sIdx;

    if(!sIdx) return res.json({ 'result': false, 'msg': '현장 인덱스 정보가 없습니다.' });

    let result = await siteModel.getSiteBudget(sIdx);

    res.json({ 'result': true, 'data': result });
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

exports.getSiteHeadCount = async function (req, res) {
    let sIdx = req.params.sIdx;

    let result = await siteModel.getSiteHeadCount(sIdx);

    res.json({'result': true, 'data': result})
}

exports.getSiteData = async function (req, res) {
    const sIdx = req.params.sIdx;

    try {
        const result = await siteModel.getSiteData(sIdx);

        if (result) {
           //console.log(result, 'r')
            res.json({ result: true, data: result });
        } else {
            res.json({ result: false, message: '해당 현장 정보가 없습니다.' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ result: false, message: '서버 에러' });
    }
};

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
