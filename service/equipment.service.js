const eqModel = require("../model/equipment.model")

//장비 등록
exports.setEquipment = async function (req, res) {
    let cIdx = req.user ? req.user.cIdx : 1, // (인증 미들웨어가 없다면 에러 방지용)
        type = req.body.type,
        name = req.body.name,
        model = req.body.model,
        serialNo = req.body.serialNo,
        totalQty = req.body.totalQty,
        purchaseDt = req.body.purchaseDt,
        mfgDt = req.body.mfgDt,
        price = req.body.price,
        status = req.body.status,
        bigo = req.body.bigo;

    // 다중 이미지 파일 경로 처리 추가
    let imgPath = '';
    if (req.files && req.files.length > 0) {
        // 여러 장의 이미지 경로를 콤마(,)로 이어붙인 문자열로 변환 (예: /uploads/img1.jpg,/uploads/img2.jpg)
        imgPath = req.files.map(file => `/uploads/${file.filename}`).join(',');
    }


    try {
        let result = await eqModel.setEquipment(cIdx, name, type, model, serialNo, totalQty, purchaseDt, mfgDt, price, imgPath, status, bigo);
        res.json({'result': true, 'data': result});
    } catch (error) {
        console.error('장비 등록 DB 에러:', error);
        res.status(500).json({'result': false, 'msg': '서버 에러 발생'});
    }
}

//장비 리스트
exports.getEquipmentList = async function (req, res) {
    let cIdx = req.user.cIdx;

    let result = await eqModel.getEquipmentList(cIdx);

    res.json({'result': true, 'data':result})
}


//장비 배치
exports.moveEquipment = async function (req, res) {
    let eqIdx = req.body.eqIdx,
        fromSite = req.body.fromSite,
        toSite = req.body.toSite,
        qty = req.body.qty,
        date = req.body.date;

    console.log(eqIdx, fromSite, toSite, qty, date);
    return;

    let result = await eqModel.moveEquipment(eqIdx, fromSite, toSite, qty, date);

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

exports.repairEquipment = async function (req, res) {
    let eqIdx = req.body.eqIdx,
        sIdx = req.body.sIdx,
        repairType = req.body.repairType,
        content = req.body.content,
        cost = req.body.cost;

    let result = await eqModel.repairEquipment(eqIdx, sIdx, repairType, content, cost);

    res.json({'result': true, 'data':result})
}