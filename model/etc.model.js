const mysql = require("mysql2/promise");
const pool = require("../config/mysql");

exports.getMenus = async function (companyNo, isMaster, path) {
    // 1. 기본 쿼리: 회사번호 일치 + 사용 여부 'Y'
    // sort(순서)를 1순위, menuNo를 2순위로 정렬하여 일관성을 유지합니다.
    let sql = "SELECT * FROM new_tb_menu WHERE companyNo = ?"

    if(path !== '/settings') {
        sql += " AND useFl = 'Y'";
    }

    // 2. 마스터 권한 체크
    if (!isMaster) {
        sql += " AND masterOnly = 'N'";
    }

    // 3. 정렬 순서 적용 (중요!)
    sql += " ORDER BY depth ASC, sort ASC, menuNo ASC";

    try {
        let [res] = await pool.query(sql, [companyNo]);
        return res;
    } catch (e) {
        console.log('db err', e);
        return { 'data': '-9999' };
    }
};

exports.updateMenus = async function (companyNo, menuNo, menuNm, masterOnly, sort, useFl) {
    let sql = "update new_tb_menu set menuNm=?, masterOnly = ?, sort = ?, useFl = ? where menuNo in (?) and companyNo in (?)";

    let aParameter = [menuNm, masterOnly, sort, useFl, menuNo, companyNo];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getBaseCode1 = async function () {
    let sql ="select * from new_tb_code where groupCd = itemCd"
    let aParameter = [];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getBaseCode = async function (cIdx) {
    let sql ="SELECT"
    sql += " L1.itemCd   AS groupCode,"
    sql += " L1.itemNm   AS groupName," // Level 1 (대분류: 그룹)
    sql += " L1.useFl, L1.deleteFl, L1.editFl, L1.option, L1.sort,"
    sql += " L2.itemCd   AS subCode,"
    sql += " L2.itemNm   AS subName,"   // Level 2 (중분류: 서브그룹 혹은 직접 코드)
    sql += " L2.useFl, L2.deleteFl, L2.editFl, L2.option, L2.sort,"
    sql += " L3.itemCd   AS detailCode,"
    sql += " L3.itemNm   AS detailName," // Level 3 (소분류: 실제 상세 코드)
    sql += " L3.useFl, L3.deleteFl, L3.editFl, L3.option, L3.sort"

    // 서브쿼리 대신 메인 쿼리에서 직접 테이블을 잡습니다.
    sql += " FROM new_tb_code L1"

    // ★ 수정포인트 1: L2 조인 시 cIdx도 일치해야 함
    sql += " LEFT JOIN new_tb_code L2"
    sql += "        ON L2.groupCd = L1.itemCd"
    sql += "       AND L2.cIdx = L1.cIdx"    // <--- 핵심: 같은 회사의 코드만 조인
    sql += "       AND LENGTH(L2.itemCd) = 5"
    // sql += "       AND L2.useFl = 'Y'"

    // ★ 수정포인트 2: L3 조인 시 cIdx도 일치해야 함
    sql += " LEFT JOIN new_tb_code L3"
    sql += "        ON L3.groupCd = L2.itemCd"
    sql += "       AND L3.cIdx = L2.cIdx"    // <--- 핵심: 같은 회사의 코드만 조인
    sql += "       AND LENGTH(L3.itemCd) = 8"
    // sql += "       AND L3.useFl = 'Y'"

    // ★ 메인 필터 조건: 요청한 cIdx와 대분류 길이(2) 필터링
    sql += " WHERE L1.cIdx = ?"
    sql += "   AND LENGTH(L1.itemCd) = 2"
    // sql += "   AND L1.useFl = 'Y'"

    sql += " ORDER BY L1.itemCd, L2.itemCd, L3.itemCd";

    let aParameter = [cIdx];

    try {
        // console.log("2. 쿼리 실행 직전 (여기서 멈추면 DB 연결 풀 문제)");
        let [res] = await pool.query(sql, aParameter);
        // console.log('DB 조회 결과:', res);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getGroupCode = async function (cIdx, groupCd) {
    let sql = "select * from new_tb_code where groupCd in (?) and itemCd <> groupCd and cIdx in (?)"
    let aParameter = [groupCd, cIdx];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setWageCode = async function (cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt) {
    //console.log(cIdx, groupCd, itemCd, itemNm, sort, useFl, regDt);
    let sql = "insert into new_tb_code (cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?)"
    sql += " ON DUPLICATE KEY UPDATE itemNm=?,sort=?,useFl=?,option=?,modDt=?"
    let aParameter = [
        cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt,
        itemNm, sort, useFl, option, regDt];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setBaseCode = async function (cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt) {
    // ON DUPLICATE KEY UPDATE 구문 추가
    let sql = `
        INSERT INTO new_tb_code (cIdx, groupCd, itemCd, itemNm, sort, useFl, \`option\`, regDt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            itemNm = VALUES(itemNm),
            sort = VALUES(sort),
            useFl = VALUES(useFl),
            \`option\` = VALUES(\`option\`)
    `;

    let aParameter = [cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.updateBaseCode = async function (itemCd, itemNm, useFl, option, sort, modDt) {
    let sql = "update new_tb_code set itemNm = ?, useFl=?, `option`=?, `sort`=?, modDt=?"
    sql += " where itemCd in (?)"
    let aParameter = [itemNm, useFl, option, sort, modDt, itemCd];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getCompanyData = async function (cIdx) {
    let sql = "select * from new_tb_config where idx in (?)"
    let aParameter = [cIdx];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res[0];
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setCompanyAccount = async function (cIdx, bank, accountNumber, accountName, isDefault, memo) {
    let sql = "insert into new_tb_config_account (cIdx, bank, accountNumber, accountName, isDefault, memo, regDt)"
    sql += " values (?, ?, ?, ?, ? ,?, NOW())"
    let aParameter = [cIdx, bank, accountNumber, accountName, isDefault, memo];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getCompanyAccount = async function (cIdx) {
    let sql = "select * from new_tb_config_account where cIdx in (?)"
    let aParameter = [cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.updateCompanyAccount = async function (idx, bank, accountNumber, accountName, memo, isDefault) {
    let sql = "update new_tb_config_account set bank=?, accountNumber=?, accountName=?,"
    sql += "memo=?, isDefault=? where idx in (?)"
    let aParameter = [bank, accountNumber, accountName, memo, isDefault, idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
exports.deleteCompanyAccount = async function (idx) {
    let sql = "delete from new_tb_config_account where idx in (?)"
    let aParameter = [idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWageCode = async function (cIdx) {
    let sql = "SELECT itemNm, itemCd, groupCd,"
    sql += " `option` as `tax_free`,useFl, deleteFl, editFl, sort,"
    sql += " CASE groupCd"
    sql += "    WHEN '04001' THEN '지급항목'"
    sql += "    WHEN '04002' THEN '공제항목'"
    sql += "    WHEN '04003' THEN '정산항목'"
    sql += " END AS groupNm"
    sql += " FROM new_tb_code"
    sql += " WHERE groupCd IN ('04001', '04002','04003') and cIdx in (?)"
    sql += " ORDER BY sort";
    let aParameter = [cIdx];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWageCode2 = async function (cIdx) {
    const sql = `
        SELECT itemNm, itemCd, groupCd,
               \`option\` AS tax_free,
               useFl, deleteFl, editFl, sort
        FROM   new_tb_code
        WHERE
--             groupCd LIKE '04%' and 
            cIdx in (?)
        ORDER  BY itemCd, sort
    `;
    try {
        const [res] = await pool.query(sql, [cIdx]);
        return res;
    } catch (e) {
        console.log('db err', e);
        return { data: '-9999' };
    }
};

exports.deleteWageCode = async function (itemCd) {
    let sql = "delete from new_tb_code where itemCd = ?"
    let aParameter = [itemCd];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.deleteBaseCode = async function (itemCd) {
    let sql = "delete from new_tb_code where itemCd = ?"
    let aParameter = [itemCd];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getItemCode = async function (cIdx) {
    let sql ="SELECT"
    sql += " L1.itemCd   AS groupCode,"
    sql += " L1.itemNm   AS groupName," // Level 1 (대분류: 그룹)
    sql += " L2.itemCd   AS subCode,"
    sql += " L2.itemNm   AS subName,"   // Level 2 (중분류: 서브그룹 혹은 직접 코드)
    sql += " L3.itemCd   AS detailCode,"
    sql += " L3.itemNm   AS detailName," // Level 3 (소분류: 실제 상세 코드)
    sql += " L3.price   AS price"
    sql += " FROM (SELECT * FROM new_tb_code_item WHERE LENGTH(itemCd) = 2 AND useFl = 'Y') L1"
    sql += " LEFT JOIN new_tb_code_item L2"
    sql += " ON L2.groupCd = L1.itemCd"
    sql += " AND LENGTH(L2.itemCd) = 5"
    sql += " AND L2.useFl = 'Y'"
    sql += " LEFT JOIN new_tb_code_item L3"
    sql += " ON L3.groupCd = L2.itemCd"
    sql += " AND LENGTH(L3.itemCd) = 8"
    sql += " AND L3.useFl = 'Y'"
    sql += " WHERE L1.cIdx in (?)"  // 특정 회사/현장 ID
    sql += " ORDER BY L1.itemCd, L2.itemCd, L3.itemCd";
    let aParameter = [cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setItemCode = async function (cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt) {
    //console.log(cIdx, groupCd, itemCd, itemNm, sort, useFl, regDt);
    let sql = "insert into new_tb_code (cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt) values (?, ?, ?, ?, ?, ?, ?, ?)"
    sql += " ON DUPLICATE KEY UPDATE itemNm=?,sort=?,useFl=?,option=?,modDt=?"
    let aParameter = [
        cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt,
        itemNm, sort, useFl, option, regDt];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.deleteItemCode = async function (itemCd) {
    let sql = "delete from new_tb_code_item where itemCd = ?"
    let aParameter = [itemCd];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setWorkDays = async function (uIdx, cIdx, year, month, days, bigo) {
    let sql = "insert into new_tb_config_month (uIdx, cIdx, sIdx, year, month, days, bigo) values (?, ?,?, ?, ?, ?, ?)"
    sql += " ON DUPLICATE KEY UPDATE year=?, month=?, days=?, bigo=?"
    let aParameter = [uIdx, cIdx, sIdx, year, month, days, bigo, year, month, days, bigo];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//기준 근무일 수 가져오기
exports.getStandardDays = async function (cIdx, sIdx, from, to) {
    let sql = "SELECT days FROM new_tb_config_month WHERE cIdx = ? and sIdx =?"
    // sql += " AND CONCAT(year, '-', LPAD(month, 2, '0')) BETWEEN ? AND ?"; //LPAD 는 항상 두 자리로 만들어줌
    sql += " AND year = ? AND month = ?"
    // sql += " ORDER BY year, LPAD(month, 2, '0')"

    let aParameter = [cIdx, sIdx, from, to];
    let query = mysql.format(sql, aParameter);

    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};

exports.delWorkDays = async function (uIdx) {
    let sql = "delete from new_tb_config_month WHERE uIdx = ?"

    let aParameter = [uIdx];
    let query = mysql.format(sql, aParameter);

    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setTaxRate = async function (appliedYear, pensionRate, healthRate, longTermCareRate, employmentRate, industrialRate){
    let sql = "insert into new_tb_tax_rate (applied_year, pension_rate, health_rate, long_term_care_rate, employment_rate, industrial_rate)"
    sql += " values (?, ?, ?, ?, ?, ?)"
    let aParameter = [appliedYear, pensionRate, healthRate, longTermCareRate, employmentRate, industrialRate];
    //let query = mysql.format(sql, aParameter);

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getTaxRate = async function (year){
    let sql = "select * from new_tb_tax_rate where applied_year in (?) order by regDt desc limit 1";
    let aParameter = [year];
    //let query = mysql.format(sql, aParameter);

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getTaxIncome = async function (year, salary, familyCnt) {
    let sql = `
        SELECT family_${Math.min(Number(familyCnt), 11)} AS tax_amt
        FROM new_tb_tax_income
        WHERE apply_year = ?
          AND income_min <= ?
          AND income_max > ?
        LIMIT 1`;
    let aParameter = [year, salary, salary];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

// 연도별 세율 구간표 전체 조회
exports.getTaxIncomeTable = async function (year) {
    const sql = `
        SELECT income_min, income_max,
               family_1, family_2, family_3, family_4, family_5, family_6,
               family_7, family_8, family_9, family_10, family_11
        FROM new_tb_tax_income
        WHERE apply_year = ?
        ORDER BY income_min ASC`;
    try {
        const [rows] = await pool.query(sql, [year]);
        return rows;
    } catch (e) {
        console.log('db err', e);
        return [];
    }
}

exports.setOrders = async function (sIdx, orderList, mIdx) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const aParameter = orderList.map(item => [
            sIdx,
            item.detailCode,
            item.qty,
            new Date(),
            mIdx
        ]);


        let sql = "INSERT INTO new_tb_orders (sIdx, itemCd, qty, regDt, mIdx) VALUES ?";
        let [res] = await conn.query(sql, [aParameter]);

        await conn.commit();
        return res;
    } catch (e) {
        await conn.rollback();
        console.log('db err', e);
        return {'data': '-9999'}
    } finally {
        conn.release();
    }
};

exports.getOrders = async function () {
    let sql = `
        SELECT
            o.regDt,
            o.sIdx,
            o.mIdx,
            o.status,
            s.name AS siteName,
            m.name AS applicant,
            m.id as memberId,
            -- 상세 품목들에 상위 카테고리 정보 추가
            JSON_ARRAYAGG(
                    JSON_OBJECT(
                            'idx', o.idx,
                            'categoryName', p.itemNm,      -- 상위 카테고리명 (예: 경비원 상의)
                            'itemName', c.itemNm,          -- 상세 사이즈명 (예: M(90))
                            'fullItemName', CONCAT(p.itemNm, ' - ', c.itemNm), -- 합쳐진 이름
                            'qty', o.qty,
                            'price', CAST(IFNULL(NULLIF(c.option, ''), 0) AS UNSIGNED),
                            'itemCd', o.itemCd
                    )
            ) AS items,
            SUM(o.qty * IFNULL(NULLIF(c.option, ''), 0)) AS totalAmount,
            CONCAT(
                    MAX(p.itemNm), ' (', MAX(c.itemNm), ')',
                    IF(COUNT(o.idx) > 1, CONCAT(' 외 ', COUNT(o.idx) - 1, '건'), '')
            ) AS summary
        FROM new_tb_orders o
                 LEFT JOIN new_tb_site s ON o.sIdx = s.idx
                 LEFT JOIN new_tb_member m ON o.mIdx = m.idx
                 LEFT JOIN new_tb_code c ON o.itemCd = c.itemCd
            -- 상위 카테고리명을 가져오기 위한 Self Join
            -- 이미지 구조상 사이즈 코드의 앞 5자리가 상위 카테고리 코드임
                 LEFT JOIN new_tb_code p ON LEFT(c.itemCd, 5) = p.itemCd
        GROUP BY o.regDt, o.mIdx, o.sIdx, o.status
        ORDER BY o.regDt DESC
    `;
    let aParameter = [];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return { 'data': '-9999' };
    }
};

exports.updateOrderStatus = async function (sIdx, oIdx, status, managerId) {
    let sql = "update new_tb_orders set status = ?, modDt = NOW() WHERE sIdx = ? and idx = ? and managerId = ?";
    let aParameter = [status, sIdx, oIdx, managerId];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return { 'data': '-9999' };
    }
}
