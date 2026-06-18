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
    // targetMonthStr 예: '2026-03' → 첫날과 마지막날로 변환
    const startOfMonth = `${targetMonthStr}-01`;
    const endOfMonth = new Date(targetMonthStr + '-01');
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0); // 말일
    const endOfMonthStr = endOfMonth.toISOString().split('T')[0];

    let sql = `
        SELECT 
            mc.*,
            m.name,
            m.id,
            s.idx AS \`sIdx\`,
            s.name AS \`siteName\`,
            s.payment_day,
            (SELECT itemNm FROM new_tb_code WHERE itemCd = m.position) AS \`role\`
        FROM new_tb_member m
        INNER JOIN (
            SELECT sub.*
            FROM new_tb_member_contract sub
            INNER JOIN (
                SELECT mIdx, MAX(idx) AS max_idx
                FROM new_tb_member_contract
                GROUP BY mIdx
            ) latest ON sub.mIdx = latest.mIdx AND sub.idx = latest.max_idx
            WHERE sub.startDt <= ?
              AND (sub.endDt >= ? OR sub.endDt IS NULL)
        ) mc ON m.idx = mc.mIdx
        LEFT JOIN new_tb_site s ON s.idx = mc.sIdx
        ORDER BY m.idx
    `;

    let aParameter = [endOfMonthStr, startOfMonth];  // endDt >= startOfMonth, startDt <= endOfMonth

    try {
        let [res] = await pool.query(sql, aParameter);
        console.log(`[getMemberContract] 성공 - 조회된 계약 수: ${res.length}`);
        return res;
    } catch (e) {
        console.log('[getMemberContract] db err', e);
        return { 'data': '-9999' };
    }
};

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

exports.updateFilePath = async function (originalNamesStr, fileUrlsStr, sIdx){
    // 쿼리는 기존과 동일
    let sql = "update new_tb_site set contractFileOriginal = ?, contractFileSaved = ? where idx = ?"
    let aParameter = [originalNamesStr, fileUrlsStr, sIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

// 1. 현장 PK(sIdx)에 속한 계약 리스트를 등록 순서(idx ASC)대로 조회하는 메서드
exports.getContractsBySite = async function (sIdx) {
    let sql = "select idx, type from new_tb_site_contract where sIdx = ? order by idx asc";
    let query = mysql.format(sql, [sIdx]);

    try {
        let [rows] = await pool.query(query);
        return rows;
    } catch (e) {
        console.log('db err (getContractsBySite)', e);
        throw e;
    }
};

// 2. 계약 고유 PK(contractIdx)를 기준으로 파일 경로를 업데이트하는 메서드
exports.updateContractFilePath = async function (originalNamesStr, fileUrlsStr, contractIdx) {
    // 설계해주신 new_tb_site_contract 테이블의 파일 컬럼명을 정확히 타겟팅합니다.
    let sql = `
        update new_tb_site_contract 
        set contractFileOriginal = ?, 
            contractFileSaved = ? 
        where idx = ?
    `;
    let aParameter = [originalNamesStr, fileUrlsStr, contractIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(query);
        return res;
    } catch (e) {
        console.log('db err (updateContractFilePath)', e);
        throw e;
    }
};

exports.downloadFilePath = async function (sIdx) {
    let sql = "SELECT contractFileOriginal, contractFileSaved FROM new_tb_site WHERE idx in (?)"
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
