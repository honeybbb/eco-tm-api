const eqModel = require("../model/equipment.model")

//장비 등록
exports.setEquipment = async function (req, res) {
    let cIdx = req.user ? req.user.cIdx : 1, // (인증 미들웨어가 없다면 에러 방지용)
        type = req.body.type, //itemCd
        name = req.body.name,
        model = req.body.model,
        serialNo = req.body.serialNo,
        totalQty = req.body.totalQty,
        purchaseDt = req.body.purchaseDt,
        supplyPrice = req.body.supplyPrice, //공급가
        vat = req.body.vat,//부가세
        totalPrice = req.body.totalPrice,//판매가
        status = req.body.status,
        bigo = req.body.bigo;

    // 다중 이미지 파일 경로 처리 추가
    let imgPath = '';
    if (req.files && req.files.length > 0) {
        // 여러 장의 이미지 경로를 콤마(,)로 이어붙인 문자열로 변환 (예: /uploads/img1.jpg,/uploads/img2.jpg)
        imgPath = req.files.map(file => `/uploads/${file.filename}`).join(',');
    }

    let filePath = '';


    try {
        let result = await eqModel.setEquipment(
            cIdx, name, type, model, serialNo, totalQty, purchaseDt,
            supplyPrice, vat, totalPrice,
            imgPath, filePath, status, bigo
        );
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

//장비 리스트 v2
exports.getEquipmentList_v2 = async function (req, res) {
    let cIdx = req.user.cIdx;

    //장비 마스터 데이터
    let result = await eqModel.getEquipmentList_v2(cIdx);
    // 장비가 아예 없으면 빈 배열 바로 반환
    if (!result || result.length === 0) {
        res.json({'result': true, 'data':result});
    }

    let eqIdxs = result.map(eq => eq.idx);

    // 3. Model 호출: 하위 이력 테이블 3개 병렬 조회 (Promise.all 활용)
    let [assignments, repairs, transactions] = await Promise.all([
        eqModel.getEquipmentAssignment(eqIdxs),
        eqModel.getEquipmentRepair(eqIdxs),
        eqModel.getEquipmentTransaction(eqIdxs)
    ]);

    // 4. 비즈니스 로직: 프론트엔드에서 쓰기 좋게 각각의 장비 객체 안에 이력 배열을 매핑 (조립)
    result.forEach(eq => {
        eq.assignments = assignments.filter(a => a.eqIdx === eq.idx);
        eq.repairs = repairs.filter(r => r.eqIdx === eq.idx);
        eq.transactions = transactions.filter(t => t.eqIdx === eq.idx);
    });

    // 5. 최종 완성된 데이터 반환
    res.json({'result': true, 'data':result});
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

//장비 폐기
exports.disposeEquipment = async function (req, res) {
    let eqIdx = req.params.idx;

    let result = await eqModel.disposeEquipment(eqIdx);

    res.json({'result': true, 'data':result})
}