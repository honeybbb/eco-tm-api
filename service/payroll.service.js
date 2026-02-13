const payrollModel = require("../model/payroll.model")
const etcModel = require("../model/etc.model")
const workModel = require("../model/work.model")
const contractModel = require("../model/contract.model")
const memberModel = require("../model/member.model")
const wageModel = require("../model/etc.model");

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

    let result = await payrollModel.setBaseSalary(mIdx, sIdx, year, paymentList, deductionList, checkedList, grossPay, deductions, netPay, total);

    res.json({'result': true, 'data': result})
};

//직원급여내역조회
exports.getPayrollMonth = async function (req, res) {
    let { year, month } = req.query;

    if (!year || !month) {
        return res.json({ 'result': false, 'msg': '날짜 설정을 확인해주세요.' });
    }

    const targetMonthStr = `${year}-${String(month).padStart(2, '0')}`;
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    const daysInMonth = endOfMonth.getDate();

    try {
        // 1. 데이터 병렬 수집
        const [contracts, works, wageCodes] = await Promise.all([
            contractModel.getMemberContract(targetMonthStr),
            workModel.getWorkDays(targetMonthStr),
            wageModel.getWageCode()
        ]);

        // 2. 직원별 급여 계산 루프
        const payrollResults = contracts.map(mc => {
            // JSON 데이터 파싱
            const jsonData = typeof mc.jsonData === 'string' ? JSON.parse(mc.jsonData) : mc.jsonData;
            // 해당 직원의 출근일 필터링
            const memberWorkDates = works
                .filter(w => w.mIdx === mc.mIdx)
                .map(w => w.workDate);

            // 2-1. 결근 계산 (격일제 vs 평일제)
            const isAlternateDay = mc.month_work_time >= 210;
            let absentDays = 0;
            let scheduledDays = 0;

            for (let d = 1; d <= daysInMonth; d++) {
                const currentDate = new Date(year, month - 1, d);
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

                let isScheduled = false;
                if (isAlternateDay) {
                    // 격일제: 입사일(startDt) 기준 2일 간격 패턴
                    const startDt = new Date(mc.startDt);
                    startDt.setHours(0,0,0,0);
                    currentDate.setHours(0,0,0,0);
                    const diffDays = Math.round(Math.abs(currentDate - startDt) / (1000 * 60 * 60 * 24));
                    if (diffDays % 2 === 0) isScheduled = true;
                } else {
                    // 평일제: 월~금
                    if (currentDate.getDay() >= 1 && currentDate.getDay() <= 5) isScheduled = true;
                }

                if (isScheduled) {
                    scheduledDays++;

                    // 근무 예정일인데 출근 기록이 없으면 결근
                    if (!memberWorkDates.includes(dateStr)) {
                        absentDays++;
                    }
                }
                /*
                // 근무예정일인데 출근기록(연차포함)이 없으면 결근
                if (isScheduled && !memberWorkDates.includes(dateStr)) {
                    absentDays++;
                }

                 */
            }

            // 2-2. 급여액 산출
            const hourlyRate = mc.grossPay / mc.month_work_time;
            const absentDeduction = Math.round(hourlyRate * mc.day_work_time * absentDays);
            const finalBaseSalary = mc.grossPay - absentDeduction;

            // 2-3. 비과세 합계 (경비직 특수조건 적용)
            let totalTaxFree = 0;
            let extraPaySum = 0;

            wageCodes.forEach(cw => {
                const amount = parseInt(jsonData[cw.itemCd] || 0);
                if (cw.itemCd !== '04001001') extraPaySum += amount;

                if (cw.itemCd === '04001003' && mc.type === '01001001' && mc.month_work_time >= 210) {
                    // 경비원 야간수당 비과세 (20만원)
                    totalTaxFree += Math.min(amount, 200000);
                } else if (cw.tax_free > 0) {
                    totalTaxFree += Math.min(amount, cw.tax_free);
                }
            });

            console.log(mc, 'c')

            return {
                mIdx: mc.mIdx,
                staff: mc.name,
                role: mc.role,
                id: mc.id,
                siteName: mc.siteName,
                sIdx: mc.sIdx,
                payment_day: mc.payment_day,
                scheduledDays,
                absentDays,
                absentDeduction,
                finalBaseSalary,
                totalTaxFree,
                taxableIncome: (finalBaseSalary + extraPaySum) - totalTaxFree
            };
        });

        // 3. 최종 결과 반환
        res.json({ 'result': true, 'data': payrollResults });

    } catch (e) {
        console.error('Payroll Calculation Error:', e);
        res.json({ 'result': false, 'msg': '급여 계산 중 오류가 발생했습니다.' });
    }
};

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
