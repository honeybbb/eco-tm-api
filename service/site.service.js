const siteModel = require("../model/site.model");

exports.getSiteList = async function (req, res) {
    let cIdx = req.user.cIdx;

    let result = await siteModel.getSiteList(cIdx);

    res.json({'result': true, 'data': result})
}

exports.setSiteBigo = async function (req, res) {
    let sIdx = req.body.sIdx,
        bigo = req.body.bigo,
        admin = req.body.admin;

    let result = await siteModel.setSiteBigo(sIdx, bigo, admin);
    res.json({'result': true, 'data': result})
}

exports.setSiteOrderBudgets = async function (req, res) {
    let sIdx = req.body.cIdx,
        value = req.body.value,
        admin = req.body.admin;

    let result = await siteModel.setSiteOrderBudgets(sIdx, value, admin);
    res.json({'result': true, 'data': result})
}

exports.setSiteData = async function (req, res) {
    let cIdx = req.body.cIdx,
        name = req.body.name,
        address = req.body.address,
        phone = req.body.phone,
        bigo = req.body.bigo,
        building_su = req.body.building_su,
        unit_su = req.body.unit_su,
        area = req.body.area;

    console.log(cIdx, name, address, phone, bigo, building_su, unit_su, area);
    //return;

    let result = await siteModel.setSiteData(cIdx, name, address, phone, bigo, building_su, unit_su, area);

    res.json({'result': true, 'data': result})
}

exports.registerSiteWithContract = async function (req, res) {
    try {
        console.log(req.body);
        // ====================================================
        // Step 1. 현장(Site) 데이터 준비
        // ====================================================
        let siteData = {
            sIdx: req.body.sIdx,
            sType: req.body.sType, //건물타입
            cIdx: req.body.cIdx,
            name: req.body.name,
            // site_id: req.body.site_id,
            // type: req.body.type,
            status: req.body.status,
            area: req.body.area,//연면적
            areaUnder: req.body.areaUnder, //135
            areaOver: req.body.areaOver,
            is_vat: req.body.is_vat,
            building_su: req.body.building_su,
            unit_su: req.body.unit_su,
            zipcode: req.body.postalCode,
            address: req.body.address,
            address_detail: req.body.addressDetail,
            payment_day: req.body.payment_day,

            businessNumber: req.body.businessNumber || '',
            representative: req.body.representative || '',
            businessType: req.body.businessType || '',
            businessItem: req.body.businessItem || '',
            email: req.body.email || '',

            phone: req.body.phone || '',
            manager: req.body.manager || '',
            director: req.body.director,
            director_phone: req.body.directorContact,
            billingManager: req.body.billingManager,
            payrollManager: req.body.payrollManager,
            bigo: req.body.bigo || '',

            viewConfig: req.body.viewConfig || null,
        };

        // console.log(siteData, 'siteData');

        let siteResult = await siteModel.saveSite(siteData);

        if (!siteResult.success) {
            return res.json({ 'result': false, 'message': '현장 저장 실패', error: siteResult.error });
        }

        const targetSIdx = siteResult.sIdx; // 저장/수정된 현장 ID

        // ====================================================
        // Step 2. 계약(Contract) 데이터 반복 처리
        // ====================================================

        // JSON 파싱
        let contractList = [];
        try {
            if (req.body.contract_details) {
                contractList = (typeof req.body.contract_details === 'string')
                    ? JSON.parse(req.body.contract_details)
                    : req.body.contract_details;
            }
        } catch (e) {
            console.error("JSON Parse Error", e);
        }

        if (Array.isArray(contractList) && contractList.length > 0) {
            for (const contractItem of contractList) {

                // 인원수 합계 계산 (데이터 무결성을 위해 서버에서 계산 추천)
                let currentStaffCount = 0;
                if(contractItem.staffList && Array.isArray(contractItem.staffList)){
                    currentStaffCount = contractItem.staffList.reduce((acc, cur) => acc + (Number(cur.count)||0), 0);
                }
                console.log(contractItem, 'contractItem')
                // 개별 계약 데이터 객체 생성
                let contractData = {
                    scIdx: contractItem.scIdx,
                    sIdx: targetSIdx,          //현장idx
                    cIdx: req.body.cIdx,
                    type: contractItem.type,

                    // 상세 데이터
                    workDays: contractItem.workDays,
                    totalCost: contractItem.totalCost || 0,
                    startDt: contractItem.contractStart,
                    endDt: contractItem.contractEnd,
                    staffCount: currentStaffCount,
                    staffDetail: JSON.stringify(contractItem.staffList),
                    workSchedule: contractItem.workSchedule,
                    breaktime: contractItem.breakTime,
                    costBreakdown: JSON.stringify(contractItem.costBreakdown),
                    isAutoCalc: contractItem.isAutoCalc === 'N' ? 'N' : 'Y'
                };

                // 개별 계약 저장
                //await siteModel.saveContract(contractData);
                let contractResult = await siteModel.saveContract(contractData);

                if (contractResult.success) {
                    // ★ 2. 방금 저장된 계약의 PK(scIdx)를 받아와서 직책별 근무 스케줄(workhours) 저장
                    const savedCtIdx = contractResult.scIdx;

                    // 프론트에서 받은 staffList 원본 (JSON 변환 안 된 상태) 그대로 넘김
                    await siteModel.syncWorkContracts(savedCtIdx, targetSIdx, contractItem.staffList);
                }
            }
        }

        // 성공 응답
        res.json({ 'result': true, 'data': targetSIdx });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 'result': false, 'message': '서버 에러 발생' });
    }
};

exports.registerBudget = async function (req, res) {
    let sIdx = req.body.sIdx,
        jsonData = req.body.jsonData;

    let result = await siteModel.registerBudget(sIdx, jsonData);

    res.json({ 'result': true, 'data': result });
}

exports.getSiteBudget = async function (req, res) {
    let sIdx = req.query.sIdx,
        type = req.query.type;

    if(!sIdx) return res.json({ 'result': false, 'msg': '현장 인덱스 정보가 없습니다.' });

    let result = await siteModel.getSiteBudget(sIdx, type);

    res.json({ 'result': true, 'data': result });
}

exports.updateSiteData = async function (req, res) {
    let sIdx = req.body.sIdx,
        name = req.body.name,
        address = req.body.address,
        phone = req.body.phone,
        bigo = req.body.bigo,
        building_su = req.body.building_su,
        unit_su = req.body.unit_su,
        area = req.body.area;

    let result = await siteModel.updateSiteData(sIdx, name, address, phone, bigo, building_su, unit_su, area);

    res.json({'result': true, 'data': result})
}

exports.DeleteSite = async function (req, res) {
    let cIdx = req.user.cIdx,
        sIdx = req.params.id;

    let result = await siteModel.DeleteSite(cIdx, sIdx);

    res.json({'result': true, 'data': result})
}

//현장 배치 정보 저장
exports.setSiteHeadCount = async function (req, res) {
    let cIdx = req.params.cIdx,
        sIdx = req.body.sIdx,
        jsonData = req.body.jsonData;

    let result = await siteModel.setSiteHeadCount(cIdx, sIdx, jsonData);

    res.json({'result': true, 'data': result})
}

exports.getSiteHeadCount = async function (req, res) {
    let sIdx = req.params.sIdx;

    let result = await siteModel.getSiteHeadCount(sIdx);

    res.json({'result': true, 'data': result})
}

exports.getAssignedStaff = async function (req, res) {
    const sIdx = req.params.sIdx;

    try {
        const result = await siteModel.getAssignedStaff(sIdx);
        if (result) {
            //console.log(result, 'r')
            res.json({ result: true, data: result });
        } else {
            res.json({ result: false, msg: '배치된 직원이 없습니다.' });
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ result: false, msg: '서버 에러' });
    }
}
/*
exports.getSiteData = async function (req, res) {
    const sIdx = req.params.sIdx;
    if(!sIdx) return res.json({ 'result': false, message: '해당 현장 정보가 없습니다.' });

    try {
        const result = await siteModel.getSiteData(sIdx);

        if (result) {
            res.json({ result: true, data: result });
        } else {
            res.json({ result: false, message: '해당 현장 정보가 없습니다.' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ result: false, message: '서버 에러' });
    }
};

 */
exports.getSiteData = async function (req, res) {
    const sIdx = req.params.sIdx;
    if(!sIdx) return res.json({ 'result': false, message: '현장 index 정보가 없습니다.' });

    try {
        // 1. 기본 현장 및 계약 정보 가져오기
        const result = await siteModel.getSiteData(sIdx);

        if (result && result.length > 0) {
            const siteData = result[0]; // 현장 데이터 1건

            // 2. 추가로 해당 현장의 근무 스케줄 가져오기
            const schedules = await siteModel.getWorkContracts(sIdx);

            // 3. 스케줄 데이터를 매핑하기 쉽게 변환 { scIdx(계약idx): { position(직책코드): JSON스케줄 } }
            const scheduleMap = {};
            if (schedules && schedules.length > 0) {
                for (const s of schedules) {
                    if (!scheduleMap[s.scIdx]) scheduleMap[s.scIdx] = {};

                    // DB의 JSON 컬럼이 string으로 넘어올 수 있으므로 안전하게 파싱
                    scheduleMap[s.scIdx][s.position] = typeof s.workhours === 'string' ? JSON.parse(s.workhours) : s.workhours;
                }
            }

            // 4. 현장 데이터 안의 contractList에 스케줄 데이터 주입 (Merge)
            if (siteData.contractList && siteData.contractList !== '[null]') {
                let contracts = JSON.parse(siteData.contractList);

                contracts.forEach(contract => {
                    if (contract.staffList) {
                        // staffList 파싱 (문자열로 저장된 배열)
                        let staffArr = typeof contract.staffList === 'string' ? JSON.parse(contract.staffList) : contract.staffList;

                        staffArr.forEach(staff => {
                            // 현재 계약(contract.scIdx)의 해당 직책(staff.code)에 매핑된 스케줄이 있다면 삽입!
                            if (scheduleMap[contract.scIdx] && scheduleMap[contract.scIdx][staff.code]) {
                                staff.schedule = scheduleMap[contract.scIdx][staff.code];
                            }
                        });

                        // 변경된 객체 배열로 덮어씌우기
                        contract.staffList = staffArr;
                    }
                });

                // 프론트엔드가 `JSON.parse(result.contractList)`를 기대하므로, 다시 문자열로 만들어서 덮어씌움
                siteData.contractList = JSON.stringify(contracts);
            }

            // 5. 프론트로 조립된 데이터 응답
            res.json({ result: true, data: [siteData] });

        } else {
            res.json({ result: false, message: '해당 현장 정보가 없습니다.' });
        }
    } catch (e) {
        console.error("getSiteData 에러:", e);
        res.status(500).json({ result: false, message: '서버 에러' });
    }
};

exports.getSiteCoords = async function (req, res) {
    let sIdx = req.params.sIdx;
    let result = await siteModel.getSiteCoords(sIdx);
    res.json({ result: true, data: result });
}

exports.setAccountBill = async function (req, res) {
    let dno = req.body.dno, //문서번호
        cIdx = req.body.cIdx,
        sIdx = req.body.sIdx,
        date = req.body.date,
        receiver  = req.body.receiver,
        title = req.body.title,
        period1 = req.body.period1,
        period2 = req.body.period2,
        jsonData = req.body.jsonData,
        areaData = req.body.areaData,
        amount = req.body.amount;   //합계

    let result = await siteModel.setAccountBill(dno, cIdx, sIdx, date, receiver, title, period1, period2, jsonData, areaData, amount)

    res.json({'result': true, 'data': result})
}

exports.getAccountBillList = async function (req, res) {
    let year = req.query.year,
        month = req.query.month;

    let result = await siteModel.getAccountBillList(year, month);

    res.json({'result': true, 'data': result})
}

exports.getAccountBill = async function (req, res) {
    let year = req.query.year,
        month = req.query.month,
        sIdx = req.query.sIdx,
        cIdx = req.query.cIdx;

    let result = await siteModel.getAccountBill(year, month, sIdx, cIdx);

    res.json({'result': true, 'data': result})
}

exports.setSiteEstimate = async function (req, res) {
    let sIdx = req.params.sIdx,
        cIdx = req.body.cIdx,
        jsonData = req.body.jsonData,
        total = req.body.total;

    let result = await siteModel.setSiteEstimate(sIdx, cIdx, jsonData, total);

    res.json({'result': true, 'data': result})
}
