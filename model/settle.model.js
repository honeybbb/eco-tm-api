const pool = require("../config/mysql");
const mysql = require("mysql2/promise");

exports.getSettleList = async function (startMonth, endMonth, docType, cIdx) {
    let sql = "SELECT ss.*, ";
    sql += " (SELECT itemNm FROM new_tb_code WHERE itemCd = ss.type AND cIdx = ? LIMIT 1) AS typeNm";
    sql += " FROM new_tb_site_settlement ss ";
    // 연도와 월을 합쳐서 'YYYYMM' 형태의 문자열로 만든 후 BETWEEN 검색
    sql += " WHERE CONCAT(ss.year, LPAD(ss.month, 2, '0')) BETWEEN ? AND ? ";
    sql += " AND ss.docType IN (?) AND ss.cIdx = ?";

    let aParameter = [cIdx, startMonth, endMonth, docType, cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

// 대상 월의 실제 근무 기반 급여 데이터를 반환하는 통합 API
exports.getAssignedMembers = async function (cIdx, sIdx, endDt, startDt) {
    let sql = `
        SELECT m.idx, m.name, m.position, m.inDate, m.outDate, c.itemNm as roleNm
        FROM new_tb_member m
                 JOIN new_tb_member_assignment ma ON ma.mIdx = m.idx
                 LEFT JOIN new_tb_code c ON c.itemCd = LEFT(m.position, 8) AND c.cIdx = m.cIdx
        WHERE m.cIdx = ? AND ma.sIdx = ?
          AND m.inDate <= ? AND (m.outDate IS NULL OR m.outDate >= ?)
    `;
    let aParameter = [cIdx, sIdx, endDt, startDt];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.error('getAssignedMembers db err', e);
        // DB 에러가 발생했을 때 '-9999'를 리턴하면 Controller의 for...of 에서 에러가 남
        // 가능하면 throw e; 를 해서 Controller의 catch 블록으로 넘기는 것이 정석
        return { 'data': '-9999' };
    }
}

exports.getSettlePayroll = async function (cIdx, year, month, sIdx){
    let sql = "select";
    sql += " m.idx,";
    sql += " m.id,";
    sql += " m.type,";
    sql += " m.birthDt,";
    sql += " m.inDate, m.outDate, m.transferDate, m.status as mStatus,"
    sql += " (SELECT name FROM new_tb_site WHERE idx = ma.sIdx LIMIT 1) as siteName,";
    sql += " ma.sIdx as sIdx,";
    sql += " c.itemNm as role,";
    sql += " c.itemCd,"
    sql += " c.sort,";
    sql += " m.name as staff,";
    sql += " m.billingName as billingName,";
    sql += " m.disability,m.disability_grade, m.disability_date,"
    //자동 계산 여부
    sql += " IFNULL(mbs.isAutoCalc, IFNULL(mc.isAutoCalc, 'Y')) as isAutoCalc,";

    // 1. 급여 항목 데이터 매핑
    sql += " IFNULL(mbs.payItems, mc.payItems) as payItems,"; //mbs는 직원급여정보, mc는 현장산출 정보
    sql += " IFNULL(mbs.deductionItems, mc.deductionItems) as deductionItems,";
    sql += " IFNULL(mbs.checkedItems, JSON_OBJECT()) as checkedItems,";

    // 2. 상태값(status) 처리: mbs 데이터가 없으면(NULL이면) 0, 있으면 1(또는 mbs의 기존 상태값)
    // mbs.idx가 없다는 것은 계약서에서 데이터를 끌어왔다는 의미이므로 0을 반환합니다.
    sql += " CASE WHEN mbs.idx IS NULL THEN 0 ELSE 1 END as status,";
    sql += " mbs.grossPay, mbs.deductions AS totalDeduction, mbs.netPay";
    sql += " from new_tb_member m";

    // 기본급 정보 (최신 1건)
    sql += " left join new_tb_member_base_salary mbs ON mbs.idx = (SELECT idx FROM new_tb_member_base_salary WHERE mIdx = m.idx ORDER BY regDt DESC LIMIT 1)";

    // 계약서 정보 (최신 1건)
    sql += " left join new_tb_member_contract mc ON mc.idx = (SELECT idx FROM new_tb_member_contract WHERE mIdx = m.idx ORDER BY regDt DESC LIMIT 1)";

    sql += " left join new_tb_site s on s.idx = mbs.sIdx";
    sql += " left join new_tb_member_assignment ma ON ma.idx = (";
    sql += "     SELECT idx FROM new_tb_member_assignment ";
    sql += "     WHERE mIdx = m.idx ORDER BY idx DESC LIMIT 1"; // 최신 배정 정보 1건만
    sql += " )";
    //sql += " left join new_tb_code c on c.itemCd = m.position and c.cIdx = m.cIdx";
    // LEFT(m.position, 8)을 사용하여 앞에서부터 8자리만 추출해 매칭
    sql += " left join new_tb_code c on c.itemCd = LEFT(m.position, 8) and c.cIdx = m.cIdx";

    // 기본 WHERE 조건
    sql += " WHERE m.cIdx = ?";
    let aParameter = [cIdx];

    if (year && month) {
        const targetMonth = String(month).padStart(2, '0'); // month가 '7'로 와도 '07'로 안전하게 변환
        const targetDate = `${year}-${targetMonth}-01`;

        // 1. 입사일이 해당 월의 마지막 날보다 작거나 같음 (MySQL의 LAST_DAY 함수 사용)
        sql += " AND m.inDate <= LAST_DAY(?)";
        aParameter.push(targetDate);

        // 2. 퇴사일이 없거나(NULL), 해당 월의 1일보다 크거나 같음
        sql += " AND (m.outDate IS NULL OR m.outDate >= ?)";
        aParameter.push(targetDate);
    }

    // 2. sIdx가 넘어왔을 경우에만 AND 조건 동적 추가
    if (sIdx) {
        sql += " AND ma.sIdx = ?"; // 배정된 현장(ma.sIdx) 기준으로 필터링 (필요시 s.idx로 변경)
        aParameter.push(sIdx);
    }

    sql += " order by s.idx, c.sort, m.idx";

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getSettlePayroll_v2 = async function (cIdx, year, month, sIdx) {
    let sql = "select";
    sql += " m.idx,";
    sql += " m.id,";
    sql += " m.type,";
    sql += " m.birthDt,";
    sql += " m.inDate, m.outDate, m.transferDate, m.status as mStatus,";
    sql += " (SELECT name FROM new_tb_site WHERE idx = ma.sIdx LIMIT 1) as siteName,";
    sql += " ma.sIdx as sIdx,";
    sql += " c.itemNm as role,";
    sql += " c.sort,";
    sql += " m.name as staff,";
    sql += " m.billingName as billingName,";
    sql += " m.disability, m.disability_grade, m.disability_date,";
    sql += " IFNULL(mbs.isAutoCalc, IFNULL(mc.isAutoCalc, 'Y')) as isAutoCalc,";
    sql += " IFNULL(mbs.payItems, mc.payItems) as payItems,";
    sql += " IFNULL(mbs.deductionItems, mc.deductionItems) as deductionItems,";
    sql += " IFNULL(mbs.checkedItems, JSON_OBJECT()) as checkedItems,";
    sql += " CASE WHEN mbs.idx IS NULL THEN 0 ELSE 1 END as status,";
    sql += " mbs.grossPay, mbs.deductions AS totalDeduction, mbs.netPay,";

    // ── 근무일수 계산 (getPayrollCalculate와 동일 패턴) ──
    sql += " DAY(LAST_DAY(CONCAT(?, '-', LPAD(?, 2, '0'), '-01'))) AS scheduledDays,";

    sql += ` (
      DATEDIFF(
        LEAST(
          IFNULL(
            CASE WHEN m.outDate IS NOT NULL AND m.outDate != '0000-00-00'
                 THEN m.outDate
            END,
            LAST_DAY(CONCAT(?, '-', LPAD(?, 2, '0'), '-01'))
          ),
          LAST_DAY(CONCAT(?, '-', LPAD(?, 2, '0'), '-01'))
        ),
        GREATEST(
          DATE(m.inDate),
          CONCAT(?, '-', LPAD(?, 2, '0'), '-01')
        )
      ) + 1
    ) AS eligibleDays,`;

    sql += ` (
      SELECT COUNT(DISTINCT DATE(workStartDt))
      FROM new_tb_work
      WHERE mIdx = m.idx
        AND YEAR(workStartDt) = ? AND MONTH(workStartDt) = ?
        AND workType = 'absent'
    ) AS absentDays,`;

    sql += ` (
      (
        DATEDIFF(
          LEAST(
            IFNULL(
              CASE WHEN m.outDate IS NOT NULL AND m.outDate != '0000-00-00'
                   THEN m.outDate
              END,
              LAST_DAY(CONCAT(?, '-', LPAD(?, 2, '0'), '-01'))
            ),
            LAST_DAY(CONCAT(?, '-', LPAD(?, 2, '0'), '-01'))
          ),
          GREATEST(
            DATE(m.inDate),
            CONCAT(?, '-', LPAD(?, 2, '0'), '-01')
          )
        ) + 1
      )
      -
      (
        SELECT COUNT(DISTINCT DATE(workStartDt))
        FROM new_tb_work
        WHERE mIdx = m.idx
          AND YEAR(workStartDt) = ? AND MONTH(workStartDt) = ?
          AND workType = 'absent'
      )
    ) AS workedDays`;

    sql += " from new_tb_member m";
    sql += " left join new_tb_member_base_salary mbs ON mbs.idx = (SELECT idx FROM new_tb_member_base_salary WHERE mIdx = m.idx ORDER BY regDt DESC LIMIT 1)";
    sql += " left join new_tb_member_contract mc ON mc.idx = (SELECT idx FROM new_tb_member_contract WHERE mIdx = m.idx ORDER BY regDt DESC LIMIT 1)";
    sql += " left join new_tb_site s on s.idx = mbs.sIdx";
    sql += " left join new_tb_member_assignment ma ON ma.idx = (";
    sql += "     SELECT idx FROM new_tb_member_assignment ";
    sql += "     WHERE mIdx = m.idx ORDER BY idx DESC LIMIT 1";
    sql += " )";
    sql += " left join new_tb_code c on c.itemCd = LEFT(m.position, 8) and c.cIdx = m.cIdx";

    sql += " WHERE m.cIdx = ?";
    let aParameter = [
        year, month,        // scheduledDays
        year, month,        // eligibleDays: LEAST outDate
        year, month,        // eligibleDays: LAST_DAY
        year, month,        // eligibleDays: GREATEST inDate
        year, month,        // absentDays
        year, month,        // workedDays: LEAST outDate
        year, month,        // workedDays: LAST_DAY
        year, month,        // workedDays: GREATEST inDate
        year, month,        // workedDays: absentDays 서브쿼리
        cIdx,                // WHERE m.cIdx
    ];

    if (year && month) {
        const targetMonth = String(month).padStart(2, '0');
        const targetDate = `${year}-${targetMonth}-01`;

        sql += " AND m.inDate <= LAST_DAY(?)";
        aParameter.push(targetDate);

        sql += " AND (m.outDate IS NULL OR m.outDate >= ?)";
        aParameter.push(targetDate);
    }

    if (sIdx) {
        sql += " AND ma.sIdx = ?";
        aParameter.push(sIdx);
    }

    sql += " order by s.idx, c.sort, m.idx";

    try {
        let [res] = await pool.query(sql, aParameter);

        // ── ★ 후처리: 일할 계산 적용 ──
        const safeParse = (val) => {
            if (!val) return {};
            if (typeof val === 'object') return val;
            try { return JSON.parse(val); } catch { return {}; }
        };

        // 근무일수 비율 곱해서 항목별 금액 재계산할 때 제외할 코드
        // (연차/퇴직/근로자의날 적립금, 산재보험 등은 별도 로직에서 처리하므로 여기선 그대로 둠)
        const EXCLUDE_FROM_PRORATE = ['04001003', '04001004', '04001002007', '04002001008'];

        const round10 = (n) => Math.floor(n / 10) * 10;

        res = res.map(row => {
            const scheduledDays = Number(row.scheduledDays) || 0;
            const eligibleDays  = Number(row.eligibleDays)  || 0;
            const absentDays    = Number(row.absentDays)    || 0;
            const workedDays    = Math.max(0, Number(row.workedDays) || 0);

            // 재직 유효일수 기준 비율 (결근 반영)
            // 예: 이 달에 20일 재직 가능했는데 2일 결근 → 18/20 비율
            const ratio = eligibleDays > 0 ? workedDays / eligibleDays : 0;

            const payItemsObj = safeParse(row.payItems);
            const deductionItemsObj = safeParse(row.deductionItems);

            const proratedPayItems = {};
            Object.entries(payItemsObj).forEach(([cd, amt]) => {
                const num = Number(amt) || 0;
                proratedPayItems[cd] = EXCLUDE_FROM_PRORATE.includes(cd)
                    ? num
                    : round10(num * ratio);
            });

            const proratedDeductionItems = {};
            Object.entries(deductionItemsObj).forEach(([cd, amt]) => {
                const num = Number(amt) || 0;
                proratedDeductionItems[cd] = EXCLUDE_FROM_PRORATE.includes(cd)
                    ? num
                    : round10(num * ratio);
            });

            return {
                ...row,
                scheduledDays,
                eligibleDays,
                absentDays,
                workedDays,
                workRatio: ratio,
                // 원본은 참고용으로 별도 보관, 실제 사용값은 prorated로 덮어씀
                originalPayItems: row.payItems,
                originalDeductionItems: row.deductionItems,
                payItems: JSON.stringify(proratedPayItems),
                deductionItems: JSON.stringify(proratedDeductionItems),
            };
        });

        return res;
    } catch (e) {
        console.log('db err', e);
        return { 'data': '-9999' };
    }
};

exports.getSettleSummary = async function (year, month) {
    // 단지명, 계약인원, 현재인원(status=0), 여(gender=F), 남(gender=M), 입사(inDate), 퇴사(outDate), 공백(급여작업인원-계약인원),
    // 단지청구액, 급여지급액
    // let sql = "select (select a.name new_tb_site a where a.idx = ss.sIdx) as `sName`, ss.docType, ss.type, ss.grandTotal, ss.billingData from new_tb_site_settlement ss"
    // sql += " where ss.year = ? and ss.month = ?"
    let sql = `
        SELECT s.name AS siteName,
           ss.docType,
           ss.type,
           ss.grandTotal AS billingAmt, /* 청구액 (총용역비) */

        /* 1. 단지 계약 테이블의 배정 직원수 */
           IFNULL(sc.staffCount, 0)   AS contractCnt,

        /* 2. 인원 통계 (서브쿼리 m_stats) */
           IFNULL(ma.currentCnt, 0)   AS currentCnt,
           IFNULL(ma.female, 0)       AS female,
           IFNULL(ma.male, 0)         AS male,
           IFNULL(ma.joinCnt, 0)      AS \`join\`,
           IFNULL(ma.outCnt, 0)       AS resign,

        /* 3. 급여지급액 합계 (서브쿼리 mpm) */
           IFNULL(mpm.netPayTotal, 0) AS netPay,
           IFNULL(mpm.payrollCnt, 0) AS payrollCnt

        FROM new_tb_site_settlement ss

         /* [청구 데이터] 최신 청구 데이터만 추출 */
         INNER JOIN (SELECT MAX(idx) AS max_idx
                     FROM new_tb_site_settlement
                     WHERE year = ? AND month = ?
                     GROUP BY sIdx) latest ON ss.idx = latest.max_idx

         INNER JOIN new_tb_site s ON s.idx = ss.sIdx

         /* [계약 인원] 현장 및 타입별 최신 계약 인원 가져오기 */
         LEFT JOIN (SELECT sc1.sIdx, sc1.type, sc1.staffCount
                    FROM new_tb_site_contract sc1
                             INNER JOIN (SELECT sIdx, type, MAX(idx) AS max_idx
                                         FROM new_tb_site_contract
                                         GROUP BY sIdx, type) sc2 ON sc1.idx = sc2.max_idx) sc
                   ON sc.sIdx = ss.sIdx AND sc.type = ss.type

         /* [인원 통계] new_tb_member_assignment를 통해 직원의 최신 현장 매핑 */
         LEFT JOIN (SELECT ma.sIdx, /* 배정 테이블의 현장 idx 기준 */
                   SUM(CASE WHEN m.status = 0 THEN 1 ELSE 0 END)                                AS currentCnt,
                   SUM(CASE WHEN m.status = 0 AND m.gender = 'F' THEN 1 ELSE 0 END)             AS female,
                   SUM(CASE WHEN m.status = 0 AND m.gender = 'M' THEN 1 ELSE 0 END)             AS male,
                   SUM(CASE WHEN YEAR (m.inDate) = ? AND MONTH(m.inDate) = ? THEN 1 ELSE 0 END) AS joinCnt,
                   SUM(CASE WHEN YEAR (m.outDate) = ? AND MONTH(outDate) = ? THEN 1 ELSE 0 END) AS outCnt
            FROM new_tb_member m
             /* 직원의 가장 최근 배정 내역(assignment) 조인 */
             INNER JOIN (SELECT a1.mIdx, a1.sIdx
                         FROM new_tb_member_assignment a1
                              INNER JOIN (SELECT mIdx, MAX(idx) AS max_idx
                                  FROM new_tb_member_assignment
                                  GROUP BY mIdx) a2 ON a1.idx = a2.max_idx) ma
                                        ON m.idx = ma.mIdx
                    GROUP BY ma.sIdx) ma ON ma.sIdx = ss.sIdx

        /* [급여 합계] 해당 연/월 실수령액 총합 */
         LEFT JOIN (
            SELECT 
                sIdx,
                SUM(netPay) AS netPayTotal,
                count(*) as \`payrollCnt\`
            FROM new_tb_member_payroll_month
            WHERE year = ? AND month = ?
            GROUP BY sIdx
        ) mpm ON mpm.sIdx = ss.sIdx
        
        ORDER BY s.name ASC
    `;

        // 파라미터 순서 매핑
    let aParameter = [
        year, month,           // latest 청구 데이터 서브쿼리용
        year, month,           // ma 입사자 카운트용
        year, month,           // ma 퇴사자 카운트용
        year, month            // mpm 급여 합계용
    ];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getSettleBilling = async function (cIdx, startMonth, endMonth) {
    //구분(type), docType, 근무인원, 단지청구일, 계산서 작성일(?),
    //단지(sName), payment_day, 본사담당자, 청구담당자,
    //공급가/면세, 공급가/과세, 부가세, 합계, 은행명, 입금일, 금액, 계
    let sql = `SELECT
            ss.sIdx,
            ss.year,
            ss.month,
            ss.type,
            c.itemNm AS typeNm,
            ss.docType,
            s.name as \`siteName\`,
            s.payment_day,
            s.manager,
            s.billingManager,
            ss.subTotal,
            ss.vatAmount,
            ss.grandTotal,
            ss.billingDt, 
            ss.status,
            ss.depositDt,
            s.bankName
        FROM new_tb_site_settlement ss
        /* 1. 현장별, 년월별로 가장 최근(MAX) 등록일시를 찾아서 조인 */
        INNER JOIN (
            SELECT
                sIdx,
                year,
                month,
                MAX(regDt) as max_regDt
            FROM new_tb_site_settlement
            GROUP BY sIdx, year, month
        ) max_ss
            ON ss.sIdx = max_ss.sIdx
            AND ss.year = max_ss.year
            AND ss.month = max_ss.month
            AND ss.regDt = max_ss.max_regDt
        /* 2. 찾아낸 최신 정산 데이터와 현장 테이블 조인 */
        LEFT JOIN new_tb_site s ON s.idx = ss.sIdx
        LEFT JOIN new_tb_code c ON c.itemCd = ss.type AND c.cIdx = ?

        WHERE CONCAT(ss.year, LPAD(ss.month, 2, '0')) BETWEEN ? AND ?
          and ss.cIdx = ?
        `;
    // where ss.year = ? and ss.month = ?

    let aParameter = [cIdx, startMonth, endMonth, cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

/** 20260416 수정
exports.getSettleList = async function (year, month, docType, cIdx) {
    let sql = "SELECT ss.*, ";
    sql += " (SELECT itemNm FROM new_tb_code WHERE itemCd = ss.type AND cIdx = ? LIMIT 1) AS typeNm";
    sql += " FROM new_tb_site_settlement ss ";
    sql += " WHERE ss.year IN (?) AND ss.month IN (?) AND ss.docType IN (?)";
    sql += " AND ss.cIdx = ?";

    let aParameter = [cIdx, year, month, docType, cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
**/

exports.setSettleData = async function (sIdx, cIdx, year, month, docType, docNo, type, billingDt,
                                        subTotal, vatAmount, grandTotal,
                                        strBillingData, strPayrollData, strViewConfig) {
    let sql = `
        INSERT INTO new_tb_site_settlement
        (
         sIdx, cIdx, year, month, docType, docNo, type, billingDt, 
         subTotal, vatAmount, grandTotal, billingData, payrollData, viewConfig)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    let aParameter = [
        sIdx, cIdx, year, month, docType, docNo, type, billingDt,
        subTotal, vatAmount, grandTotal,
        strBillingData, strPayrollData, strViewConfig
    ];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.updateSettleData = async function (year, month, type, docNo, billingDt,
                                           subTotal, vatAmount, grandTotal,
                                           strBillingData, strPayrollData, strViewConfig, // ★ 매개변수 추가
                                           idx, sIdx) {
    let sql = `
        UPDATE new_tb_site_settlement
        SET
            year = ?,
            month = ?,
            type = ?,
            docNo = ?,
            billingDt = ?,
            subTotal = ?,
            vatAmount = ?,
            grandTotal = ?,
            billingData = ?,
            payrollData = ?,
            viewConfig = ?, -- ★ SET 절에 추가
            modDt = CURRENT_TIMESTAMP
        WHERE idx = ? AND sIdx = ?
    `;
    let aParameter = [
        year, month, type, docNo, billingDt,
        subTotal, vatAmount, grandTotal,
        strBillingData, strPayrollData, strViewConfig, // ★ 배열 위치 주의 (WHERE 절 변수 전)
        idx, sIdx
    ];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.deleteSettleList = async function (idx) {
    let sql = "delete from new_tb_site_settlement where idx in (?)";
    let aParameter = [idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

// 상태 업데이트
// - 입금(1): depositDt 자동 세팅
// - 미수(2): 미수사유 저장
// - 되돌리기(0): depositDt / 미수사유 초기화
exports.updateSettleStatus = async function (idx, status, bigo) {
    let sql = `
        UPDATE new_tb_site_settlement
        SET
          status      = ?,
          depositDt   = CASE WHEN ? = 1 THEN CURDATE() ELSE NULL END,
          bigo  = CASE WHEN ? = 2 THEN ? ELSE NULL END,
          modDt       = NOW()
        WHERE idx = ?
      `
    let aParameter = [status, status, status, bigo || null, idx];
    try {
        const [res] = await pool.query(sql, aParameter)
        return res
    } catch (e) {
        console.error('db err updateSettleStatus', e)
        return { data: '-9999' }
    }
}

exports.getSettleById = async function (idx) {
    let sql = "SELECT idx, status, sIdx, cIdx FROM new_tb_site_settlement WHERE idx = ? LIMIT 1"
    let aParameter = [idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res[0];
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.insertSettleHistory = async function (settleIdx, orgStatus, toStatus, changedBy) {
    let sql = "INSERT INTO new_tb_site_settlement_history (stIdx, orgStatus, toStatus, managerId, regDt)"
    sql += " VALUES (?, ?, ?, ?, NOW())";


    let aParameter = [settleIdx, orgStatus ?? null, toStatus || null, changedBy || null]
    try {
        const [res] = await pool.query(sql, aParameter)
        return res
    } catch (e) {
        console.error('db err insertSettleHistory', e)
        return { data: '-9999' }
    }
}

exports.setSettleMember = async function (sIdx, cIdx, year, month, docNo, type, billingDt,
                                        subTotal, vatAmount, grandTotal,
                                        strBillingData) {
    let sql = `
        INSERT INTO new_tb_site_settlement
        (sIdx, cIdx, year, month, docType, docNo, type, billingDt, subTotal, vatAmount, grandTotal, billingData)
        VALUES (?, ?, ?, ?, 'ANNUAL', ?, ?, ?, ?, ?, ?, ?)
    `;
    let aParameter = [
        sIdx, cIdx, year, month, docNo, type, billingDt,
        subTotal, vatAmount, grandTotal,
        strBillingData
    ];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.updateSettleMember = async function (
    year, month, type, docNo, billingDt,
    subTotal, vatAmount, grandTotal,
    strBillingData,
    idx, sIdx) {
    let sql = `
        UPDATE new_tb_site_settlement
        SET
            year = ?,
            month = ?,
            type = ?,
            docNo = ?,
            billingDt = ?,
            subTotal = ?,
            vatAmount = ?,
            grandTotal = ?,
            billingData = ?,
            payrollData = ?,
            viewConfig = ?,
            modDt = CURRENT_TIMESTAMP
        WHERE idx = ? AND sIdx = ? and mIdx = ?
    `;
    let aParameter = [
        year, month, type, docNo, billingDt,
        subTotal, vatAmount, grandTotal,
        strBillingData,
        idx, sIdx
    ];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
