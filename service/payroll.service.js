const payrollModel = require("../model/payroll.model")
const etcModel = require("../model/etc.model")
const workModel = require("../model/work.model")

//직원기본급여조회
exports.getBaseSalary = async function (req, res) {
    let result = await payrollModel.getBaseSalary();

    res.json({'result': true, 'data': result})
}

//직원급여등록
exports.setBaseSalary = async function (req, res) {
    let mIdx = req.params.mIdx, //회원idx
        sIdx = req.body.sIdx, //현장idx
        year = req.body.year,   //현재 년도
        paymentList = req.body.payItems, //json(지급항목)
        deductionList = req.body.deductionItems, //json(공제항목)
        checkedList = req.body.checkedItems,    //json(공제항목 체크여부)
        grossPay = req.body.grossPay,
        deductions = req.body.deducti1ons,
        netPay = req.body.netPay,
        total = req.body.total; //합계

    let result = await memberModel.setBaseSalary(mIdx, sIdx, year, paymentList, deductionList, checkedList, grossPay, deductions, netPay, total);

    res.json({'result': true, 'data': result})
};

//직원급여내역조회
exports.getPayrollMonth = async function (req, res) {
    let year = req.query.year,
        month = req.query.month;
    let result = await payrollModel.getPayrollMonth(year, month);

    res.json({'result': true, 'data': result})
}

exports.setPayrollMonth = async function (req, res) {
    let mIdx = req.params.mIdx,
        sIdx = req.body.sIdx,
        year = req.body.year,
        month = req.body.month,
        workDays = req.body.workDays,
        grossPay = req.body.grossPay,
        deductions = req.body.deductions,
        netPay = req.body.netPay,
        payItems = req.body.payItems,
        deductionItems = req.body.deductionItems,
        total = req.body.total;

    let result = await payrollModel.setPayrollMonth(mIdx, sIdx, year, month, grossPay, workDays, deductions, netPay, payItems, deductionItems, total);

    res.json({'result': true, 'data': result})
}

exports.getRetirementEstimation = async function (req, res) {

    let result = await payrollModel.getRetirementEstimation()

    res.json({'result': true, 'data': result})
}

exports.getAnnualLeaveEstimation = async function (req, res) {
    let year = req.query.year;

    try {
        let result = await payrollModel.getAnnualLeaveEstimation(year);

        res.json({'result': true, 'data': result})
    }catch(err) {
        res.json({'result': false, 'message': '서버 에러 발생' });
    }
}


exports.getWorkPayroll = async function(req, res) {
    let targetMonth = req.query.targetMonth;

    let result = await payrollModel.getWorkPayroll(targetMonth);

    res.json({'result': true, 'data': result})
}
/*

exports.setPayroll1 = async function (req, res) {
    let mIdx = req.params.mIdx,
        sIdx = req.body.sIdx,
        bWage = req.body.bWage, //basicWage
        pWage = req.body.pWage, //positionWage
        oWage = req.body.oWage; //otherWage

    let result = await payrollModel.setPayroll(mIdx, sIdx, bWage, pWage, oWage);

    res.json({'result': true, 'data': result})
}

//직원 급여 조회
exports.getPayroll1 = async function (req, res) {
    let mIdx = req.params.mIdx,
        startDt = req.query.startDt,
        endDt = req.query.endDt;

    //임금 조회
    let wages = await payrollModel.getWages(mIdx);
    const bWage = wages.basic_wage, //기본수당
        pWage = wages.position_wage,   //직책수당
        oWage = wages.other_wage,   //기타수당
        mWage = wages.meal_wage;   //식대,교통비 등

    const totalWage = bWage+pWage+oWage+mWage;

    //기준근무일수
    const standard_days = await etcModel.getStandardDays(mIdx, startDt, endDt);

    //일한근무일수
    const workdays = await workModel.getWorkDays(mIdx, startDt, endDt);

    console.log(totalWage, standard_days.days, workdays.workdays);
    // 일할 계산: 월급 ÷ 기준근무일수 × 실제근무일수
    let result = Math.round(totalWage / standard_days.days * workdays.workdays);

    res.json({'result': true, 'data': result})
}

//관리자 급여 도급 내역
exports.getMonthlyWage = async function (req, res) {
    const { cIdx, sIdx, year, month } = req.query;
    const ym = `${year}-${String(month).padStart(2, '0')}`;

    //근무 기준일 조회
    try {
        let cfg = await etcModel.getStandardDays(cIdx, sIdx, year, month);
        const standardDays = cfg.length ? Number(cfg[0].days) : 0;

        // 2) 직원별 기본급 가져오기
        const wages = await payrollModel.getWagesAdmin(sIdx);
        console.log(wages, 'wages')

        // 3) 직원별 근무일수 계산
        const works = await workModel.getWorkDaysAdmin(sIdx, ym)

        //console.log(ym, works, 'works', wages, 'wages')

        // workdays를 객체로 {mIdx: workdays}
        const workdaysMap = {};
        works.forEach(r => workdaysMap[r.mIdx] = r.workdays);

        // 4) 최종 월급 계산
        const result = wages.map(row => {
            const jsonData = JSON.parse(row.jsonData);

            // {
            //   '03001001': { amount: 1709290 },
            //   '03001002': { amount: 0 },
            //   '03001003': { amount: 0 }
            // }

            const keys = Object.keys(jsonData);
            const basic_wage = jsonData[keys[0]].amount

            const mIdx = row.mIdx;
            const base = Number(basic_wage) || 0;
            const wd = workdaysMap[mIdx] || 0;

            const calcPay = standardDays > 0
                ? Math.round(base * wd / standardDays)
                : 0;

            return {
                mIdx,
                inDate: row.inDate,
                name: row.name,
                position: row.position,
                basic_wage: base,
                workdays: wd,
                standard_days: standardDays,
                monthly_pay: calcPay,
                position_wage: row.position_wage,
                other_wage: row.other_wage,
            };
        });

        res.json({ result: true, data: result });

    } catch (err) {
        console.error(err);
        res.json({ result: false, error: err.message });
    }
};

//직원 급여 상세 조회
//상세에서는 기본금, 직책수당, 기타수당 등에 대한 표가 나와야함
//급여명세서와 출근명세서는 다른것.

exports.getPayrollDetail = async function (req, res) {
    let mIdx = req.params.mIdx,
        startDt = req.query.startDt,
        endDt = req.query.endDt;

    // let result = await payrollModel.getPayrollDetail(mIdx, startDt, endDt);

    res.json({'result': true, 'data': result})
}

//도급내용 저장
exports.setPayrollDetail = async function (req, res) {
    let sIdx = req.body.sIdx,
        cIdx = req.body.cIdx,
        year = req.body.year,
        month = req.body.month,
        directCostJson = req.body.directCostJson, //json에 mIdx별로 저장됨 :직접경비
        indirectCostJson = req.body.indirectCostJson, //간접경비
        etcCostJson = req.body.etcCostJson, //기타경비
        manageCostJson = req.body.manageCostJson,   //관리비
        amount = req.body.amount,
        regDt = new Date();

    console.log(sIdx, cIdx, year, month, directCostJson, indirectCostJson,
        etcCostJson, manageCostJson, amount, regDt)

    let result = await payrollModel.setPayrollDetail(
        sIdx, cIdx, year, month, directCostJson, indirectCostJson,
        etcCostJson, manageCostJson, amount, regDt);

    res.json({'result': true, 'data': result})
}

exports.getPayrollList = async function (req, res) {
    let {year, month} = req.query;
    console.log(year, month, 'getPayrollList')

    let result = await payrollModel.getPayrollList(year, month);

    res.json({'result': true, 'data': result})
}

*/
