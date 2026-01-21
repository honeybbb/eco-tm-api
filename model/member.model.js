const pool = require("../config/mysql");
const mysql = require("mysql")

exports.getMemberList = async function () {
    let sql = "select m.*, case when status = 0 then '재직' when status = 1 then '퇴사' else '-' end as `status`,"
    // sql += " mc.jsonData as wage,"
    sql += " ms.sIdx, ms.name as `siteName`,"
    sql += " c.itemNm as `type`, c2.itemNm as `position`"
    sql += " from new_tb_member m"
    sql += " left join new_tb_member_contract mc on mc.mIdx = m.idx"
    sql += " left join (select b.*, s.name from new_tb_member_assignment b left join new_tb_site s on s.idx = b.sIdx) as `ms` on ms.mIdx = m.idx"
    sql += " left join new_tb_code c on c.itemCd = m.type left join new_tb_code c2 on c2.itemCd = m.position";
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

exports.getMemberData = async function (id) {
    let sql = "select m.*, IFNULL(ms.sIdx, '0') as `sIdx`, cd.itemNm as `position`, cd2.itemNm as `type`,"
    sql += " CONCAT('[',GROUP_CONCAT(JSON_OBJECT('name',s.name, 'address',s.address)),']') as `sites`"
    sql += " from new_tb_member m"
    sql += " inner join new_tb_code cd on cd.itemCd = m.position"
    sql += " inner join new_tb_code cd2 on cd2.itemCd = m.type"
    sql += " left join new_tb_member_assignment ms on m.idx = ms.mIdx"
    sql += " left join new_tb_site s on s.idx = ms.sIdx"
    // sql += " where m.idx = ?"
    sql += " where m.id = ?"
    let aParameter = [id];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getMemberAvailable = async function(sIdx) {
    let sql = "SELECT * FROM new_tb_member m WHERE m.idx NOT IN"
    sql += " (SELECT ma.mIdx"
    sql += " FROM new_tb_member_assignment ma"
    sql += " WHERE ma.sIdx in (?))";
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

exports.setMemberData = async function(type, name, id, password, birthDt, phone, position, contract, gender, email,
                                       disability, disability_date, disability_grade, defector, patriot, intern, beneficiary, foreigner, nationality, visa_code, visa_date,
                                       bank, accountNo, inDate, outDate, outReason, addr, bigo){
    let sql = "insert into new_tb_member (type, name, id, password, birthDt, phone, position, contract, gender, email,"
    sql += " disability, disability_date, disability_grade, defector, patriot, intern, beneficiary, foreigner, nationality, visa_code, visa_date,"
    sql += " bank, accountNo, inDate, outDate, outReason, addr, bigo)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    sql += " ON DUPLICATE KEY UPDATE name=?, birthDt=?, phone=?, position=?, gender=?,email=?,"
    sql += " disability=?, disability_date=?, disability_grade=?, defector=?, patriot=?, intern=?, beneficiary=?, foreigner=?, nationality=?, visa_code=?, visa_date=?,"
    sql += " bank=?,accountNo=?,inDate=?,outDate=?,outReason=?,addr=?,bigo=?"
    let aParameter = [type, name, id, password, birthDt, phone, position, contract, gender, email,
        disability, disability_date, disability_grade, defector, patriot, intern, beneficiary, foreigner, nationality, visa_code, visa_date,
        bank, accountNo, inDate, outDate, outReason, addr, bigo,
        name, birthDt, phone, position, gender, email,
        disability, disability_date, disability_grade, defector, patriot, intern, beneficiary, foreigner, nationality, visa_code, visa_date,
        bank, accountNo, inDate, outDate, outReason, addr, bigo
    ];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

/*
exports.setMemberWage = async function (mIdx, sIdx, jsonData){
    let sql = "insert into new_tb_member_wage (mIdx, sIdx, jsonData) values (?, ?, ?)";
    let aParameter = [mIdx, sIdx, jsonData];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
 */

exports.setPayroll = async function (mIdx, sIdx, year, paymentList, deductionList, grossPay, deductions, netPay,total) {
    let sql = "insert into new_tb_member_payroll (mIdx, sIdx, year, payItems, deductionItems, grossPay, deductions, netPay, total)"
    sql += " values (?, ?, ?, ?, ? ,?, ? ,? ,?)"
    sql += " ON DUPLICATE KEY UPDATE year=?,payItems=?, deductionItems=?,grossPay=?, deductions=?, netPay=?,total=?"
    let aParameter = [
        mIdx, sIdx, year, paymentList, deductionList,grossPay, deductions, netPay,total,
        year, paymentList, deductionList,grossPay, deductions, netPay,total
    ];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//직원급여조회
exports.getPayroll = async function () {
    let sql = "select"
    sql += " m.idx,"    //idx
    sql += " m.id," //사번
    sql += " (select name from new_tb_site where ma.sIdx = idx) as siteName,"   //현장명
    sql += " (select idx from new_tb_site where ma.sIdx = idx) as sIdx,"    //현장idx
    sql += " (select itemNm from new_tb_code where m.position = itemCd) as role,"   //직책
    sql += " m.name as staff,"  //성명
    sql += " IFNULL(mp.payItems, JSON_OBJECT()) as payItems,"
    sql += " IFNULL(mp.deductionItems,JSON_OBJECT()) as deductionItems,"
    sql += " mp.grossPay, mp.deductions AS totalDeduction, mp.netPay"
    sql += " from new_tb_member m";
    sql += " left join new_tb_member_payroll mp on m.idx = mp.mIdx";
    sql += " left join new_tb_site s on s.idx = mp.sIdx";
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
exports.getPayroll = async function (mIdx, year) {
    let sql = "SELECT\n" +
        "    m.idx,                -- 직원 고유 번호\n" +
        "    s.name AS siteName,   -- 현장명\n" +
        "    s.idx  AS sIdx,       -- 현장idx\n" +
        "    m.id,                 -- 사번 또는 ID\n" +
        "    m.name AS staff,      -- 성명\n" +
        "    (select itemNm from new_tb_code where itemCd = m.position) AS role,   -- 직책\n" +
        "\n" +
        "    -- 이미 JSON 문자열로 저장된 급여/공제 내역\n" +
        "    p.payItems,\n" +
        "    p.deductionItems,\n" +
        "\n" +
        "    -- (옵션) 총액 확인용\n" +
        "    p.grossPay,\n" +
        "    p.deductions AS totalDeduction,\n" +
        "    p.netPay\n" +
        "\n" +
        "FROM new_tb_member m\n" +
        "-- 1. 직원-현장 연결 테이블 JOIN\n" +
        "INNER JOIN new_tb_member_assignment ma ON m.idx = ma.mIdx\n" +
        "-- 2. 현장 정보 테이블 JOIN\n" +
        "INNER JOIN new_tb_site s ON ma.sIdx = s.idx\n" +
        "-- 3. 급여 테이블 JOIN (특정 연도/월 데이터)\n" +
        "LEFT JOIN new_tb_member_payroll p\n" +
        "    ON m.idx = p.mIdx\n" +
        "#     AND p.year = 2025 -- ★ 검색하려는 연도 (월 컬럼이 없다면 year만, 있다면 추가 필요)\n" +
        "\n" +
        "# WHERE m.status = 0       -- 재직 상태인 직원만 (필요시)\n" +
        "ORDER BY s.name, m.name";
    let aParameter = [mIdx, year];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

 */

//직원 급여 내역 조회
exports.getPayrollMonth = async function () {
    let sql = "select * from new_tb_member_payroll_month";
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

//직원 연차 조회 (리스트)
exports.getMemberLeave = async function (sIdx, year) {
    let sql = "select ml.*, m.inDate, m.name, (select itemNm from new_tb_code c where c.itemCd = m.position) as `position`"
    sql += " from new_tb_member_annual_leave ml"
    sql += " left join new_tb_member m on m.idx = ml.mIdx"
    sql += " where ml.sIdx in (?) and ml.year in (?)"
    let aParameter = [sIdx, year];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//직원 연차 저장
exports.setMemberLeave = async function (mIdx, year, personalNo, middle_date, basis_cost, count, over_count, used_count, amount, bigo) {
    let sql = "insert into new_tb_member_annual_leave (mIdx, year, personalNo, middle_date, basis_cost, count, over_count, used_count, amount, bigo)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [mIdx, year, personalNo, middle_date, basis_cost, count, over_count, used_count, amount, bigo];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//직원 현장 배치
exports.setMemberStaffing = async function (mIdx, sIdx) {
    let sql = "insert into new_tb_member_assignment (mIdx, sIdx) values (?, ?)"
    sql += " ON DUPLICATE KEY UPDATE sIdx = ?"
    let aParameter = [mIdx, sIdx, sIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.findByLoginId = async function (loginId) {
    let sql = "select * from new_tb_member where id = ?";
    let aParameter = [loginId];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res[0];
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.loginUser = async function (loginId, password) {
    let sql = "select * from new_tb_member where id = ? and password = ?";
    let aParameter = [loginId, password];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
