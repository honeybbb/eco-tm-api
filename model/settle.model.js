const pool = require("../config/mysql");
const mysql = require("mysql2/promise");

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

exports.setSettleData = async function (sIdx, cIdx, year, month, docNo, type, billingDt,
                                        subTotal, vatAmount, grandTotal,
                                        strBillingData, strPayrollData) {
    let sql = `
        INSERT INTO new_tb_site_settlement
        (sIdx, cIdx, year, month, docType, docNo, type, billingDt, subTotal, vatAmount, grandTotal, billingData, payrollData)
        VALUES (?, ?, ?, ?, 'SERVICE', ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    let aParameter = [
        sIdx, cIdx, year, month, docNo, type, billingDt,
        subTotal, vatAmount, grandTotal,
        strBillingData, strPayrollData
    ];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.updateSettleData = async function (year, month, type, docNo, billingDt,
                                           subTotal, vatAmount, grandTotal,
                                           strBillingData, strPayrollData,
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
                    modDt = CURRENT_TIMESTAMP
                WHERE idx = ? AND sIdx = ?
            `;
    let aParameter = [
        year, month, type, docNo, billingDt,
        subTotal, vatAmount, grandTotal,
        strBillingData, strPayrollData,
        idx, sIdx
    ];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
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
