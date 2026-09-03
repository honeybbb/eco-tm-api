const siteModel = require("../model/site.model");
const memberModel = require("../model/member.model");
const { decodeLatin1ToUtf8 } = require("../utils/password");

exports.getSiteList = async function (req, res) {
    let cIdx = req.user.cIdx;

    let result = await siteModel.getSiteList(cIdx);

    res.json({'result': true, 'data': result})
}

exports.getSiteList_v2 = async function (req, res) {
    let cIdx = req.user.cIdx;

    // 1. 모델단에서 순수 DB 쿼리 결과를 가져옵니다.
    let result = await siteModel.getSiteList(cIdx);
    let members = await memberModel.getMemberAvailable(cIdx)

    // DB 에러 방어 코드
    if (result && result.data === '-9999') {
        return res.json({'result': false, 'msg': '데이터베이스 오류가 발생했습니다.'});
    }

    // 2. 서비스단 비즈니스 로직 (금액 및 횟수 가공)
    result = result.map(site => {
        if (site.contracts) {
            // DB에서 넘어온 contracts가 문자열이면 배열로 파싱
            let contractsArr = typeof site.contracts === 'string' ? JSON.parse(site.contracts) : site.contracts;

            contractsArr = contractsArr.map(c => {
                let cleaningExpense = 0;
                let cleaningSupplies = 0;
                let otherExpense = 0;
                let managementFee = 0;
                let profit = 0;
                let cleaningCount = 0;

                // 1. 인원수 데이터 준비
                let staffArr = c.staffDetail || [];
                if (typeof staffArr === 'string') {
                    try { staffArr = JSON.parse(staffArr); } catch(e) { staffArr = []; }
                }

                // 2. 단가 데이터 준비
                let jsonData = c.jsonData || {};
                if (typeof jsonData === 'string') {
                    try { jsonData = JSON.parse(jsonData); } catch(e) { jsonData = {}; }
                }

                // 3. 대청소비 & 기타제경비 계산 (단가 * 인원수)
                if (jsonData.expenses && Array.isArray(jsonData.expenses)) {
                    jsonData.expenses.forEach(exp => {
                        if (exp.code && String(exp.code).startsWith('04003001')) { // 대청소비
                            if (exp.values) {
                                Object.entries(exp.values).forEach(([staffCode, val]) => {
                                    const amount = Number(val) || 0;
                                    const staff = staffArr.find(s => s.code === staffCode);
                                    const count = staff ? (Number(staff.count) || 0) : 0;
                                    cleaningExpense += (amount * count);
                                });
                            }
                        } else if (exp.code && String(exp.code).startsWith('04003002')) { // 기타제경비
                            if (exp.values) {
                                Object.entries(exp.values).forEach(([staffCode, val]) => {
                                    const amount = Number(val) || 0;
                                    const staff = staffArr.find(s => s.code === staffCode);
                                    const count = staff ? (Number(staff.count) || 0) : 0;
                                    cleaningSupplies += (amount * count);
                                });
                            }
                        } else if (exp.code && String(exp.code).startsWith('04003004')) { // 기타제경비
                            if (exp.values) {
                                Object.entries(exp.values).forEach(([staffCode, val]) => {
                                    const amount = Number(val) || 0;
                                    const staff = staffArr.find(s => s.code === staffCode);
                                    const count = staff ? (Number(staff.count) || 0) : 0;
                                    otherExpense += (amount * count);
                                });
                            }
                        }
                    });
                }

                // 4. 일반관리비 계산 (단가 * 인원수)
                if (jsonData.managementFee) {
                    Object.entries(jsonData.managementFee).forEach(([staffCode, val]) => {
                        const amount = Number(val) || 0;
                        const staff = staffArr.find(s => s.code === staffCode);
                        const count = staff ? (Number(staff.count) || 0) : 0;
                        managementFee += (amount * count);
                    });
                }

                // 5. 기업이윤 계산 (단가 * 인원수)
                if (jsonData.profit) {
                    Object.entries(jsonData.profit).forEach(([staffCode, val]) => {
                        const amount = Number(val) || 0;
                        const staff = staffArr.find(s => s.code === staffCode);
                        const count = staff ? (Number(staff.count) || 0) : 0;
                        profit += (amount * count);
                    });
                }

                // 6. 대청소 횟수 계산
                const processItems = (items) => {
                    let cnt = 0;
                    items.forEach(item => { if (item.name && item.count) cnt += (Number(item.count) || 0); });
                    return cnt;
                };
                if (c.cleaningConfig && Array.isArray(c.cleaningConfig)) {
                    cleaningCount = processItems(c.cleaningConfig);
                } else if (jsonData.cleaningConfig && Array.isArray(jsonData.cleaningConfig)) {
                    cleaningCount = processItems(jsonData.cleaningConfig);
                }

                return {
                    ...c,
                    cleaningExpense,
                    cleaningSupplies,
                    otherExpense,
                    managementFee,
                    profit,
                    cleaningCount
                };
            });

            site.contracts = contractsArr;
        }
        return site;
    });

    // 3. 가공 완료된 데이터를 프론트엔드로 응답합니다.
    res.json({'result': true, 'data': result});
}

exports.setSiteBigo = async function (req, res) {
    let sIdx = req.body.sIdx,
        bigo = req.body.bigo,
        admin = req.body.admin;

    let result = await siteModel.setSiteBigo(sIdx, bigo, admin);
    res.json({'result': true, 'data': result})
}

exports.updateSiteBigo = async function (req, res) {
    let bgIdx = req.params.bgIdx,
        bigo = req.body.bigo,
        adminId =  req.body.adminId;

    let result = await siteModel.updateSiteBigo(bgIdx, bigo, adminId);
    res.json({'result': true, 'data': result})
}

exports.DeleteSiteBigo = async function (req, res) {
    let bgIdx = req.params.bgIdx;

    let result = await siteModel.DeleteSiteBigo(bgIdx);
    res.json({'result': true, 'data': result})
}

exports.setSiteMemo = async function (req, res) {
    let sIdx = req.params.sIdx,
        colName = req.body.colName,
        type = req.body.type,
        text = req.body.text;

    console.log(sIdx, colName, type, text);
    // return;

    let result = await siteModel.setSiteMemo(sIdx, colName, type, text);

    res.json({'result': true, 'data': result})
}

exports.deleteSiteMemo = async function (req, res) {
    let sIdx = req.params.sIdx;
    let colName = req.body.colName;

    console.log(sIdx, req.body)
    // Model 함수 호출
    let result = await siteModel.deleteSiteMemo(sIdx, colName);

    return res.json({ result: true, data: result });
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
        let adminId = req.user?.id || null;
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
            billing_day: req.body.billing_day,

            businessNumber: req.body.businessNumber || '',
            businessName: req.body.businessName || '',
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
            bigo: req.body.bigo || '', //현장특이사항
            settlementBigo: req.body.settlementBigo || '', //정산특이사항
            bankName: req.body.bankName,
            accountNumber: req.body.accountNumber,
            accountName: req.body.accountName,
            viewConfig: req.body.viewConfig || null,
            exportConfig: req.body.exportConfig || null,
        };

        // console.log(siteData, 'siteData');

        let siteResult = await siteModel.saveSite(siteData);

        if (!siteResult.success) {
            return res.json({ 'result': false, 'message': '현장 저장 실패', error: siteResult.error });
        }

        const targetSIdx = siteResult.sIdx; // 저장/수정된 현장 ID

        //현장특이사항저장
        if (req.body.bigo?.trim()) {
            await siteModel.saveSiteBigo(targetSIdx, req.body.bigo, '1', adminId); // 1: 현장
        }
        //정산특이사항저장
        if (req.body.settlementBigo?.trim()) {
            await siteModel.saveSiteBigo(targetSIdx, req.body.settlementBigo, '2', adminId); // 2: 정산
        }

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
                    firstContractDt: contractItem.firstContractDt,
                    startDt: contractItem.contractStart,
                    endDt: contractItem.contractEnd,
                    staffCount: currentStaffCount,
                    staffDetail: JSON.stringify(contractItem.staffList),
                    workSchedule: contractItem.workSchedule,
                    breaktime: contractItem.breakTime,
                    costBreakdown: JSON.stringify(contractItem.costBreakdown),
                    isAutoCalc: contractItem.isAutoCalc === 'N' ? 'N' : 'Y',
                    meltOptions: contractItem.meltOptions ? JSON.stringify(contractItem.meltOptions) : null,
                    viewConfig: siteData.viewConfig || null,
                    salarySource: contractItem.salarySource || 'employee',
                    cleaningConfig: JSON.stringify(contractItem.cleaningTasks), //청소계약
                    exportConfig: siteData.exportConfig || null,
                };

                // 개별 계약 저장
                //await siteModel.saveContract(contractData);
                let contractResult = await siteModel.saveContract(contractData);

                if (contractResult.success) {
                    // 2. 방금 저장된 계약의 PK(scIdx)를 받아와서 직책별 근무 스케줄(workhours) 저장
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

exports.DeleteSiteContract = async function (req, res) {
    let cIdx = req.user.cIdx,
        idx = req.params.idx;
    console.log(cIdx, idx);
    return;
    let result = await siteModel.DeleteSiteContract(idx, cIdx);

    res.json({'result': true, 'data': result})
}

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

exports.getCleaningSchedule = async function (req, res) {
    let cIdx = req.user.cIdx;

    let result = await siteModel.getCleaningSchedule(cIdx);

    res.json({ 'result': true, 'data': result });
}

exports.setCleaningSchedule = async function (req, res) {
    let cIdx = req.user.cIdx,
        sIdx = req.body.sIdx,
        itemCd = req.body.itemCd,
        tIdx = req.body.teamIdx, //팀idx
        mnIdx = req.body.mnIdx,
        startDt = req.body.startDt,
        endDt = req.body.endDt,
        durationDays = req.body.durationDays,
        memo = req.body.memo,
        status = req.body.status;

    let result = await siteModel.setCleaningSchedule(cIdx, sIdx, itemCd, tIdx, mnIdx, startDt, endDt, durationDays, memo, status);

    res.json({ 'result': true, 'data': result });
}

exports.updateCleaningSchedule = async function (req, res) {
    let idx = req.params.idx,
        itemCd = req.body.itemCd,
        startDt = req.body.startDt,
        endDt = req.body.endDt,
        durationDays = req.body.durationDays,
        tIdx = req.body.teamIdx,
        mnIdx = req.body.mnIdx,
        memo = req.body.memo,
        status = req.body.status;

    console.log(idx, itemCd, startDt, endDt, durationDays, tIdx, mnIdx, memo, status)

    let result = await siteModel.updateCleaningSchedule(idx, itemCd, startDt, endDt, durationDays, tIdx, mnIdx, memo, status);

    res.json({ 'result': true, 'data': result });
}

exports.DeleteCleaningSchedule = async function (req, res) {
    let idx = req.params.idx;

    let result = await siteModel.DeleteCleaningSchedule(idx);

    res.json({ 'result': true, 'data': result });
}

exports.getCleaningTeam = async function (req, res) {
    let cIdx = req.user.cIdx;

    let result = await siteModel.getCleaningTeam(cIdx);

    res.json({ 'result': true, 'data': result });
}

exports.setCleaningTeam = async function (req, res) {
    let cIdx = req.user.cIdx,
        name = req.body.name; //팀이름

    let result = await siteModel.setCleaningTeam(cIdx, name);

    res.json({ 'result': true, 'data': result });
}

exports.updateCleaningTeam = async function (req, res) {
    let teamIdx = req.params.idx,
        cIdx = req.user.cIdx,
        name = req.body.name;

    let result = await siteModel.updateCleaningTeam(teamIdx, cIdx, name);

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

exports.updateSiteManager = async function (req, res) {
    let cIdx = req.user.cIdx,
        siteIds = req.body.siteIds,         // 프론트엔드: selectedSiteIds.value
        targetField = req.body.targetField, // 프론트엔드: selectedManagerType.value
        managerName = req.body.managerName; // 프론트엔드: newManagerName.value

    // [보안] 허용된 컬럼명인지 검증 (SQL Injection 방지)
    const allowedFields = ['manager', 'billingManager', 'payrollManager'];
    if (!allowedFields.includes(targetField)) {
        return res.json({'result': false, 'msg': '유효하지 않은 담당자 구분입니다.'});
    }

    if (!siteIds || siteIds.length === 0) {
        return res.json({'result': false, 'msg': '선택된 현장이 없습니다.'});
    }

    // 모델로 targetField와 managerName을 넘겨줌
    let result = await siteModel.updateSiteManager(cIdx, siteIds, targetField, managerName);

    // 에러 발생 시 처리
    if (result.data === '-9999') {
        return res.json({'result': false, 'msg': '서버 DB 에러가 발생했습니다.'});
    }

    res.json({'result': true, 'data': result});
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

                    contract.files = [];
                    if (contract.contractFileOriginal && contract.contractFileSaved) {
                        try {
                            const originals = typeof contract.contractFileOriginal === 'string'
                                ? JSON.parse(contract.contractFileOriginal)
                                : contract.contractFileOriginal;
                            const saveds = typeof contract.contractFileSaved === 'string'
                                ? JSON.parse(contract.contractFileSaved)
                                : contract.contractFileSaved;

                            if (Array.isArray(originals) && Array.isArray(saveds)) {
                                // 대칭되는 인덱스끼리 묶어서 오브젝트 배열 생성
                                contract.files = originals.map((name, i) => ({
                                    name: decodeLatin1ToUtf8(name),
                                    url: saveds[i] || '',
                                    size: null // DB 문자열 구조상 size 저장이 누락되어 있으므로 프론트 예외처리를 위해 null 또는 가상값 세팅
                                }));
                            }
                        } catch (fileErr) {
                            console.error("계약별 파일 목록 파싱 에러:", fileErr);
                        }
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

exports.getSiteData_v2 = async function (req, res) {
    let cIdx = req.user.cIdx,
        sIdx = req.params.sIdx;

    if(!cIdx) return res.json({ result: false, message: '회사 index 정보가 없습니다.' });
    if(!sIdx) return res.json({ result: false, message: '현장 index 정보가 없습니다.' });

    try {
        // 1. 모든 DB 쿼리를 병렬(Promise.all)로 실행하여 속도 극대화
        const [sites, contracts, bigos, schedules] = await Promise.all([
            siteModel.getSiteData_v2(sIdx, cIdx),
            siteModel.getContractsBySite_v2(sIdx),
            siteModel.getBigosBySite_v2(sIdx),
            siteModel.getWorkContracts(sIdx) // 기존 스케줄 쿼리
        ]);

        if (!sites || sites.length === 0) {
            return res.json({ result: false, message: '해당 현장 정보가 없습니다.' });
        }

        const siteData = sites[0]; // 현장 데이터

        // 2. 스케줄 데이터를 매핑하기 쉽게 변환
        const scheduleMap = {};
        if (schedules && schedules.length > 0) {
            for (const s of schedules) {
                if (!scheduleMap[s.scIdx]) scheduleMap[s.scIdx] = {};
                scheduleMap[s.scIdx][s.position] = typeof s.workhours === 'string'
                    ? JSON.parse(s.workhours)
                    : s.workhours;
            }
        }

        // 3. 계약(contractList) 데이터 조립 (문자열 파싱 + 스케줄 삽입 + 파일 병합)
        const processedContracts = contracts.map(contract => {
            // DB에 문자열로 저장된 JSON 데이터 안전하게 객체로 변환
            contract.budget = typeof contract.budget === 'string' ? JSON.parse(contract.budget || '{}') : contract.budget;
            contract.viewConfig = typeof contract.viewConfig === 'string' ? JSON.parse(contract.viewConfig || '{}') : contract.viewConfig;
            contract.meltOptions = typeof contract.meltOptions === 'string' ? JSON.parse(contract.meltOptions || '{}') : contract.meltOptions;
            contract.cleaningConfig = typeof contract.cleaningConfig === 'string' ? JSON.parse(contract.cleaningConfig || '[]') : contract.cleaningConfig;

            let staffArr = typeof contract.staffList === 'string'
                ? JSON.parse(contract.staffList || '[]')
                : (contract.staffList || []);

            // 스케줄 병합
            staffArr.forEach(staff => {
                if (scheduleMap[contract.scIdx] && scheduleMap[contract.scIdx][staff.code]) {
                    staff.schedule = scheduleMap[contract.scIdx][staff.code];
                }
            });
            contract.staffList = staffArr;

            // 파일 병합
            contract.files = [];
            if (contract.contractFileOriginal && contract.contractFileSaved) {
                try {
                    const originals = typeof contract.contractFileOriginal === 'string'
                        ? JSON.parse(contract.contractFileOriginal)
                        : contract.contractFileOriginal;
                    const saveds = typeof contract.contractFileSaved === 'string'
                        ? JSON.parse(contract.contractFileSaved)
                        : contract.contractFileSaved;

                    if (Array.isArray(originals) && Array.isArray(saveds)) {
                        contract.files = originals.map((name, i) => ({
                            name: decodeLatin1ToUtf8(name), // 기존 함수 존재한다고 가정
                            url: saveds[i] || '',
                            size: null
                        }));
                    }
                } catch (fileErr) {
                    console.error("계약별 파일 목록 파싱 에러:", fileErr);
                }
            }

            return contract;
        });

        // 4. 현장 데이터 안에 합치기
        // (프론트엔드에서 JSON.parse를 기대하므로 stringify 처리)
        siteData.contractList = processedContracts;
        siteData.bigoList = bigos;

        // 5. 최종 응답
        res.json({ result: true, data: [siteData] });

    } catch (e) {
        console.error("getSiteData_v2 에러:", e);
        res.status(500).json({ result: false, message: '서버 에러' });
    }
};

exports.getSiteCoords = async function (req, res) {
    let sIdx = req.params.sIdx;
    let result = await siteModel.getSiteCoords(sIdx);
    res.json({ result: true, data: result });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.updateSiteCoordsData = async function (req, res) {
    const KAKAO_API_KEY = 'ec1c7d1d60f1b51ace19292d3f524367';
    let cIdx = req.params.cIdx;

    if (!cIdx) {
        return res.status(400).json({ success: false, message: 'cIdx가 누락되었습니다.' });
    }

    try {
        let sites = await siteModel.getSiteList(cIdx);


        if (sites.length == 0) {
            return res.status(500).json({ success: false, message: '현장 목록을 불러오지 못했습니다.' });
        }

        let successCount = 0;
        let failCount = 0;

        for (let site of sites) {
            if (!site.address) {
                failCount++;
                continue;
            }

            // 이미 좌표가 있다면 스킵
            /*
            if (site.latitude && site.longitude) {
                continue;
            }

             */

            try {
                // 내장 fetch를 위한 URL 및 쿼리 파라미터 세팅
                const targetUrl = new URL('https://dapi.kakao.com/v2/local/search/address.json');
                targetUrl.searchParams.append('query', site.address);

                // fetch API 호출
                const response = await fetch(targetUrl.toString(), {
                    method: 'GET',
                    headers: {
                        'Authorization': `KakaoAK ${KAKAO_API_KEY}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Kakao API HTTP error! status: ${response.status}`);
                }

                // JSON 결과 파싱
                const result = await response.json();

                if (result.documents && result.documents.length > 0) {
                    const lng = result.documents[0].x; // 경도
                    const lat = result.documents[0].y; // 위도

                    const isUpdated = await siteModel.updateSiteCoords(site.idx, lat, lng);

                    if (isUpdated) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } else {
                    failCount++;
                }
            } catch (apiError) {
                console.error(`[API 에러] 현장 idx: ${site.idx}, 에러: ${apiError.message}`);
                failCount++;
            }

            // API 호출 제한 방지 (100ms 대기)
            await sleep(100);
        }

        return res.status(200).json({
            success: true,
            message: '위경도 일괄 업데이트가 완료되었습니다.',
            data: {
                totalSites: sites.length,
                success: successCount,
                fail: failCount
            }
        });

    } catch (error) {
        console.error('서비스단 에러:', error);
        return res.status(500).json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
    }
};

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
