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
/*
exports.getBaseSalary = async function () {
    let sql = "select"
    sql += " m.idx,"    //idx
    sql += " m.id," //사번
    sql += " m.type,"   //직원구분
    sql += " m.birthDt," //생년월일 가져와야 법정기준연령 계산가능함
    sql += " (select name from new_tb_site where ma.sIdx = idx) as siteName,"   //현장명
    sql += " (select idx from new_tb_site where ma.sIdx = idx) as sIdx,"    //현장idx
    sql += " (select itemNm from new_tb_code where m.position = itemCd) as role,"   //직책
    // 정렬을 위해 직위 sort 값을 가져옵니다.
    sql += " (select sort from new_tb_code where m.position = itemCd) as roleSort,"
    sql += " m.name as staff,"  //성명
    sql += " IFNULL(mbs.payItems, JSON_OBJECT()) as payItems,"
    sql += " IFNULL(mbs.deductionItems,JSON_OBJECT()) as deductionItems,"
    sql += " IFNULL(mbs.checkedItems,JSON_OBJECT()) as checkedItems,"
    sql += " mbs.grossPay, mbs.deductions AS totalDeduction, mbs.netPay"
    sql += " from new_tb_member m";
    sql += " left join new_tb_member_base_salary mbs ON mbs.idx = (SELECT idx FROM new_tb_member_base_salary WHERE mIdx = m.idx";
    sql += " ORDER BY regDt DESC LIMIT 1)"

    // 현장명을 기준으로 정렬하기 위해 s 조인을 ma(배정) 테이블 기준으로 보정할 수 있습니다.
    sql += " left join new_tb_member_assignment ma on ma.mIdx = m.idx";
    sql += " left join new_tb_site s on s.idx = ma.sIdx";

    sql += " where m.status = 0"  //재직상태

    // 정렬 순서: 현장명 -> 직위 순서(sort) -> 등록일 -> 사번
    sql += " order by s.name ASC, roleSort ASC, m.regDt DESC, m.id ASC"

    let aParameter = [];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//직원 급여 내역 조회
exports.getPayrollMonth = async function (year, month) {
    let sql = "select"
    sql += " m.idx,"
    sql += " m.id,"
    sql += " m.type,"
    sql += " m.birthDt,";
    sql += " (select name from new_tb_site where ma.sIdx = idx) as siteName,"
    sql += " (select idx from new_tb_site where ma.sIdx = idx) as sIdx,"
    sql += " (select itemNm from new_tb_code where m.position = itemCd) as role,"
    // 정렬을 위해 직위 sort 값을 서브쿼리나 조인으로 가져옵니다.
    sql += " (select sort from new_tb_code where m.position = itemCd) as roleSort,"
    sql += " (select payment_day from new_tb_site where idx = ma.sIdx) as payment_day,"
    sql += " m.name as staff,"
    sql += " m.status as mStatus,";

    // 1. [급여 내역]
    sql += " IFNULL(mbs.payItems, JSON_OBJECT()) as payItems,"
    sql += " IFNULL(mbs.deductionItems, JSON_OBJECT()) as deductionItems,"
    sql += " IFNULL(mbs.grossPay, 0) as grossPay,"
    sql += " IFNULL(mbs.deductions, 0) as totalDeduction,"
    sql += " IFNULL(mbs.netPay, 0) as netPay,"

    // 2. [체크박스 설정]
    sql += " IFNULL(bs.checkedItems, JSON_OBJECT()) as checkedItems"

    // =================================================================================
    // ★ 2. 기준 근무일수 (scheduledDays) - mpm 컬럼 대신 mc 테이블 값으로 무조건 계산
    // =================================================================================
    sql += " IF(IFNULL(mc.day_work_time, 0) > 0, ROUND(mc.month_work_time / mc.day_work_time, 1), 0) as scheduledDays,"

    // JOIN 1. 해당 연/월 급여 내역
    sql += " left join new_tb_member_payroll_month mbs ON mbs.idx = (";
    sql += "     SELECT idx FROM new_tb_member_payroll_month";
    sql += "     WHERE mIdx = m.idx AND year = ? AND month = ?";
    sql += "     ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    // JOIN 2. 최신 기본급 설정
    sql += " left join new_tb_member_base_salary bs ON bs.idx = (";
    sql += "     SELECT idx FROM new_tb_member_base_salary";
    sql += "     WHERE mIdx = m.idx";
    sql += "     ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    // 정렬을 위한 site 조인 보강 (s.name 사용을 위해)
    // mbs.sIdx가 없을 경우를 대비해 ma.sIdx를 기준으로 site 정보를 가져옵니다.
    sql += " left join new_tb_member_assignment ma on ma.mIdx = m.idx";
    sql += " left join new_tb_site s on s.idx = IFNULL(mbs.sIdx, ma.sIdx)";

    // =================================================================================
    // 정렬 순서 적용: 1. 현장명 -> 2. 직위 순서(sort) -> 3. 등록일 또는 사번
    // =================================================================================
    sql += " order by s.name ASC, roleSort ASC, m.regDt DESC, m.id ASC";

    // 파라미터 매칭: absent(2) + scheduled(2) + worked(2) + mpm조인(2) = 총 8개
    let aParameter = [year, month, year, month, year, month, year, month];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setPayrollMonth = async function (
    mIdx, sIdx, year, month, workedDays, scheduledDays,
    grossPay, deductions, netPay, payItems, deductionItems, total
){
    let sql = "insert into new_tb_member_payroll_month ("
    sql += "mIdx, sIdx, year, month, workedDays, scheduledDays, grossPay, deductions, netPay, payItems, deductionItems, total)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [mIdx, sIdx, year, month, workedDays, scheduledDays, grossPay, deductions, netPay, payItems, deductionItems, total];

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

exports.getPayrollHistory = async function (mIdx) {
    // let sql = "select as `month`, grossPay from new_tb_member_payroll"
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
