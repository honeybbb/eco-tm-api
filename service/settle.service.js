const settleModel = require("../model/settle.model");
const payrollModel = require("../model/payroll.model");
const siteModel = require("../model/site.model");
const workModel = require("../model/work.model");

exports.getSettleList = async function (req, res) {
    let cIdx = req.user.cIdx;
    let startMonth = req.query.startMonth,
        endMonth = req.query.endMonth,
        docType = req.query.docType || ['SERVICE','RETIRE_ANNUAL'];

    console.log(docType);

    //let docTypeArr = docType.includes(',') ? docType.split(',') : [docType];

    let result = await settleModel.getSettleList(startMonth, endMonth, docType, cIdx);

    res.json({"result": true, "data": result});
}

exports.getCalculatedPayroll = async function (req, res) {
    try {
        const { cIdx, sIdx, year, month, type } = req.query;

        // 1. 해당 월의 시작일과 종료일 계산
        const targetMonth = String(month).padStart(2, '0');
        const startDt = `${year}-${targetMonth}-01`;
        const endDt = new Date(year, month, 0).toISOString().split('T')[0];

        // 2. 현장 산출 내역(Budget) 가져오기
        const siteData = await siteModel.getSiteData(sIdx);
        let budgetMap = {};

        if (siteData && siteData.length > 0 && siteData[0].contractList) {
            const contracts = JSON.parse(siteData[0].contractList);
            const targetContract = contracts.find(c => c.type === type);

            if (targetContract && targetContract.budget) {
                const parsedBudget = typeof targetContract.budget === 'string' ? JSON.parse(targetContract.budget) : targetContract.budget;
                if (parsedBudget.directLabor) {
                    parsedBudget.directLabor.forEach(labor => {
                        budgetMap[labor.label] = labor.values;
                    });
                }
            }
        }

        // 3. Model 호출 (함수명 변경 및 sIdx 추가)
        let members = await settleModel.getAssignedMembers(cIdx, sIdx, endDt, startDt);

        // ※ 예외 처리: 데이터베이스 에러 등으로 '-9999' 객체가 넘어온 경우
        if (!Array.isArray(members)) {
            return res.status(500).json({ result: false, message: '직원 데이터를 불러오지 못했습니다.' });
        }

        // 4. 직원별 실제 근태 데이터 집계
        for (let member of members) {
            // 수정: mIdx -> member.idx
            let workData = await workModel.getWorkSheet(member.idx, startDt, endDt);

            // 수정: workData는 배열이므로, JS에서 직접 일수와 시간을 계산
            if (Array.isArray(workData)) {
                // 하루에 두 번 출근(오전/오후) 기록이 있을 수 있으니 날짜(date) 중복 제거하여 일수 계산
                const uniqueDays = new Set(workData.map(w => w.date));
                member.actualWorkDays = uniqueDays.size;

                // duration 합산하여 총 시간 계산
                member.actualWorkHours = workData.reduce((sum, row) => sum + Number(row.duration), 0);
            } else {
                member.actualWorkDays = 0;
                member.actualWorkHours = 0;
            }

            // 현장 산출 내역(Budget) 정보 주입
            member.budgetData = budgetMap[member.position] || null;
        }

        res.json({ result: true, data: members });

    } catch (e) {
        console.error('getCalculatedPayroll 에러:', e);
        res.status(500).json({ result: false, message: '서버 에러' });
    }
}
/*
exports.getSettlePayroll = async function (req, res) {
    let cIdx = req.user.cIdx,
        year = req.query.year,
        month = req.query.month,
        sIdx = req.query.sIdx;

    let result = await settleModel.getSettlePayroll(cIdx, year, month, sIdx);

    res.json({'result': true, 'data': result})
}

 */
exports.getSettlePayroll = async function (req, res) {
    let cIdx = req.user.cIdx,
        year  = req.query.year,
        month = req.query.month,
        sIdx  = req.query.sIdx;

    let rows = await settleModel.getSettlePayroll(cIdx, year, month, sIdx);

    const monthStart = new Date(year, month - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd   = new Date(year, month, 0);
    monthEnd.setHours(0, 0, 0, 0);

    const byRole = {};
    rows.forEach(r => {
        const key = `${r.sIdx}_${r.itemCd || 'none'}`;
        (byRole[key] ||= []).push(r);
    });

    //DB에서 온 날짜 문자열의 시간 오차를 없애주는 헬퍼 함수
    const getMidnight = (dateString) => {
        const d = new Date(dateString);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    Object.values(byRole).forEach(group => {
        group.forEach(row => { row.gapDays = 0; });

        // 이번 달 퇴사자들 (오름차순)
        const departures = group
            .filter(g => {
                if (!g.outDate) return false;
                const o = getMidnight(g.outDate);
                return o >= monthStart && o <= monthEnd;
            })
            .sort((a, b) => getMidnight(a.outDate) - getMidnight(b.outDate));

        // 이번 달 중간 입사자들 (오름차순)
        const joiners = group
            .filter(g => {
                if (!g.inDate) return false;
                const i = getMidnight(g.inDate);
                return i >= monthStart && i <= monthEnd && i.getDate() !== 1;
            })
            .sort((a, b) => getMidnight(a.inDate) - getMidnight(b.inDate));

        // 1) 입사자 기준 선행 공백(직전 퇴사자와 매칭)
        joiners.forEach(joinRow => {
            const inDate = getMidnight(joinRow.inDate);

            const candidate = departures.find(d =>
                !d._matched && getMidnight(d.outDate) < inDate
            );

            let gapStart;
            if (candidate) {
                candidate._matched = true;
                const out = getMidnight(candidate.outDate);
                gapStart = new Date(out.setDate(out.getDate() + 1));
            } else {
                gapStart = monthStart;
            }

            const gapEnd = new Date(new Date(inDate).setDate(inDate.getDate() - 1));

            const diffDays = Math.round((gapEnd - gapStart) / 86400000) + 1;
            if (diffDays > 0) joinRow.gapDays += diffDays;
        });

        // 2) 매칭 안 된(대체자가 아직 없는) 퇴사자 → 퇴사일 다음날 ~ 월말까지 자체 공백
        departures.forEach(depRow => {
            if (depRow._matched) return;

            const outDate = getMidnight(depRow.outDate);
            const gapStart = new Date(outDate.setDate(outDate.getDate() + 1));
            const gapEnd = monthEnd;

            const diffDays = Math.round((gapEnd - gapStart) / 86400000) + 1;
            if (diffDays > 0) depRow.gapDays += diffDays;

            delete depRow._matched; // 임시 플래그 정리
        });

        group.forEach(row => delete row._matched);
    });

    res.json({ result: true, data: rows });
};

exports.getSettlePayroll_v2 = async function (req, res) {
    let cIdx = req.user.cIdx,
        year = req.query.year,
        month = req.query.month,
        sIdx = req.query.sIdx;

    let result = await settleModel.getSettlePayroll_v2(cIdx, year, month, sIdx);

    res.json({'result': true, 'data': result})
}

//급여총액 조회
exports.getSettleSummary = async function (req, res) {
    let
        cIdx = req.user.cIdx,
        year = req.query.year,
        month = req.query.month;

    let result = await settleModel.getSettleSummary(cIdx, year, month);

    res.json({'result': true, 'data': result})
}

exports.updateSettleSummary = async function (req, res) {
    let cIdx = req.user.cIdx,
        data = req.body.data;

    // 방어 로직: 데이터가 없거나 배열이 아닌 경우 튕겨냄
    if (!data || !Array.isArray(data)) {
        return res.status(400).json({ result: false, message: '잘못된 데이터 형식입니다.' });
    }

    try {
        const updatePromises = data.map(item => {
            return settleModel.updateSettleSummary(
                cIdx,
                item.ssIdx,
                item.invoiceDt,
                item.invoiceAmount,
                item.bankName,
                item.bigo
            );
        });

        let result = await Promise.all(updatePromises);

        // 4. 성공 응답
        res.json({'result': true, 'data': result});

    } catch (error) {
        console.error('Update Settle Summary Error:', error);
        res.status(500).json({'result': false, 'msg': '서버 오류가 발생했습니다.'});
    }
}

//청구현황 조회
exports.getSettleBilling = async function (req, res) {
    let cIdx = req.user.cIdx,
        startMonth = req.query.startMonth,
        endMonth = req.query.endMonth;

    let result = await settleModel.getSettleBilling(cIdx, startMonth, endMonth);

    res.json({'result': true, 'data': result});
}

exports.getSettleReview = async function (req, res) {
    let cIdx = req.user.cIdx,
        startMonth = req.query.startMonth,
        endMonth = req.query.endMonth;

    try {
        const settlements = await settleModel.getSettlements(cIdx, startMonth, endMonth); //정산서 정보
        if (settlements.length === 0) return settlements;

        const [assignments, payrolls, codes] = await Promise.all([
            settleModel.getAssignments(startMonth, endMonth),
            settleModel.getPayrolls(startMonth, endMonth),
            settleModel.getCodes(cIdx)
        ]);

        // 2. 비즈니스 로직 시작 (작성하신 자바스크립트 로직 그대로)
        const codeMap = {};
        codes.forEach(c => {
            codeMap[c.itemCd] = c.itemNm;
        });

        for (let row of settlements) {
            const year = Number(row.year);
            const month = Number(row.month);
            const staffCount = row.staffCount;

            const lastDayOfMonth = new Date(year, month, 0).getDate();
            const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

            // [1] 배치 인원 및 공제일수 계산
            const siteAssignments = assignments.filter(a => {
                if (a.sIdx !== row.sIdx || a.type !== row.type) return false;
                const e = a.endDt || '9999-12-31';
                return a.startDt <= monthEndStr && e >= monthStartStr;
            });

            const uniqueMembers = new Set(siteAssignments.map(a => a.mIdx));
            row.workStaffCount = uniqueMembers.size;

            let deductionDays = 0;
            for (let day = 1; day <= lastDayOfMonth; day++) {
                const currentDayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                let dailyActiveMembers = new Set();

                for (let a of siteAssignments) {
                    const e = a.endDt || '9999-12-31';
                    if (currentDayStr >= a.startDt && currentDayStr <= e) {
                        dailyActiveMembers.add(a.mIdx);
                    }
                }
                if (dailyActiveMembers.size < staffCount) deductionDays++;
            }
            row.deductionDays = deductionDays;

            // [2] 급여 및 공제 내역 합산
            const sitePayrolls = payrolls.filter(p =>
                p.sIdx === row.sIdx && p.year === year && p.month === month && p.type === row.type
            );

            let totalGrossPay = 0, totalDeductions = 0, totalNetPay = 0, totalPayItemsSum = 0;
            let aggregatedPayItems = {}, aggregatedDeductionItems = {};

            for (let p of sitePayrolls) {
                totalGrossPay += (p.grossPay || 0);
                totalDeductions += (p.deductions || 0);
                totalNetPay += (p.total || 0);

                if (p.payItems) {
                    let payObj = typeof p.payItems === 'string' ? JSON.parse(p.payItems) : p.payItems;
                    for (let [code, amount] of Object.entries(payObj)) {
                        const amt = Number(amount) || 0;
                        totalPayItemsSum += amt;
                        const codeName = codeMap[code] || code;
                        aggregatedPayItems[codeName] = (aggregatedPayItems[codeName] || 0) + amt;
                    }
                }

                if (p.deductionItems) {
                    let dedObj = typeof p.deductionItems === 'string' ? JSON.parse(p.deductionItems) : p.deductionItems;
                    for (let [code, amount] of Object.entries(dedObj)) {
                        const amt = Number(amount) || 0;
                        const codeName = codeMap[code] || code;
                        aggregatedDeductionItems[codeName] = (aggregatedDeductionItems[codeName] || 0) + amt;
                    }
                }
            }

            row.totalGrossPay = totalGrossPay;
            row.totalDeductions = totalDeductions;
            row.totalNetPay = totalNetPay;
            row.totalPayItemsSum = totalPayItemsSum;
            row.detailPayItems = aggregatedPayItems;
            row.detailDeductionItems = aggregatedDeductionItems;
        }

        return settlements;

    } catch (err) {
        console.error('Service Error:', err);
        return res.status(500).json({ result: false, msg: '데이터베이스 처리 중 오류가 발생했습니다.' });
    }
}

exports.getSettleReview_v2 = async function (req, res) {
    //계약인원은 new_tb_site_contract의 staffCount에서 확인 (경비/미화 구분), 실제청구 인원은 new_tb_site_settlement의 payrollData length
    //당월 청구액은 new_tb_site_settlement의 grandTotal 에서 확인 (부가세포함액),
    // 기준금액은 new_tb_site_contract에서 월간용역비 - 퇴직적립금 총액 - 연차적립금 총액 - 4대보험 차액(그런데 meltOptions 에 따라 4대보험 차액값은 변동됨)
    // 급여총계 new_tb_member_payroll_month의 grossPay where sIdx = ? and year = ? and month = ?
    // 기준총계액은 new_tb_site_contract의 jsonData에서 direct(직접노무비에서 연차,퇴직제외)
    let cIdx = req.user.cIdx,
        startMonth = req.query.startMonth,
        endMonth = req.query.endMonth;

    try {
        const settlements = await settleModel.getSettlements(cIdx, startMonth, endMonth); //정산서 정보

        const [assignments, payrolls, codes] = await Promise.all([
            settleModel.getAssignments(startMonth, endMonth),
            settleModel.getPayrolls(startMonth, endMonth),
            // settleModel.getCodes(cIdx)
        ]);

        console.log(assignments);
        return;

        for (let row of settlements) {
            const year = Number(row.year);
            const month = Number(row.month);
            const staffCount = row.staffCount;

            const lastDayOfMonth = new Date(year, month, 0).getDate();
            const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

            // [1] 배치 인원 및 공제일수 계산
            const siteAssignments = assignments.filter(a => {
                if (a.sIdx !== row.sIdx || a.type !== row.type) return false;
                const e = a.endDt || '9999-12-31';
                return a.startDt <= monthEndStr && e >= monthStartStr;
            });

            const uniqueMembers = new Set(siteAssignments.map(a => a.mIdx));
            row.workStaffCount = uniqueMembers.size;

            let deductionDays = 0;
            for (let day = 1; day <= lastDayOfMonth; day++) {
                const currentDayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                let dailyActiveMembers = new Set();

                for (let a of siteAssignments) {
                    const e = a.endDt || '9999-12-31';
                    if (currentDayStr >= a.startDt && currentDayStr <= e) {
                        dailyActiveMembers.add(a.mIdx);
                    }
                }
                if (dailyActiveMembers.size < staffCount) deductionDays++;
            }
            row.deductionDays = deductionDays;

            // [2] 급여 및 공제 내역 합산
            const sitePayrolls = payrolls.filter(p =>
                p.sIdx === row.sIdx && p.year === year && p.month === month && p.type === row.type
            );

            let totalGrossPay = 0, totalDeductions = 0, totalNetPay = 0, totalPayItemsSum = 0;
            let aggregatedPayItems = {}, aggregatedDeductionItems = {};

            for (let p of sitePayrolls) {
                totalGrossPay += (p.grossPay || 0);
                totalDeductions += (p.deductions || 0);
                totalNetPay += (p.total || 0);
            }

            row.totalGrossPay = totalGrossPay;
            row.totalDeductions = totalDeductions;
            row.totalNetPay = totalNetPay;
            row.totalPayItemsSum = totalPayItemsSum;
            row.detailPayItems = aggregatedPayItems;
            row.detailDeductionItems = aggregatedDeductionItems;
        }

        return settlements;

    } catch (err) {
        console.error('Service Error:', err);
        return res.status(500).json({ result: false, msg: '데이터베이스 처리 중 오류가 발생했습니다.' });
    }

}

exports.setSettleData = async function (req, res) {
    const sIdx = req.params.sIdx;
    const {
        idx, year, month, type, docType, docNo, billingDt,
        subTotal, vatAmount, grandTotal,
        billingData, payrollData, viewConfig // 프론트에서 넘어온 viewConfig 받기
    } = req.body;

    try {
        // JSON 데이터를 DB에 넣기 위해 문자열로 변환
        const strBillingData = JSON.stringify(billingData);
        const strPayrollData = JSON.stringify(payrollData);
        const strViewConfig  = JSON.stringify(viewConfig); // ★ viewConfig 문자열 변환 추가

        const targetDocType = docType || 'SERVICE';

        if (idx) {
            // ============================================
            // 1. idx가 존재하면 기존 데이터 수정 (UPDATE)
            // ============================================
            let result = await settleModel.updateSettleData(
                year, month, type, docNo, billingDt,
                subTotal, vatAmount, grandTotal,
                strBillingData, strPayrollData, strViewConfig, // ★ 파라미터 추가
                idx, sIdx
            );
            return res.json({ result: true, data: result });

        } else {
            // ============================================
            // 2. idx가 없으면 새 문서 작성 (INSERT)
            // ============================================
            const cIdx = req.body.cIdx;

            let result = await settleModel.setSettleData(
                sIdx, cIdx, year, month, targetDocType, docNo, type, billingDt,
                subTotal, vatAmount, grandTotal,
                strBillingData, strPayrollData, strViewConfig
            );

            return res.json({ result: true, data: result });
        }

    } catch (err) {
        console.error("정산서 저장 에러:", err);
        return res.status(500).json({ result: false, msg: '데이터베이스 처리 중 오류가 발생했습니다.' });
    }
}

exports.deleteSettleList = async function (req, res) {
    let idx = req.params.idx;

    let result = await settleModel.deleteSettleList(idx);

    res.json({"result": true, "data": result});
}

exports.updateSettleStatus = async function (req, res) {
    const { idx, status, bigo, changedBy } = req.body

    // 필수값 체크
    if (!idx || status === undefined) {
        return res.json({ result: false, message: '필수 파라미터 누락' })
    }

    // 미수처리(2)인데 사유 없으면 거부
    if (Number(status) === 2 && !bigo?.trim()) {
        return res.json({ result: false, message: '미수 사유를 입력해주세요.' })
    }

    try {
        // 현재 상태 조회 (history의 orgStatus 기록용)
        const current = await settleModel.getSettleById(idx)

        console.log(current)

        if (!current) {
            return res.json({ result: false, message: '존재하지 않는 정산 건입니다.' })
        }

        // 상태 업데이트
        await settleModel.updateSettleStatus(idx, status, bigo)

        // 이력 기록
        await settleModel.insertSettleHistory(idx, current.status, status, (changedBy || null))

        return res.json({ result: true })
    } catch (e) {
        console.error('updateSettleStatus error:', e)
        return res.json({ result: false, message: '처리 중 오류가 발생했습니다.' })
    }
}

exports.setSettleMember = async function (req, res) {
    const cIdx = req.user.cIdx;
    const {
        sIdx, idx, year, month, type, docNo, billingDt,
        subTotal, vatAmount, grandTotal,
        billingData
    } = req.body;

    try {
        // JSON 데이터를 DB에 넣기 위해 문자열로 변환
        const strBillingData = JSON.stringify(billingData);

        if (idx) {
            // ============================================
            // 1. idx가 존재하면 기존 데이터 수정 (UPDATE)
            // ============================================
            let result = await settleModel.updateSettleMember(
                year, month, type, docNo, billingDt,
                subTotal, vatAmount, grandTotal,
                strBillingData,
                idx, sIdx
            );
            return res.json({ result: true, data: result });

        } else {
            // ============================================
            // 2. idx가 없으면 새 문서 작성 (INSERT)
            // ============================================
            let result = await settleModel.setSettleMember(
                sIdx, cIdx, year, month, docNo, type, billingDt,
                subTotal, vatAmount, grandTotal,
                strBillingData
            );

            return res.json({ result: true, data: result });
        }

    } catch (err) {
        console.error("정산서 저장 에러:", err);
        return res.status(500).json({ result: false, msg: '데이터베이스 처리 중 오류가 발생했습니다.' });
    }
}
