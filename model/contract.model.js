const mysql = require("mysql2/promise");
const pool = require("../config/mysql");

//직원 근로계약서 작성
exports.setMemberContract = async function (mIdx, sIdx, type, jsonData, filePath, startDt, endDt, bigo) {
    let sql = "insert into new_tb_member_contract (mIdx, sIdx, type, jsonData, filePath, startDt, endDt, bigo)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [mIdx, sIdx, type, jsonData, filePath, startDt, endDt, bigo];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//계약 내용 보기 (급여까지)
exports.getMemberContract = async function (targetMonthStr) {
    let sql = "SELECT mc.*, m.name, m.id, s.idx as `sIdx`, s.name as  `siteName`, s.payment_day,"
    sql += " (select itemNm from new_tb_code where itemCd = m.position) as `role`"
    sql += " FROM new_tb_member_contract mc"
    sql += " left join new_tb_member m on m.idx = mc.mIdx"
    sql += " left join new_tb_site s on s.idx = mc.sIdx"
    sql += " WHERE mc.startDt BETWEEN mc.startDt AND IFNULL(mc.endDt, '9999-12-31')";
    let aParameter = [targetMonthStr];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getMemberContract1 = async function (mIdx) {
    let sql = "select mc.type, mc.startDt, mc.endDt, mc.bigo,"
    sql += " mw.basic_wage, mw.position_wage, mw.other_wage"
    sql += " from new_tb_member_contract mc"
    sql += " left join new_tb_member_wage mw on mw.mIdx = mc.mIdx"
    sql += " where mc.mIdx = ?"
    let aParameter = [mIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//현장 계약
exports.setSiteContract = async function (sIdx, cIdx, contract, totalCost, startDt, endDt) {
    let sql = "insert into new_tb_site_contract (sIdx, cIdx, contract, totalCost, startDt, endDt) values (?, ?, ?, ?, ?, ?)"
    let aParameter = [sIdx, cIdx, contract, totalCost, startDt, endDt];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
