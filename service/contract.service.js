const contractModel = require("../model/contract.model")

//직원 근로계약서 작성
exports.setMemberContract = async function (req, res) {
    let mIdx = req.params.mIdx,
        startDt = req.body.startDt, //계약시작일
        endDt = req.body.endDt, //계약종료일
        sIdx = req.body.sIdx, //현장idx
        job = req.body.job, //직무
        jsonData = req.body.jsonData, //임금
        bigo = req.body.bigo; //비고

    console.log(req.body);

    let result = await contractModel.setMemberContract(mIdx, sIdx, job, jsonData, startDt, endDt, bigo);

    res.json({'result': true, 'data': result})
}

exports.getMemberContract = async function (req, res) {
    let mIdx = req.params.mIdx;

    let result = await contractModel.getMemberContract(mIdx);

    res.json({'result': true, 'data': result})
}

//현장 계약
exports.setSiteContract = async function (req, res) {
    let sIdx = req.params.sIdx,
        cIdx = req.body.cIdx,
        contract = req.body.contract,
        totalCost = req.body.totalCost,
        startDt = req.body.contractStart,
        endDt = req.body.contractEnd;

    let result = await contractModel.setSiteContract(sIdx, cIdx, contract, totalCost, startDt, endDt);

    res.json({'result': true, 'data': result})
}
