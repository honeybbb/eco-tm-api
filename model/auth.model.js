const mysql = require("mysql2/promise");
const pool = require("../config/mysql");

exports.findByLoginId = async function (loginId) {
    let sql = "SELECT m.*, m.position as positionCd,"
    // 해당 직원의 배치 기록 중 가장 마지막(idx DESC)에 생성된 1개(LIMIT 1)의 sIdx만 가져옵니다.
    sql += " (SELECT sIdx FROM new_tb_member_assignment WHERE mIdx = m.idx ORDER BY idx DESC LIMIT 1) AS sIdx"
    sql += " FROM new_tb_member m"
    sql += " WHERE m.id = ? and status = 0"
    let aParameter = [loginId];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.findByAdminId = async function (loginId) {
    let sql = "select * from new_tb_manager where managerId = ? and status = 0";
    let aParameter = [loginId];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.loginUser = async function (loginId, password) {
    let sql = "select * from new_tb_member where id = ? and password = ?";
    let aParameter = [loginId, password];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setMenuSettings = async function (cIdx, mnIdx, tableId, jsonData) {
    let sql = `
        INSERT INTO new_tb_config_menu (cIdx, mnIdx, tableId, columnsData, regDt) 
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
            columnsData = VALUES(columnsData),
            modDt = NOW()
    `;
    let aParameter = [cIdx, mnIdx, tableId, jsonData];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getMenuSettings = async function (cIdx, mnIdx, tableId) {
    let sql = "select * from new_tb_config_menu where cIdx = ? and mnIdx = ? and tableId = ?";

    let aParameter = [cIdx, mnIdx, tableId];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}