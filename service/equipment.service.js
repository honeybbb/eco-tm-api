const eqModel = require("../model/equipment.model")

//장비 등록
exports.setEquipment = async function (req, res) {
    let cIdx = req.body.cIdx,
        name = req.body.name,
        type = req.body.type,
        model = req.body.model, //모델명
        imgPath = req.body.imgPath, //이미지path
        serialNo = req.body.serialNo, //일련번호
        purchaseDt = req.body.purchaseDt, //구매일
        status = req.body.status,
        bigo = req.body.bigo;

    let result = await eqModel.setEquipment(cIdx, name, type, model, imgPath, serialNo, purchaseDt, status, bigo);

    res.json({'result': true, 'data':result})

}

//장비 리스트
exports.getEquipmentList = async function (req, res) {
    let cIdx = req.params.cIdx;

    let result = await eqModel.getEquipmentList(cIdx);

    res.json({'result': true, 'data':result})
}

//장비 조회
exports.getEquipmentData = async function (req, res) {
    let idx = req.params.idx;

    let result = await eqModel.getEquipmentData(idx);

    res.json({'result': true, 'data':result})
}

//장비 배치
exports.setEquipmentSite = async function (req, res) {
    let eqIdx = req.body.eqIdx,
        sIdx = req.body.sIdx,
        assignDt = req.body.assignDt,
        bigo = req.body.bigo,
        status = req.body.status;

    let result = await eqModel.setEquipmentSite(eqIdx, sIdx, assignDt, bigo, status);

    res.json({'result': true, 'data':result})
}
