const settleModel = require("../model/settle.model");

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
