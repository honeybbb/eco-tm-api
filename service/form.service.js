const formModel = require("../model/form.model");

exports.setFormAccident = async function (req, res) {
    let sIdx = req.body.sIdx,
        cIdx = req.body.cIdx,
        siteName = req.body.siteName,
        issueDt = req.body.issueDt,
        victim_name = req.body.victim_name,
        victim_phone = req.body.victim_phone,
        victim_hire_date = req.body.victim_hire_date,
        victim_contract_end = req.body.victim_contract_end,
        victim_address = req.body.victim_address,
        witness_name = req.body.witness_name,
        witness_phone = req.body.witness_phone,
        witness_address = req.body.witness_address,
        description = req.body.description,
        approval_status = req.body.approval_status,
        created_by = req.body.created_by,   //작성자
        created_at = req.body.created_at,
        updated_at = req.body.updated_at;

    let result = await formModel.setFormAccident(sIdx, cIdx, siteName, issueDt, description, created_by, created_at, updated_at);

    res.json({'result': true, 'data':result})
}

exports.getFormAccidentData = async function (req, res) {
    let idx = req.params.idx;

    let result = await formModel.getFormAccidentData(idx);

    res.json({'result': true, 'data':result})
}


exports.setFormRepairRequest = async function (req, res) {
    let siteName = req.body.siteName,
        startDt = req.body.startDt, //계약기간시작
        endDt = req.body.endDt, //계약기간종료
        eqName = req.body.eqName,
        description = req.body.description, //사유, 내용등
        file_edit1 = req.body.file_edit1,
        file_edit2 = req.body.file_edit2,
        file_edit3 = req.body.file_edit3,
        bigo = req.body.bigo;

    let result = await formModel.setFormRepairRequest(siteName, startDt, endDt, eqName, description, file_edit1, file_edit2, file_edit3, bigo);

    res.json({'result': true, 'data':result})
}

exports.getFormIndustrialAccident = async function (req, res) {
    let sIdx = req.body.sIdx,
        cIdx = req.body.cIdx;


}
