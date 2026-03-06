const pool = require("../config/mysql");
const mysql = require("mysql2/promise");

exports.getSettleList = async function (year, month) {
    let sql = "select *, (select itemNm from new_tb_code where itemCd = type) as `typeNm`"
    sql += " from new_tb_site_settlement where `year` in (?) and `month` in (?)";
    let aParameter = [year, month];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
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
