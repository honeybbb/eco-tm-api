const settleModel = require("../model/settle.model");

exports.getSettleList = async function (req, res) {
    let year = req.query.year,
        month = req.query.month;

    let result = await settleModel.getSettleList(year, month);

    res.json({"result": true, "data": result});
}

exports.setSettleData = async function (req, res) {
    const sIdx = req.params.sIdx;
    const {
        idx, year, month, type, docNo, billingDt,
        subTotal, vatAmount, grandTotal,
        billingData, payrollData
    } = req.body;

    try {
        // JSON 데이터를 DB에 넣기 위해 문자열로 변환
        const strBillingData = JSON.stringify(billingData);
        const strPayrollData = JSON.stringify(payrollData);

        if (idx) {
            // ============================================
            // 1. idx가 존재하면 기존 데이터 수정 (UPDATE)
            // ============================================
            let result = await settleModel.updateSettleData(
                year, month, type, docNo, billingDt,
                subTotal, vatAmount, grandTotal, strBillingData, strPayrollData, idx, sIdx);
            return res.json({ result: true, data: result });

        } else {
            // ============================================
            // 2. idx가 없으면 새 문서 작성 (INSERT)
            // ============================================
            const cIdx = req.body.cIdx;

            console.log(sIdx, cIdx, year, month, docNo, type, billingDt,
                subTotal, vatAmount, grandTotal,
                strBillingData, strPayrollData)

            let result = await settleModel.setSettleData(
                sIdx, cIdx, year, month, docNo, type, billingDt,
                subTotal, vatAmount, grandTotal,
                strBillingData, strPayrollData)

            return res.json({ result: true, data: result });
        }

    } catch (err) {
        console.error("정산서 저장 에러:", err);
        return res.status(500).json({ result: false, msg: '데이터베이스 처리 중 오류가 발생했습니다.' });
    }
}
