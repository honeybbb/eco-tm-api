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
        status = req.body.status ?? null,
        bigo = req.body.bigo ?? req.body.note ?? null,
        sIdx = req.body.sIdx; // 투입단지 (0 = 본사)

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

        // 투입 단지가 지정된 경우 최초 배치 레코드 삽입 (sIdx=0은 본사)
        // fromSidx = sIdx 로 저장(자가 입고): 신규 등록은 "그 자리에 입고"로 간주해
        // 집계 시 상쇄 없이 순입고 처리되도록 함.
        const newEqIdx = result?.insertId;
        if (newEqIdx && sIdx !== undefined && sIdx !== null && sIdx !== '') {
            const dest = Number(sIdx);
            await eqModel.setEquipmentAssignment(
                newEqIdx,
                dest,                           // fromSidx = sIdx (자가 입고)
                dest,
                Number(totalQty) || 0,
                purchaseDt || null,
                bigo,
                1                               // status: 1 = 사용 중
            );
        }

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

    // 3. Model 호출: 하위 이력 테이블 4개 병렬 조회 (Promise.all 활용)
    let [assignments, repairs, transactions, discards] = await Promise.all([
        eqModel.getEquipmentAssignment(eqIdxs),
        eqModel.getEquipmentRepair(eqIdxs),
        eqModel.getEquipmentTransaction(eqIdxs),
        eqModel.getEquipmentDiscard(eqIdxs)
    ]);

    // 4. 비즈니스 로직: 프론트엔드에서 쓰기 좋게 각각의 장비 객체 안에 이력 배열을 매핑 (조립)
    result.forEach(eq => {
        eq.assignments = assignments.filter(a => a.eqIdx === eq.idx);
        eq.repairs = repairs.filter(r => r.eqIdx === eq.idx);
        eq.transactions = transactions.filter(t => t.eqIdx === eq.idx);
        eq.discards = discards.filter(d => d.eqIdx === eq.idx);
    });

    // 5. 최종 완성된 데이터 반환
    res.json({'result': true, 'data':result});
}


//장비 이동 (출발지 → 도착지로 이동 이력 레코드 insert)
exports.moveEquipment = async function (req, res) {
    let eqIdx = req.body.eqIdx,
        fromSite = Number(req.body.fromSite),       // 출발지 sIdx (0 = 본사)
        toSite = Number(req.body.toSite),           // 도착지 sIdx
        qty = Number(req.body.qty) || 1,
        date = req.body.date || null,
        manager = req.body.manager;

    if (eqIdx === undefined || eqIdx === null) {
        return res.status(400).json({ result: false, msg: 'eqIdx가 없습니다.' });
    }
    if (Number.isNaN(fromSite) || Number.isNaN(toSite)) {
        return res.status(400).json({ result: false, msg: '출발지/도착지가 올바르지 않습니다.' });
    }
    if (fromSite === toSite) {
        return res.status(400).json({ result: false, msg: '출발지와 도착지가 동일합니다.' });
    }

    const bigo = manager ? `탁송자: ${manager}` : null;

    try {
        const result = await eqModel.setEquipmentAssignment(
            eqIdx, fromSite, toSite, qty, date, bigo, 1
        );
        res.json({ result: true, data: result });
    } catch (error) {
        console.error('장비 이동 DB 에러:', error);
        res.status(500).json({ result: false, msg: '서버 에러 발생' });
    }
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

// 수리/점검 이력 등록 (INSERT) — before 사진 포함
exports.repairEquipment = async function (req, res) {
    const eqIdx = req.body.eqIdx;
    const sIdx = req.body.sIdx ?? null;
    const repairDt = req.body.repairDt || req.body.date || null;
    const repairType = req.body.repairType || req.body.type || 'repair';
    const startDt = req.body.startDt || null;
    const endDt = req.body.endDt || null;
    const content = req.body.content || '';
    const repairCenter = req.body.repairCenter || req.body.center || null;
    const cost = Number(req.body.cost) || 0;
    const expense = Number(req.body.expense) || 0;
    const managerId = req.user?.managerId || req.body.managerId || null;
    const updateStatus = req.body.updateStatus === true || req.body.updateStatus === 'true';

    // before 사진 파일(들)
    let beforeImgPath = '';
    if (req.files && req.files.length > 0) {
        beforeImgPath = req.files.map(f => `/uploads/${f.filename}`).join(',');
    }

    if (eqIdx === undefined || eqIdx === null) {
        return res.status(400).json({ result: false, msg: 'eqIdx가 없습니다.' });
    }
    if (!repairDt) {
        return res.status(400).json({ result: false, msg: '수리 일자가 없습니다.' });
    }
    if (!content) {
        return res.status(400).json({ result: false, msg: '수리/점검 내용이 없습니다.' });
    }

    try {
        const result = await eqModel.setEquipmentRepair(
            eqIdx, sIdx, repairDt, repairType, startDt, endDt,
            content, repairCenter, beforeImgPath || null, cost, expense, managerId
        );
        if (updateStatus) {
            await eqModel.updateEquipmentStatus(eqIdx, 1); // 1 = 수리/점검중
        }
        res.json({ result: true, data: result });
    } catch (error) {
        console.error('수리 등록 DB 에러:', error);
        res.status(500).json({ result: false, msg: '서버 에러 발생' });
    }
}

// 수리 완료 처리 (after 사진 업로드 + 완료일 기록 + 장비 상태 복원)
exports.completeRepair = async function (req, res) {
    const repairIdx = req.params.repairIdx;
    const eqIdx = req.body.eqIdx;
    const completedDt = req.body.completedDt || req.body.date || new Date().toISOString().slice(0, 10);
    const restoreStatus = req.body.restoreStatus === true || req.body.restoreStatus === 'true';

    let afterImgPath = null;
    if (req.files && req.files.length > 0) {
        afterImgPath = req.files.map(f => `/uploads/${f.filename}`).join(',');
    }

    if (!repairIdx) {
        return res.status(400).json({ result: false, msg: 'repairIdx가 없습니다.' });
    }

    try {
        const result = await eqModel.completeEquipmentRepair(repairIdx, completedDt, afterImgPath);
        if (restoreStatus && eqIdx) {
            await eqModel.updateEquipmentStatus(eqIdx, 0); // 0 = 정상
        }
        res.json({ result: true, data: result });
    } catch (error) {
        console.error('수리 완료 DB 에러:', error);
        res.status(500).json({ result: false, msg: '서버 에러 발생' });
    }
}

//장비 폐기 (장비 마스터 전체 상태 변경 - 레거시)
exports.disposeEquipment = async function (req, res) {
    let eqIdx = req.params.idx;

    let result = await eqModel.disposeEquipment(eqIdx);

    res.json({'result': true, 'data':result})
}

// 부분 폐기 처리 (특정 현장의 특정 수량)
exports.discardEquipment = async function (req, res) {
    const eqIdx = req.body.eqIdx;
    const sIdx = req.body.sIdx;
    const qty = Number(req.body.qty) || 0;
    const discardDt = req.body.discardDt || req.body.date || null;
    const reason = req.body.reason || null;
    const managerId = req.user?.managerId || req.body.managerId || null;

    if (eqIdx === undefined || eqIdx === null) {
        return res.status(400).json({ result: false, msg: 'eqIdx가 없습니다.' });
    }
    if (sIdx === undefined || sIdx === null || sIdx === '') {
        return res.status(400).json({ result: false, msg: '대상 현장이 없습니다.' });
    }
    if (qty <= 0) {
        return res.status(400).json({ result: false, msg: '폐기 수량이 올바르지 않습니다.' });
    }

    try {
        const result = await eqModel.setEquipmentDiscard(
            eqIdx, Number(sIdx), qty, discardDt, reason, managerId
        );
        res.json({ result: true, data: result });
    } catch (error) {
        console.error('장비 폐기 DB 에러:', error);
        res.status(500).json({ result: false, msg: '서버 에러 발생' });
    }
}