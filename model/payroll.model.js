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
    // sql += " where m.status = 0"  //재직상태
    sql += " order by s.idx, m.idx"
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

//직원 급여 내역 조회 (소수점있음)
exports.getPayrollMonthTemp = async function (year, month) {
    let sql = "select"
    sql += " m.idx,"
    sql += " m.id,"
    sql += " m.type,"
    sql += " (select name from new_tb_site where ma.sIdx = idx) as siteName,"
    sql += " (select idx from new_tb_site where ma.sIdx = idx) as sIdx,"
    sql += " (select itemNm from new_tb_code where m.position = itemCd) as role,"
    sql += " (select payment_day from new_tb_site where idx = ma.sIdx) as payment_day,"
    sql += " m.name as staff,"

    // =================================================================================
    // 1. 결근 일수 (absentDays) - 근태 테이블(new_tb_work)에서 결근(absent)만 카운트
    // =================================================================================
    sql += " ("
    sql += "   SELECT COUNT(DISTINCT DATE(workStartDt)) FROM new_tb_work"
    sql += "   WHERE mIdx = m.idx"
    sql += "   AND YEAR(workStartDt) = ? AND MONTH(workStartDt) = ?"
    sql += "   AND workType = 'absent'"
    sql += " ) as absentDays,"

    // =================================================================================
    // ★ 2. 기준 근무일수 (scheduledDays) - mpm 컬럼 대신 mc 테이블 값으로 무조건 계산
    // =================================================================================
    sql += " IF(IFNULL(mc.day_work_time, 0) > 0, ROUND(mc.month_work_time / mc.day_work_time, 1), 0) as scheduledDays,"

    // =================================================================================
    // ★ 3. 실제 일한 일수 (workedDays) = 기준일수(계산) - 결근일수(서브쿼리)
    // =================================================================================
    sql += " ("
    sql += "   IF(IFNULL(mc.day_work_time, 0) > 0, ROUND(mc.month_work_time / mc.day_work_time, 1), 0) - "
    sql += "   ("
    sql += "     SELECT COUNT(DISTINCT DATE(workStartDt)) FROM new_tb_work"
    sql += "     WHERE mIdx = m.idx"
    sql += "     AND YEAR(workStartDt) = ? AND MONTH(workStartDt) = ?"
    sql += "     AND workType = 'absent'"
    sql += "   )"
    sql += " ) as workedDays,"

    // 4. [급여 및 공제 내역]
    sql += " IFNULL(mpm.payItems, bs.payItems) as payItems,"
    sql += " IFNULL(mpm.deductionItems, bs.deductionItems) as deductionItems,"
    sql += " IFNULL(mpm.grossPay, bs.grossPay) as grossPay,"
    sql += " IFNULL(mpm.checkedItems, bs.checkedItems) as checkedItems,"
    sql += " IFNULL(mpm.deductions, 0) as totalDeduction,"
    sql += " IFNULL(mpm.netPay, 0) as netPay,"
    sql += " IF(mpm.idx IS NOT NULL, 1, 0) as status"

    sql += " from new_tb_member m";

    // --- [JOIN 1] 연/월 급여 내역 (mpm) ---
    sql += " left join new_tb_member_payroll_month mpm ON mpm.idx = (";
    sql += "     SELECT idx FROM new_tb_member_payroll_month";
    sql += "     WHERE mIdx = m.idx AND year = ? AND month = ?";
    sql += "     ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    // --- [JOIN 2] 최신 기본급 설정 (bs) ---
    sql += " left join new_tb_member_base_salary bs ON bs.idx = (";
    sql += "     SELECT idx FROM new_tb_member_base_salary";
    sql += "     WHERE mIdx = m.idx ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    // --- [JOIN 3] 최신 근로계약 정보 (mc) ---
    sql += " left join new_tb_member_contract mc ON mc.idx = (";
    sql += "     SELECT idx FROM new_tb_member_contract";
    sql += "     WHERE mIdx = m.idx ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    // mpm이 null일 수 있으므로 현장정보(sIdx)는 member_assignment(ma)를 기준으로 JOIN
    sql += " left join new_tb_member_assignment ma on ma.mIdx = m.idx";
    sql += " left join new_tb_site s on s.idx = ma.sIdx";

    sql += " order by s.name, m.name";

    // 파라미터 개수 매칭: absentDays(2) + workedDays내 결근(2) + mpm 조인(2) = 총 6개
    let aParameter = [year, month, year, month, year, month];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//직원 급여 내역 조회 (일할 일수 반올림)
exports.getPayrollMonth = async function (year, month) {
    let sql = `
        SELECT 
            m.idx, 
            m.id, 
            m.type, 
            m.name AS staff,
            s.idx AS sIdx,
            s.name AS siteName,
            s.payment_day,
            c.itemNm AS role,
            m.inDate, m.outDate,
            
            /* 1. 결근 일수는 사실상 확정 정보이므로 무조건 보여줌 (없으면 0) */
            IFNULL(w.absentDays, 0) AS absentDays,

            /* 2. [핵심] mpm에 데이터가 없으면 무조건 0으로 깡통 데이터 던짐 */
            IFNULL(mpm.scheduledDays, 0) AS scheduledDays,
            IFNULL(mpm.workedDays, 0) AS workedDays,
            IFNULL(mpm.grossPay, 0) AS grossPay,
            IFNULL(mpm.deductions, 0) AS totalDeduction,
            IFNULL(mpm.netPay, 0) AS netPay,
            
            /* JSON 데이터는 프론트엔드에서 처리하도록 그대로 던짐 (없으면 NULL) */
            mpm.payItems,
            mpm.deductionItems,
            mpm.checkedItems,
            
            /* 3. 상태: mpm 내역이 있으면 1(계산됨), 없으면 0(계산전) */
            IF(mpm.idx IS NOT NULL, 1, 0) AS status

        FROM new_tb_member m
        
        /* 기본 정보 조인 */
        LEFT JOIN new_tb_code c ON c.itemCd = m.position
        LEFT JOIN new_tb_member_assignment ma ON ma.mIdx = m.idx
        LEFT JOIN new_tb_site s ON s.idx = ma.sIdx

        /* --- [JOIN 1] 근태: 해당 월의 결근 횟수만 집계 --- */
        LEFT JOIN (
            SELECT mIdx, COUNT(DISTINCT DATE(workStartDt)) AS absentDays 
            FROM new_tb_work 
            WHERE YEAR(workStartDt) = ? AND MONTH(workStartDt) = ? 
              AND workType = 'absent'
            GROUP BY mIdx
        ) w ON w.mIdx = m.idx

        /* --- [JOIN 2] 확정 급여: 해당 연/월에 저장된 가장 최근 1건 --- */
        LEFT JOIN (
            SELECT p1.*
            FROM new_tb_member_payroll_month p1
            INNER JOIN (
                SELECT mIdx, MAX(idx) AS max_idx
                FROM new_tb_member_payroll_month
                WHERE year = ? AND month = ?
                GROUP BY mIdx
            ) p2 ON p1.idx = p2.max_idx
        ) mpm ON mpm.mIdx = m.idx

        ORDER BY s.idx, m.idx
    `;

    // 파라미터 매칭: 근태 조인(2) + 급여 조인(2) = 총 4개
    let aParameter = [year, month, year, month];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getPayrollCalculate = async function (year, month) {
    let sql = "select"
    sql += " m.idx,"
    sql += " m.id,"
    sql += " m.type,"
    sql += " (select name from new_tb_site where ma.sIdx = idx) as siteName,"
    sql += " (select idx from new_tb_site where ma.sIdx = idx) as sIdx,"
    sql += " (select itemNm from new_tb_code where m.position = itemCd) as role,"
    sql += " (select payment_day from new_tb_site where idx = ma.sIdx) as payment_day,"
    sql += " m.name as staff,"

    // 1. 결근 일수 (absentDays)
    sql += " ("
    sql += "   SELECT COUNT(DISTINCT DATE(workStartDt)) FROM new_tb_work"
    sql += "   WHERE mIdx = m.idx"
    sql += "   AND YEAR(workStartDt) = ? AND MONTH(workStartDt) = ?"
    sql += "   AND workType = 'absent'"
    sql += " ) as absentDays,"

    // 2. 기준 근무일수 (scheduledDays): 근태 기록이 없으면 계약 정보(mc)에서 가져옵니다.
    sql += " ("
    sql += "   SELECT CASE"
    sql += "     WHEN COUNT(idx) > 0 THEN COUNT(DISTINCT DATE(workStartDt))"
    sql += "     ELSE IF(IFNULL(mc.day_work_time, 0) > 0, ROUND(mc.month_work_time / mc.day_work_time, 0), 0)"
    sql += "   END"
    sql += "   FROM new_tb_work"
    sql += "   WHERE mIdx = m.idx"
    sql += "   AND YEAR(workStartDt) = ? AND MONTH(workStartDt) = ?"
    sql += "   AND workType IN ('work', 'annual', 'absent','holiday')"
    sql += " ) as scheduledDays,"

    // ★ 3. 실제 일한 일수 (workedDays) [수정됨]
    // 계약 정보로 대체하는 로직(ELSE)을 완전히 제거했습니다.
    // 'work', 'annual' 기록만 카운트하며, 기록이 아예 없으면 자동으로 0이 반환됩니다.
    sql += " ("
    sql += "   SELECT COUNT(DISTINCT DATE(workStartDt))"
    sql += "   FROM new_tb_work"
    sql += "   WHERE mIdx = m.idx"
    sql += "   AND YEAR(workStartDt) = ? AND MONTH(workStartDt) = ?"
    sql += "   AND workType IN ('work', 'annual','holiday')"
    sql += " ) as workedDays,"

    // 4. [급여 및 공제 내역]
    sql += " IFNULL(mpm.payItems, bs.payItems) as payItems,"
    sql += " IFNULL(mpm.deductionItems, bs.deductionItems) as deductionItems,"
    sql += " IFNULL(mpm.grossPay, bs.grossPay) as grossPay,"
    sql += " IFNULL(mpm.checkedItems, bs.checkedItems) as checkedItems,"
    sql += " IFNULL(mpm.deductions, 0) as totalDeduction,"
    sql += " IFNULL(mpm.netPay, 0) as netPay,"
    sql += " IF(mpm.idx IS NOT NULL, 1, 0) as status"

    sql += " from new_tb_member m";

    // --- [JOIN 1] 연/월 급여 내역 (mpm) ---
    sql += " left join new_tb_member_payroll_month mpm ON mpm.idx = (";
    sql += "     SELECT idx FROM new_tb_member_payroll_month";
    sql += "     WHERE mIdx = m.idx AND year = ? AND month = ?";
    sql += "     ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    // --- [JOIN 2] 최신 기본급 설정 (bs) ---
    sql += " left join new_tb_member_base_salary bs ON bs.idx = (";
    sql += "     SELECT idx FROM new_tb_member_base_salary";
    sql += "     WHERE mIdx = m.idx ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    // --- [JOIN 3] 최신 근로계약 정보 (mc) ---
    sql += " left join new_tb_member_contract mc ON mc.idx = (";
    sql += "     SELECT idx FROM new_tb_member_contract";
    sql += "     WHERE mIdx = m.idx ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    sql += " left join new_tb_member_assignment ma on ma.mIdx = m.idx";
    sql += " left join new_tb_site s on s.idx = ma.sIdx";

    sql += " order by s.name, m.name";

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

// 특정 직원의 전체 급여 이력 조회
exports.getMemberPayrollHistory = async function (mIdx) {
    let sql = `
        SELECT
            p1.idx,
            p1.year,
            p1.month,
            CONCAT(p1.year, '.', LPAD(p1.month, 2, '0')) AS payMonth,
            p1.grossPay AS basic,      /* 총 지급액 */
            p1.deductions AS allowance, /* 공제액 */
            p1.netPay AS total,        /* 실지급액 */
            p1.payItems,
            p1.regDt
        FROM new_tb_member_payroll_month p1
                 INNER JOIN (
            /* 해당 멤버의 월별 최신 idx만 추출 */
            SELECT MAX(idx) AS max_idx
            FROM new_tb_member_payroll_month
            WHERE mIdx = ?
            GROUP BY year, month
        ) p2 ON p1.idx = p2.max_idx
        ORDER BY p1.year DESC, p1.month DESC
            LIMIT 12;
    `;
    let aParameter = [mIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return [];
    }
}

exports.getPayrollCalculateTemp = async function (year, month) {
    let sql = "select"
    sql += " m.idx,"
    sql += " m.id,"
    sql += " m.type,"
    sql += " (select name from new_tb_site where ma.sIdx = idx) as siteName,"
    sql += " (select idx from new_tb_site where ma.sIdx = idx) as sIdx,"
    sql += " (select itemNm from new_tb_code where m.position = itemCd) as role,"
    sql += " (select payment_day from new_tb_site where idx = ma.sIdx) as payment_day,"
    sql += " m.name as staff,"

    // =================================================================================
    // 1. 결근 일수 (absentDays)
    // =================================================================================
    sql += " ("
    sql += "   SELECT COUNT(DISTINCT DATE(workStartDt)) FROM new_tb_work"
    sql += "   WHERE mIdx = m.idx"
    sql += "   AND YEAR(workStartDt) = ? AND MONTH(workStartDt) = ?"
    sql += "   AND workType = 'absent'"
    sql += " ) as absentDays,"

    // =================================================================================
    // ★ 2. 기준 근무일수 (scheduledDays)
    // 등록된 스케줄(출근+연차+결근)이 1개라도 있으면 그 개수(예: 15, 16)를 그대로 쓰고,
    // 데이터가 아예 없으면 계약서 기반 평균 일수를 출력합니다.
    // =================================================================================
    sql += " ("
    sql += "   SELECT CASE"
    sql += "     WHEN COUNT(idx) > 0 THEN COUNT(DISTINCT DATE(workStartDt))"
    sql += "     ELSE IF(IFNULL(mc.day_work_time, 0) > 0, ROUND(mc.month_work_time / mc.day_work_time, 0), 0)"
    sql += "   END"
    sql += "   FROM new_tb_work"
    sql += "   WHERE mIdx = m.idx"
    sql += "   AND YEAR(workStartDt) = ? AND MONTH(workStartDt) = ?"
    sql += "   AND workType IN ('work', 'annual', 'absent','holiday')"
    sql += " ) as scheduledDays,"

    // =================================================================================
    // ★ 3. 실제 일한 일수 (workedDays)
    // scheduledDays와 동일한 원리이나, 카운트할 때 '결근(absent)'만 쏙 빼고 셉니다.
    // =================================================================================
    sql += " ("
    sql += "   SELECT CASE"
    sql += "     WHEN COUNT(idx) > 0 THEN COUNT(DISTINCT CASE WHEN workType IN ('work', 'annual','holiday') THEN DATE(workStartDt) END)"
    sql += "     ELSE IF(IFNULL(mc.day_work_time, 0) > 0, ROUND(mc.month_work_time / mc.day_work_time, 0), 0)"
    sql += "   END"
    sql += "   FROM new_tb_work"
    sql += "   WHERE mIdx = m.idx"
    sql += "   AND YEAR(workStartDt) = ? AND MONTH(workStartDt) = ?"
    sql += "   AND workType IN ('work', 'annual', 'absent','holiday')"
    sql += " ) as workedDays,"

    // 4. [급여 및 공제 내역]
    sql += " IFNULL(mpm.payItems, bs.payItems) as payItems,"
    sql += " IFNULL(mpm.deductionItems, bs.deductionItems) as deductionItems,"
    sql += " IFNULL(mpm.grossPay, bs.grossPay) as grossPay,"
    sql += " IFNULL(mpm.checkedItems, bs.checkedItems) as checkedItems,"
    sql += " IFNULL(mpm.deductions, 0) as totalDeduction,"
    sql += " IFNULL(mpm.netPay, 0) as netPay,"
    sql += " IF(mpm.idx IS NOT NULL, 1, 0) as status"

    sql += " from new_tb_member m";

    // --- [JOIN 1] 연/월 급여 내역 (mpm) ---
    sql += " left join new_tb_member_payroll_month mpm ON mpm.idx = (";
    sql += "     SELECT idx FROM new_tb_member_payroll_month";
    sql += "     WHERE mIdx = m.idx AND year = ? AND month = ?";
    sql += "     ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    // --- [JOIN 2] 최신 기본급 설정 (bs) ---
    sql += " left join new_tb_member_base_salary bs ON bs.idx = (";
    sql += "     SELECT idx FROM new_tb_member_base_salary";
    sql += "     WHERE mIdx = m.idx ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    // --- [JOIN 3] 최신 근로계약 정보 (mc) ---
    sql += " left join new_tb_member_contract mc ON mc.idx = (";
    sql += "     SELECT idx FROM new_tb_member_contract";
    sql += "     WHERE mIdx = m.idx ORDER BY regDt DESC LIMIT 1";
    sql += " )";

    sql += " left join new_tb_member_assignment ma on ma.mIdx = m.idx";
    sql += " left join new_tb_site s on s.idx = ma.sIdx";

    sql += " order by s.name, m.name";

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
