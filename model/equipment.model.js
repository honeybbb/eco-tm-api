const mysql = require("mysql");
const pool = require("../config/mysql");
const eqModel = require("./equipment.model");


exports.setEquipment = async function (
    cIdx, name, type, model, serialNo, totalQty, purchaseDt,
    supplyPrice, vat, totalPrice, imgPath, filePath, status, bigo
) {
    let sql = "insert into new_tb_equipment"
    sql += " (cIdx, name, type, model, serialNo, totalQty, purchaseDt, supplyPrice, vat, totalPrice, imgPath, filePath, status, bigo, regDt)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
    let aParameter = [
        cIdx, name, type, model, serialNo, totalQty, purchaseDt,
        supplyPrice, vat, totalPrice, imgPath, filePath, status, bigo
    ];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getEquipmentList = async function (cIdx) {
    let sql = "select eq.*, eqa.* from new_tb_equipment eq"
    sql += " left join new_tb_equipment_assignment eqa on eq.idx = eqa.eqIdx";
    sql += " where eq.cIdx = ?";
    let aParameter = [cIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//장비 리스트 (마스터)
exports.getEquipmentList_v2 = async function (cIdx) {
    let sql = "select * from new_tb_equipment where cIdx in (?)"
    let aParameter = [cIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//장비 배치 내역
exports.getEquipmentAssignment = async function (eqIdx) {
    let sql = "select * from new_tb_equipment_assignment where eqIdx in (?)";
    let aParameter = [eqIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//장비 수리 내역
exports.getEquipmentRepair = async function (eqIdx) {
    let sql = "select * from new_tb_equipment_repair where eqIdx in (?)";
    let aParameter = [eqIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getEquipmentTransaction = async function (eqIdx) {
    let sql = "select * from new_tb_equipment_transaction where eqIdx in (?)";
    let aParameter = [eqIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.moveEquipment = async function (eqIdx, fromSite, toSite, qty, date) {
    let sql = "update new_tb_equipment_assignment set eqIdx = ?, from = ?, sIdx = ?, assignQty =?, assignDt = ?, regDt = NOW()";
    let aParameter = [eqIdx, fromSite, toSite, qty, date];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getEquipmentData = async function (idx) {
    //let sql = "select * from new_tb_equipment where idx = ?";
    let sql = "select eq.*, CONCAT('[',"
    sql += "GROUP_CONCAT(JSON_OBJECT("
    sql += "'sName', s.name, 'count', (select count(*) from new_tb_equipment_assignment where sIdx = eqa.sIdx))),']') as `assignData`"
    sql += " from new_tb_equipment eq"
    sql += " left join new_tb_equipment_assignment eqa on eqa.eqIdx = eq.idx";
    sql += " left join new_tb_site s on s.idx = eqa.sIdx"
    sql += " where eq.cIdx = ?";
    let aParameter = [idx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setEquipmentSite = async function (eqIdx, sIdx, qty, assignDt, nextCheckDt,  bigo, status) {
    let sql = "insert into new_tb_equipment_assignment (eqIdx, sIdx, assignDt, bigo, status) values (?, ?, ?, ?, ?)"
    let aParameter = [eqIdx, sIdx, assignDt, qty, bigo, status];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

// 신규 장비 등록 시 최초 배치 insert (fromSidx = 0 = 본사)
exports.setEquipmentAssignment = async function (eqIdx, fromSidx, sIdx, qty, assignDt, bigo, status) {
    let sql = "insert into new_tb_equipment_assignment (eqIdx, fromSidx, sIdx, assignQty, assignDt, bigo, status, regDt)";
    sql += " values (?, ?, ?, ?, ?, ?, ?, NOW())";
    let aParameter = [eqIdx, fromSidx, sIdx, qty, assignDt, bigo, status];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('setEquipmentAssignment db err', e);
        return { 'data': '-9999' };
    }
}

exports.updateEquipmentSite = async function (assignIdx, qty, status, nextCheckDt, bigo) {
    try {
        let sql = "UPDATE new_tb_equipment_assignment"
        sql += " SET qty = COALESCE(?, qty),"
        sql += " status = COALESCE(?, status),"
        sql += " nextCheckDt = COALESCE(?, nextCheckDt),"
        sql += " bigo = ?"
        sql += " WHERE idx = ? AND status = 1";

        let aParameter = [qty, status, nextCheckDt, bigo, assignIdx];
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.error('updateEquipmentSite err', e)
        return { data: '-9999' }
    }
}

exports.repairEquipment = async function (eqIdx, sIdx, repairType, content, cost) {
    let sql = "update new_tb_equipment_repair set sIdx = ?, repairType=?, content=?, cost=?, regDt=NOW()"
    sql += " where eqIdx = ?"

    let aParameter = [sIdx, repairType, content, cost, eqIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.error('updateEquipmentSite err', e)
        return { data: '-9999' }
    }
}

// 수리/점검 이력 INSERT (before 사진 포함)
exports.setEquipmentRepair = async function (
    eqIdx, sIdx, repairDt, repairType, startDt, endDt,
    content, repairCenter, beforeImgPath, cost, expense, managerId
) {
    let sql = "insert into new_tb_equipment_repair";
    sql += " (eqIdx, sIdx, repairDt, repairType, startDt, endDt, content, repairCenter, beforeImgPath, cost, expense, managerId, regDt)";
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
    let aParameter = [
        eqIdx, sIdx, repairDt, repairType, startDt, endDt,
        content, repairCenter, beforeImgPath, cost, expense, managerId
    ];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.error('setEquipmentRepair err', e);
        return { data: '-9999' };
    }
}

// 수리 완료 처리 (afterImgPath, completedDt 업데이트)
exports.completeEquipmentRepair = async function (repairIdx, completedDt, afterImgPath) {
    let sql = "update new_tb_equipment_repair";
    sql += " set completedDt = ?, afterImgPath = COALESCE(?, afterImgPath), modDt = NOW()";
    sql += " where idx = ?";
    try {
        let [res] = await pool.query(sql, [completedDt, afterImgPath, repairIdx]);
        return res;
    } catch (e) {
        console.error('completeEquipmentRepair err', e);
        return { data: '-9999' };
    }
}

// 장비 마스터 status 변경 (수리/점검중 등으로 전환)
exports.updateEquipmentStatus = async function (eqIdx, status) {
    let sql = "update new_tb_equipment set status = ?, modDt = NOW() where idx = ?";
    try {
        let [res] = await pool.query(sql, [status, eqIdx]);
        return res;
    } catch (e) {
        console.error('updateEquipmentStatus err', e);
        return { data: '-9999' };
    }
}

//장비 폐기 (장비 마스터 상태 변경)
exports.disposeEquipment = async function (eqIdx) {
    let sql = "update new_tb_equipment set status = 2 where idx in (?)";
    let aParameter = [eqIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.error('disposeEquipment err', e)
        return { data: '-9999' }
    }
}

// 폐기 이력 INSERT (부분 폐기 지원)
exports.setEquipmentDiscard = async function (eqIdx, sIdx, qty, discardDt, reason, managerId) {
    let sql = "insert into new_tb_equipment_discard (eqIdx, sIdx, qty, discardDt, reason, managerId, regDt)";
    sql += " values (?, ?, ?, ?, ?, ?, NOW())";
    let aParameter = [eqIdx, sIdx, qty, discardDt, reason, managerId];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.error('setEquipmentDiscard err', e);
        return { data: '-9999' };
    }
}

// 특정 장비의 폐기 이력 조회
exports.getEquipmentDiscard = async function (eqIdx) {
    let sql = "select * from new_tb_equipment_discard where eqIdx in (?) order by regDt desc";
    let aParameter = [eqIdx];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.error('getEquipmentDiscard err', e);
        return { data: '-9999' };
    }
}