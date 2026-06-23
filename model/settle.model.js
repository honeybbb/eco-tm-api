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

exports.getSettleBilling = async function (cIdx, year, month) {
    //구분(type), docType, 근무인원, 단지청구일, 계산서 작성일(?),
    //단지(sName), payment_day, 본사담당자, 청구담당자,
    //공급가/면세, 공급가/과세, 부가세, 합계, 은행명, 입금일, 금액, 계
    let sql = `SELECT
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
        where ss.year = ? and ss.month = ?`;
    // and ss.cIdx = ?`;

    let aParameter = [cIdx, year, month];

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
