const mysql = require("mysql2/promise");
const pool = require("../config/mysql");

exports.getNoticeList = async function () {
    let sql = "select * from new_tb_notice";
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

exports.getNoticeData = async function (idx) {
    let sql = "select * from new_tb_notice where idx = ?"
    let aParameter = [idx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setNotice = async function (title, content, createdBy, target){
    let sql = "insert into new_tb_notice (title, content, createBy, target) values (?, ?, ?, ?)"
    let aParameter = [title, content, createdBy, target];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
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

exports.getBaseCode = async function () {
    /*
    let sql ="SELECT\n" +
        "    -- Level 1 (대분류: 그룹)\n" +
        "    L1.itemCd   AS groupCode,\n" +
        "    L1.itemNm   AS groupName,\n" +
        "\n" +
        "    -- Level 2 (중분류: 서브그룹 혹은 직접 코드)\n" +
        "    L2.itemCd   AS subCode,\n" +
        "    L2.itemNm   AS subName,\n" +
        "\n" +
        "    -- Level 3 (소분류: 실제 상세 코드)\n" +
        "    L3.itemCd   AS detailCode,\n" +
        "    L3.itemNm   AS detailName\n" +
        "\n" +
        "FROM (SELECT * FROM new_tb_code WHERE LENGTH(itemCd) = 2 AND useFl = 'Y') L1\n" +
        "LEFT JOIN new_tb_code L2\n" +
        "    ON L2.groupCd = L1.itemCd\n" +
        "    AND LENGTH(L2.itemCd) = 5\n" +
        "    AND L2.useFl = 'Y'\n" +
        "LEFT JOIN new_tb_code L3\n" +
        "    ON L3.groupCd = L2.itemCd\n" +
        "    AND LENGTH(L3.itemCd) = 8\n" +
        "    AND L3.useFl = 'Y'\n" +
        "WHERE\n" +
        "    L1.cIdx = 1  -- 특정 회사/현장 ID\n" +
        "ORDER BY\n" +
        "    L1.itemCd, L2.itemCd, L3.itemCd";

     */
    let sql ="SELECT"
    sql += " L1.itemCd   AS groupCode,"
    sql += " L1.itemNm   AS groupName," // Level 1 (대분류: 그룹)
    sql += " L2.itemCd   AS subCode,"
    sql += " L2.itemNm   AS subName,"   // Level 2 (중분류: 서브그룹 혹은 직접 코드)
    sql += " L3.itemCd   AS detailCode,"
    sql += " L3.itemNm   AS detailName" // Level 3 (소분류: 실제 상세 코드)
    sql += " FROM (SELECT * FROM new_tb_code WHERE LENGTH(itemCd) = 2 AND useFl = 'Y') L1"
    sql += " LEFT JOIN new_tb_code L2"
    sql += " ON L2.groupCd = L1.itemCd"
    sql += " AND LENGTH(L2.itemCd) = 5"
    sql += " AND L2.useFl = 'Y'"
    sql += " LEFT JOIN new_tb_code L3"
    sql += " ON L3.groupCd = L2.itemCd"
    sql += " AND LENGTH(L3.itemCd) = 8"
    sql += " AND L3.useFl = 'Y'"
    sql += " WHERE L1.cIdx = 1"  // 특정 회사/현장 ID
    sql += " ORDER BY L1.itemCd, L2.itemCd, L3.itemCd";
    let aParameter = [];

    //let query = mysql.format(sql, aParameter);
    try {
        console.log("2. 쿼리 실행 직전 (여기서 멈추면 DB 연결 풀 문제)");
        let [res] = await pool.query(sql, aParameter);
        console.log('DB 조회 결과:', res); // 로그로 데이터가 찍히는지 확인
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getGroupCode = async function (groupCd) {
    let sql = "select * from new_tb_code where groupCd in (?) and itemCd <> groupCd"
    let aParameter = [groupCd];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setWageCode = async function (cIdx, groupCd, itemCd, itemNm, sort, useFl, regDt) {
    console.log(cIdx, groupCd, itemCd, itemNm, sort, useFl, regDt);
    let sql = "insert into new_tb_code_wage (cIdx, groupCd, itemCd, itemNm, sort, useFl, tax_free, regDt) values (?, ?, ?, ?, ?, ?, ?, ?)"
    sql += " ON DUPLICATE KEY UPDATE itemCd=?,itemNm=?,sort=?,useFl=?,tax_free=?,modDt=?"
    let aParameter = [cIdx, groupCd, itemCd, itemNm, sort, useFl, regDt, itemCd, itemNm, sort, useFl, regDt];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setBaseCode = async function (cIdx, groupCd, itemCd, itemNm, sort, useFl, regDt) {
    let sql = "insert into new_tb_code (cIdx, groupCd, itemCd, itemNm, sort, useFl, regDt) values (?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [cIdx, groupCd, itemCd, itemNm, sort, useFl, regDt];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getCompanyConfig = async function (cIdx) {
    let sql = "select * from new_tb_config where idx in (?)"
    let aParameter = [cIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWageCode = async function (cIdx) {
    let sql = "SELECT itemNm, itemCd,groupCd,"
    sql += " CASE groupCd"
    sql += "    WHEN '04001' THEN '지급항목'"
    sql += "    WHEN '04002' THEN '공제항목'"
    sql += " END AS groupNm"
    sql += " FROM new_tb_code_wage"
    sql += " WHERE groupCd IN ('04001', '04002') and cIdx in (?)"
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

exports.deleteWageCode = async function (itemCd) {console.log(itemCd,' itemCd')
    let sql = "delete from new_tb_code_wage where itemCd = ?"
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

exports.setTaxRate = async function (appliedYear, pensionRate, healthRate, longTermCareRate, employmentRate){
    let sql = "insert into new_tb_tax_rate (applied_year, pension_rate, health_rate, long_term_care_rate, employment_rate) values (?, ?, ?, ?, ?)"
    let aParameter = [appliedYear, pensionRate, healthRate, longTermCareRate, employmentRate];
    let query = mysql.format(sql, aParameter);

    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getTaxRate = async function (year){
    let sql = "select * from new_tb_tax_rate where applied_year in (?)";
    let aParameter = [year];
    let query = mysql.format(sql, aParameter);

    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
