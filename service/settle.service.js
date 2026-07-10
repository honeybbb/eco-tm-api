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

exports.getSettlePayroll = async function (req, res) {
    let cIdx = req.user.cIdx,
        year = req.query.year,
        month = req.query.month,
        sIdx = req.query.sIdx;

    let result = await settleModel.getSettlePayroll(cIdx, year, month, sIdx);

    res.json({'result': true, 'data': result})
}

//급여총액 조회
exports.getSettleSummary = async function (req, res) {
    let
        // cIdx = req.user.cIdx,
        year = req.query.year,
        month = req.query.month;

    let result = await settleModel.getSettleSummary(year, month);

    res.json({'result': true, 'data': result})
}

//청구현황 조회
exports.getSettleBilling = async function (req, res) {
    let cIdx = req.user.cIdx,
        year = req.query.year,
        month = req.query.month;

    let result = await settleModel.getSettleBilling(cIdx, year, month);

    res.json({'result': true, 'data': result});
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
