const etcModel = require("../model/etc.model");

exports.getMenus = async function (req, res) {
    let companyNo = req.params.companyNo,
        isMaster = req.query.isMaster == 'Y'? true:false,
        path = req.query.path;

    try {
        let result = await etcModel.getMenus(companyNo, isMaster, path);

        res.json({'result': true, 'data': result})

    } catch(err) {
        res.json({'result': false, 'msg': '관리자 메뉴를 찾을 수 없습니다.'})
    }
}

exports.updateMenus = async function (req, res) {
    let companyNo = req.params.companyNo,
        menuNo = req.body.menuNo,
        menuNm = req.body.menuNm,
        masterOnly = req.body.masterOnly,
        sort = req.body.sort,
        useFl = req.body.useFl;

    console.log(companyNo, menuNo, menuNm, masterOnly, sort, useFl);

    let result = await etcModel.updateMenus(companyNo, menuNo, menuNm, masterOnly, sort, useFl);

    res.json({'result': true, 'data': result})
}

exports.getBaseCode = async function (req, res) {
    let cIdx = req.params.cIdx;
    if(!cIdx) return res.json({'result': false, 'msg':'회사 정보가 없습니다.'});
    let result = await etcModel.getBaseCode(cIdx);

    res.json({'result': true, 'data': result})

}

exports.getGroupCode = async function (req, res) {
    let cIdx = req.user.cIdx,
        groupCd = req.params.groupCd;

    if(!cIdx) return res.json({'result': false, 'msg':'회사 정보가 없습니다.'});
    if(groupCd == ':groupCd') return res.json({'result': false, 'msg':'그룹코드가 없습니다.'});

    let result = await etcModel.getGroupCode(cIdx, groupCd);

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
        // logicFl = req.body.logicFl,
        regDt = new Date();

    let result = await etcModel.setBaseCode(cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt);

    res.json({'result': true, 'data': result})
}

exports.updateBaseCode = async function (req, res) {
    let itemCd = req.params.itemCd,
        itemNm = req.body.itemNm,
        useFl = req.body.useFl,
        option = req.body.option,
        sort = req.body.sort,
        modDt = new Date();

    let result = await etcModel.updateBaseCode(itemCd, itemNm, useFl, option, sort, modDt);

    res.json({'result': true, 'data': result})
}

exports.getCompanyData = async function (req, res) {
    let idx = req.user.cIdx;

    let result = await etcModel.getCompanyData(idx);

    res.json({'result': true, 'data': result})
}

exports.setCompanyAccount = async function (req, res) {
    let cIdx = req.params.cIdx,
        bank = req.params.bank,
        accountNumber = req.body.accountNumber,
        accountName = req.body.accountName,
        isDefault = req.params.isDefault,
        memo = req.params.memo;

    let result = await etcModel.setCompanyAccount(cIdx, bank, accountNumber, accountName, isDefault, memo);

    res.json({'result': true, 'data': result})
}

exports.getWageCode = async function (req, res) {
    let cIdx = req.params.cIdx;

    let result = await etcModel.getWageCode(cIdx);

    res.json({'result': true, 'data': result})
}

exports.getWageCode2 = async function (req, res) {
    let cIdx = req.params.cIdx;

    let result = await etcModel.getWageCode2(cIdx);

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

exports.setTaxIncome = async function (req, res) {

}

exports.getTaxIncome = async function (req, res) {
    let year = req.params.year,
        salary = req.query.salary,
        familyCnt = req.query.familyCnt;

    let result = await etcModel.getTaxIncome(year, salary, familyCnt);

    const incomeTax = result[0]?.tax_amt || 0;
    const localTax = Math.floor(incomeTax * 0.1 / 10) * 10;

    res.json({ result: true, incomeTax, localTax });
}

//품목 신청
exports.setOrders = async function (req, res) {
    try {
        let sIdx = req.params.sIdx,
            mIdx = req.body.mIdx,
            orderList = req.body.orders;

        console.log(orderList, 'orderList')

        if (orderList.length === 0) {
            return res.status(400).json({ result: false, message: "신청할 물품이 없습니다." });
        }

        let result = await etcModel.setOrders(sIdx, orderList, mIdx);

        res.json({ result: true, data: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ result: false, message: "서버 오류" });
    }
}

//품목신청 리스트
exports.getOrders = async function (req, res) {
    let result = await etcModel.getOrders();

    res.json({'result': true, 'data': result})
}

exports.updateOrderStatus = async function (req, res) {
    let sIdx = req.body.sIdx,
        oIdx = req.body.oIdx,
        status = req.body.status,
        managerId = req.body.managerId;

    let result = await etcModel.updateOrderStatus(sIdx, oIdx, status, managerId);
    res.json({'result': true, 'data': result})
}
