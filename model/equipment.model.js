const mysql = require("mysql");
const pool = require("../config/mysql");


exports.setEquipment = async function (cIdx, name, type, model, imgPath, serialNo, purchaseDt, status, bigo) {
    let sql = "insert into new_tb_equipment (cIdx, name, type, model, serialNo, purchaseDt, status, bigo)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [cIdx, name, type, model, imgPath, serialNo, purchaseDt, status, bigo];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getEquipmentList = async function (cIdx) {
    let sql = "select * from new_tb_equipment where cIdx = ?"
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

exports.setEquipmentSite = async function (eqIdx, sIdx, assignDt, bigo, status) {
    let sql = "insert into new_tb_equipment_assignment (eqIdx, sIdx, assignDt, bigo, status) values (?, ?, ?, ?, ?)"
    let aParameter = [eqIdx, sIdx, assignDt, bigo, status];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
