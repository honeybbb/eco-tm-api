const mysql = require("mysql");
const pool = require("../config/mysql");

exports.getWorkPayroll = async function (targetMonth) {
    let sql = "SELECT m.idx,m.name,m.id,"
    sql += " IFNULL(wd.workDays, 0) AS workDays,"   //-- [1] 근무 일수
    //sql += " CAST(JSON_UNQUOTE(JSON_EXTRACT(w.jsonData, '$.\"03001001\".amount')) AS UNSIGNED) AS dailyWage,"   //-- [2] 책정된 일당 (JSON 키가 숫자이므로 따옴표 필수)
    sql += " CAST(JSON_UNQUOTE(JSON_EXTRACT(w.jsonData, '$.\"03001001\".amount')) AS UNSIGNED) AS monthlySalary,"
    //sql += " (IFNULL(wd.workDays, 0) * CAST(JSON_UNQUOTE(JSON_EXTRACT(w.jsonData, '$.\"03001001\".amount')) AS UNSIGNED)) AS calculatedBasePay" // -- [3] 총 기본급
    sql += " TRUNCATE((CAST(JSON_UNQUOTE(JSON_EXTRACT(w.jsonData, '$.\"03001001\".amount')) AS UNSIGNED) / 30) * IFNULL(wd.workDays, 0), -1) AS calculatedBasePay"
    sql += " FROM new_tb_member m"
    sql += " LEFT JOIN new_tb_member_wage w ON m.idx = w.mIdx"
    sql += " LEFT JOIN ("
    sql += " SELECT mIdx, COUNT(*) as workDays"
    sql += " FROM new_tb_work"
    sql += " WHERE workStartDt LIKE CONCAT(?, '%')"
    sql += " AND workFl = 'Y'"
    sql += " GROUP BY mIdx"
    sql += " ) wd ON m.idx = wd.mIdx"
    sql += " WHERE m.status = '0'";

    let aParameter = [targetMonth];
    let query = mysql.format(sql, aParameter);

    try {
        let res = await pool.query(query);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'};
    }
}

exports.setPayroll1 = async function (mIdx, sIdx, bWage, pWage, oWage){
    let sql = "insert into new_tb_member_wage (mIdx, sIdx, basic_wage, position_wage, other_wage) values (?, ?, ?, ?, ?)"
    let aParameter = [mIdx, sIdx, bWage, pWage, oWage];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWagesAdmin = async function (sIdx){
    // let sql = "SELECT mIdx, basic_wage, position_wage, other_wage FROM new_tb_member_wage WHERE sIdx = ?"
    let sql = "SELECT mw.mIdx, mw.jsonData, m.inDate, m.name, (select itemNm from new_tb_code where itemCd = m.position) as `position`"
    sql += " FROM new_tb_member_contract mw left join new_tb_member m on m.idx = mw.mIdx WHERE mw.sIdx = ?"
    let aParameter = [sIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWages = async function (mIdx) {
    let sql = "select * from new_tb_member_wage WHERE mIdx = ?";
    let aParameter = [mIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res[0];
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getPayroll1 = async function (mIdx, startDt, endDt) {
    let sql = "select * from new_tb_member_wage mw"
    sql += " where mIdx = ? and Date(regDt) between ? and ?";
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

exports.setPayrollDetail = async function (
    sIdx, cIdx, year, month, directCostJson, indirectCostJson,
    etcCostJson, manageCostJson, amount, regDt
){
    let sql = "insert into new_tb_payroll (sIdx, cIdx, year, month,"
    sql += " directCostJson, indirectCostJson, etcCostJson, manageCostJson, total_amount, regDt)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    let aParameter = [sIdx, cIdx, year, month, directCostJson, indirectCostJson,
        etcCostJson, manageCostJson, amount, regDt];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
