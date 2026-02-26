const pool = require("../config/mysql");
const mysql = require("mysql2/promise")

exports.setBaseSalary = async function (mIdx, sIdx, year, paymentList, deductionList, checkedList, grossPay, deductions, netPay,total) {
    let sql = "insert into new_tb_member_base_salary (mIdx, sIdx, year, payItems, deductionItems, checkedItems, grossPay, deductions, netPay, total)"
    sql += " values (?, ?, ?, ?, ? ,? ,? ,?, ?,?)"
    let aParameter = [mIdx, sIdx, year, paymentList, deductionList, checkedList, grossPay, deductions, netPay,total];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//직원급여조회
exports.getBaseSalary = async function () {
    let sql = "select"
    sql += " m.idx,"    //idx
    sql += " m.id," //사번
    sql += " m.type,"   //직원구분
    sql += " (select name from new_tb_site where ma.sIdx = idx) as siteName,"   //현장명
    sql += " (select idx from new_tb_site where ma.sIdx = idx) as sIdx,"    //현장idx
    sql += " (select itemNm from new_tb_code where m.position = itemCd) as role,"   //직책
    sql += " m.name as staff,"  //성명
    sql += " IFNULL(mbs.payItems, JSON_OBJECT()) as payItems,"
    sql += " IFNULL(mbs.deductionItems,JSON_OBJECT()) as deductionItems,"
    sql += " IFNULL(mbs.checkedItems,JSON_OBJECT()) as checkedItems,"
    sql += " mbs.grossPay, mbs.deductions AS totalDeduction, mbs.netPay"
    sql += " from new_tb_member m";
    sql += " left join new_tb_member_base_salary mbs ON mbs.idx = (SELECT idx FROM new_tb_member_base_salary WHERE mIdx = m.idx";
    sql += " ORDER BY regDt DESC LIMIT 1)"
    sql += " left join new_tb_site s on s.idx = mbs.sIdx";
    sql += " left join new_tb_member_assignment ma on ma.mIdx = m.idx";
    sql += " where m.status = 0"  //재직상태
    sql += " order by s.name, m.name"
    let aParameter = [];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
/*
exports.getPayrollMonth = async function (year, month) {

}
*/

//직원 급여 내역 조회
exports.getPayrollMonth = async function (year, month) {
    let sql = "select"
    sql += " m.idx,"
    sql += " m.id,"
    sql += " m.type,"
    sql += " (select name from new_tb_site where ma.sIdx = idx) as siteName,"
    sql += " (select idx from new_tb_site where ma.sIdx = idx) as sIdx,"
    sql += " (select itemNm from new_tb_code where m.position = itemCd) as role,"
    sql += " (select payment_day from new_tb_site where idx = ma.sIdx) as payment_day,"
    sql += " m.name as staff,"

    // 1. [급여 내역] (payroll_month 테이블에서 가져옴)
    sql += " IFNULL(mbs.payItems, JSON_OBJECT()) as payItems,"
    sql += " IFNULL(mbs.deductionItems, JSON_OBJECT()) as deductionItems,"
    sql += " IFNULL(mbs.grossPay, 0) as grossPay,"
    sql += " IFNULL(mbs.deductions, 0) as totalDeduction,"
    sql += " IFNULL(mbs.netPay, 0) as netPay,"

    // 2. [체크박스 설정] (base_salary 테이블에서 가져옴 - ★수정됨)
    // mbs가 아니라 bs(base_salary) 별칭을 사용합니다.
    sql += " IFNULL(bs.checkedItems, JSON_OBJECT()) as checkedItems"

    sql += " from new_tb_member m";

    // =================================================================================
    // JOIN 1. 해당 연/월 급여 내역 (mbs) - 저장된 급여 정보
    // =================================================================================
    sql += " left join new_tb_member_payroll_month mbs ON mbs.idx = (";
    sql += "     SELECT idx FROM new_tb_member_payroll_month";
    sql += "     WHERE mIdx = m.idx";
    sql += "     AND year = ?";
    sql += "     AND month = ?";
    sql += "     ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    // =================================================================================
    // JOIN 2. 최신 기본급 설정 (bs) - checkedItems 가져오기용 ★추가됨
    // =================================================================================
    sql += " left join new_tb_member_base_salary bs ON bs.idx = (";
    sql += "     SELECT idx FROM new_tb_member_base_salary";
    sql += "     WHERE mIdx = m.idx";
    sql += "     ORDER BY regDt DESC LIMIT 1"; // 가장 최근 설정 가져오기
    sql += " )";

    sql += " left join new_tb_site s on s.idx = mbs.sIdx";
    sql += " left join new_tb_member_assignment ma on ma.mIdx = m.idx";

    sql += " order by s.name, m.name";

    let aParameter = [year, month];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setPayrollMonth = async function (mIdx, sIdx, year, month, grossPay, workDays, deductions, netPay, payItems, deductionItems, total){
    let sql = "insert into new_tb_member_payroll_month ("
    sql += "mIdx, sIdx, year, month, grossPay, workDays, deductions, netPay, payItems, deductionItems, total)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [mIdx, sIdx, year, month, grossPay, workDays, deductions, netPay, payItems, deductionItems, total];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getRetirementEstimation = async () => {
    let sql = "SELECT m.idx, m.name, m.inDate,"
        sql += " DATEDIFF(NOW(), m.inDate) + 1 AS workDays," //근속일수 (오늘-입사일+1);
        sql += " IFNULL((SELECT grossPay"; //최신 급여 가져오기 (상관 서브쿼리)
        sql += "    FROM new_tb_member_base_salary bs"
        sql += "    WHERE bs.mIdx = m.idx"
        sql += "    ORDER BY bs.regDt DESC LIMIT 1),0) AS baseSalary,"
        sql += " IFNULL(FLOOR(" //-- 퇴직금 추계액 계산
        sql += "    (SELECT grossPay"
        sql += "    FROM new_tb_member_base_salary bs"
        sql += "    WHERE bs.mIdx = m.idx ORDER BY bs.regDt DESC LIMIT 1) * ((DATEDIFF(NOW(), m.inDate) + 1) / 365)),0) AS retirementPay"
        sql += " FROM new_tb_member m"
    // sql += " where "

    let aParameter = [];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getAnnualLeaveEstimation = async function (year) {
    let sql = "SELECT "
    sql += " m.name, m.inDate, m.status,"
    sql += " (SELECT itemNm FROM new_tb_code WHERE itemCd = m.position) AS `position`,"
    sql += " (select idx from new_tb_site where idx = mal.sIdx) as `sIdx`,"
    sql += " mal.middleDt,IFNULL(mal.count, 0) as count,IFNULL(mal.over_count, 0) as over_count,IFNULL(mal.used_count, 0) as used_count,"
    sql += " IFNULL(mal.middleDt, m.inDate) AS baseDt,"
    sql += " (IFNULL(mal.count, 0) + IFNULL(mal.over_count, 0) - IFNULL(mal.used_count, 0)) AS remaining,"
    sql += " mc.grossPay, mc.month_work_time, mc.day_work_time,"
    sql += " FLOOR((mc.grossPay / mc.month_work_time) * mc.day_work_time * "
    sql += " (IFNULL(mal.count, 0) + IFNULL(mal.over_count, 0) - IFNULL(mal.used_count, 0))) AS est"

    sql += " FROM new_tb_member m"

    sql += " LEFT JOIN new_tb_member_annual_leave mal"
    sql += "   ON mal.mIdx = m.idx AND mal.year IN (?)"

    sql += " LEFT JOIN ("
    sql += "   SELECT mIdx, MAX(idx) AS max_idx"
    sql += "   FROM new_tb_member_contract"
    sql += "   GROUP BY mIdx"
    sql += " ) LatestC ON m.idx = LatestC.mIdx"

    sql += " LEFT JOIN new_tb_member_contract mc"
    sql += "   ON mc.idx = LatestC.max_idx"


    let aParameter = [year];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'};
    }
}

exports.getWorkPayroll = async function (targetMonth) {
    let sql = "SELECT m.idx, m.name, m.id,";
    sql += " IFNULL(wd.workDays, 0) AS workDays,";//근무 일수
    sql += " CAST(JSON_UNQUOTE(JSON_EXTRACT(mbs.payItems, '$.\"04001001\"')) AS UNSIGNED) AS monthlySalary,";//월급 (기본급)
    sql += " IFNULL(JSON_UNQUOTE(JSON_EXTRACT(sc.jsonData, CONCAT('$.\"', m.type, '\"'))), 30) AS stdWorkDays,";//기준일수
    sql += " TRUNCATE(";
    sql += "   (CAST(JSON_UNQUOTE(JSON_EXTRACT(mbs.payItems, '$.\"04001001\"')) AS UNSIGNED)";
    sql += "    / IFNULL(JSON_UNQUOTE(JSON_EXTRACT(sc.jsonData, CONCAT('$.\"', m.type, '\"'))), 30))";
    sql += "   * IFNULL(wd.workDays, 0), -1";
    sql += " ) AS calculatedBasePay";
    sql += " FROM new_tb_member m";
    sql += " LEFT JOIN new_tb_member_base_salary mbs ON mbs.idx = (";
    sql += "    SELECT idx FROM new_tb_member_base_salary WHERE mIdx = m.idx ORDER BY regDt DESC LIMIT 1";
    sql += " )";
    sql += " LEFT JOIN new_tb_member_assignment ma ON ma.mIdx = m.idx";
    sql += " LEFT JOIN new_tb_site_contract sc ON sc.sIdx = ma.sIdx";
    sql += " LEFT JOIN (";//근무일수 서브쿼리
    sql += "    SELECT mIdx, COUNT(*) as workDays";
    sql += "    FROM new_tb_work";
    sql += "    WHERE workStartDt LIKE CONCAT(?, '%')";
    sql += "    AND workFl = 'Y'";
    sql += "    GROUP BY mIdx";
    sql += " ) wd ON m.idx = wd.mIdx";

    //sql += " WHERE m.status = '0'";//재직중인직원만

    let aParameter = [targetMonth];
    //let query = mysql.format(sql, aParameter);

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'};
    }
}

/*
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
    sql += " directCostJson, indirectCostJson, etcCostJson, manageCostJson, total_cost, regDt)"
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

exports.getPayrollList = async function (year, month) {
    let sql = "select * from new_tb_settlement where year in (?) and month in (?)"
    let aParameter = [year, month];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}


 */
