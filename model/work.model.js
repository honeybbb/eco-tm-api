const pool = require("../config/mysql");
const mysql = require("mysql2/promise")

exports.getWorkFl = async function (mIdx, sIdx, today) {
    let sql = "select * from new_tb_work where mIdx = ? and sIdx = ? and Date(regDt) = ?"
    let aParameter = [mIdx, sIdx, today];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.workStart = async function (mIdx, sIdx, workStartDt, regDt) {
    let sql = "insert into new_tb_work (mIdx, sIdx, workStartDt, regDt) values (?, ?, ? ,?)"
    let aParameter = [mIdx, sIdx, workStartDt, regDt];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.workEnd = async function (mIdx, sIdx, workEndDt, today) {
    let sql = "update new_tb_work set workEndDt=?, workFl='N' where mIdx = ? and sIdx = ? and Date(workStartDt) = ?"
    let aParameter = [workEndDt, mIdx, sIdx, today];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getDayOff = async function (mIdx, today) {
    let sql = "select * from new_tb_member_off"
    sql += " where mIdx in (?)" //직원idx
    sql += " and AND (?) BETWEEN startDt AND endDt" //날짜
    sql += " and status = 1"; //연차 승인 상태
    let aParameter = [mIdx, today];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getDayOffList = async function (mIdx, startDt, endDt) {
    let sql = "select * from new_tb_member_off"
}

/*
exports.getWorkDaysAdmin = async function (sIdx, ym) {
    let sql = "SELECT mIdx,COUNT(*) AS workdays"
    sql += " FROM (SELECT mIdx,DATE(workStartDt) AS work_date FROM new_tb_work WHERE sIdx = ?"
    sql += " AND DATE_FORMAT(workStartDt, '%Y-%m') = (?)"
    sql += " GROUP BY mIdx, DATE(workStartDt)"
    sql += " HAVING COUNT(workStartDt) > 0 AND COUNT(workEndDt) > 0"
    sql += " ) AS w GROUP BY mIdx";

    let aParameter = [sIdx, ym];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

 */


exports.getWorkDaysAdmin = async function (sIdx, ym) {
    let sql = "SELECT w.mIdx,COUNT(*) AS workdays, mw.jsonData"
    // sql += " mw.basic_wage as `bWage`, mw.position_wage as `pWage`, mw.other_wage as `oWage`"
    sql += " FROM (SELECT mIdx,DATE(workStartDt) AS work_date FROM new_tb_work WHERE sIdx = ?"
    sql += " AND DATE_FORMAT(workStartDt, '%Y-%m') = (?)"
    sql += " GROUP BY mIdx, DATE(workStartDt)"
    sql += " HAVING COUNT(workStartDt) > 0 AND COUNT(workEndDt) > 0"
    // sql += " ) AS w left join new_tb_member_wage mw on w.mIdx = mw.mIdx GROUP BY w.mIdx";
    sql += " ) AS w left join new_tb_member_contract mw on w.mIdx = mw.mIdx GROUP BY w.mIdx";

    let aParameter = [sIdx, ym];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWorkDays = async function (mIdx, startDt, endDt) {
    let sql = "select COUNT(*) as workdays from new_tb_work where mIdx = ? and LEFT(?, 7) = ?";
    let aParameter = [mIdx, startDt, endDt];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res[0];
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWorkSheet = async function (mIdx, startDt, endDt) {
    let sql = "select DATE_FORMAT(workStartDt, '%Y-%m-%d') AS `date`,"
    sql += " IFNULL(TIMESTAMPDIFF(HOUR, workStartDt, workEndDt),0) AS `duration`,"
    sql += " DATE_FORMAT(workStartDt, '%H:%i') as `workin`,"
    sql += " DATE_FORMAT(workEndDt, '%H:%i') as `workout`"
    sql += " from new_tb_work where mIdx = ? and regDt >= CONCAT(?, '-01') AND regDt <  DATE_ADD(CONCAT(?, '-01'), INTERVAL 1 MONTH)"
    let aParameter = [mIdx, startDt, endDt];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.modifyWork = async function (workStartDt, workEndDt, workFl, modDt, idx) {
    let sql = "update new_tb_work set workStartDt = ?, workEndDt = ?, workFl=?, modDt = ? where idx = ?"
    let aParameter = [workStartDt, workEndDt, workFl, modDt, idx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWorkDayCount = async function (date)  {
    let sql = "SELECT mIdx,COUNT(*) as workDays"
    sql += " FROM new_tb_work"
    sql += " WHERE workStartDt LIKE (?)" // 선택된 연월"
    sql += " AND workFl = 'Y'"  // 유효 근무만
    sql += " GROUP BY mIdx";
    let aParameter = [date];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWorkList = async function (month) {
    let sql = "select * from new_tb_work WHERE workStartDt LIKE CONCAT(?, '%') AND workFl = 'Y'";

    /*
    let sql = "SELECT mIdx,COUNT(*) as workDays"
    sql += " FROM new_tb_work"
    sql += " WHERE workStartDt LIKE CONCAT(?, '%')" // 선택된 연월"
    sql += " AND workFl = 'Y'"  // 유효 근무만
    sql += " GROUP BY mIdx";

     */
    let aParameter = [month];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
