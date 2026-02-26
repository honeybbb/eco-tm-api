const mysql = require("mysql2/promise");
const pool = require("../config/mysql");

exports.findByLoginId = async function (loginId) {
    let sql = "SELECT m.*, "
    // 해당 직원의 배치 기록 중 가장 마지막(idx DESC)에 생성된 1개(LIMIT 1)의 sIdx만 가져옵니다.
    sql += " (SELECT sIdx FROM new_tb_member_assignment WHERE mIdx = m.idx ORDER BY idx DESC LIMIT 1) AS sIdx"
    sql += " FROM new_tb_member m"
    sql += " WHERE m.id = ?"
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
    let sql = "select * from new_tb_manager where managerId = ?";
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
