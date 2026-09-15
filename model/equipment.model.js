const mysql = require("mysql");
const pool = require("../config/mysql");
const eqModel = require("./equipment.model");


exports.setEquipment = async function (cIdx, name, type, model, serialNo, totalQty, purchaseDt, mfgDt, price, imgPath, status, bigo) {
    let sql = "insert into new_tb_equipment (cIdx, name, type, model, serialNo, qty, purchaseDt, mfgDt, price, imgPath, status, bigo, regDt)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
    let aParameter = [cIdx, name, type, model, serialNo, totalQty, purchaseDt, mfgDt, price, imgPath, status, bigo];

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