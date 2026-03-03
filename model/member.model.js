const pool = require("../config/mysql");
const mysql = require("mysql2/promise");

exports.getMemberList = async function () {
    let sql = "select m.*, case when status = 0 then '재직' when status = 1 then '퇴사' else '-' end as `status`,"
    // sql += " mc.jsonData as wage,"
    sql += " ms.sIdx, ms.name as `siteName`,"
    sql += " c.itemNm as `type`, c2.itemNm as `position`, c3.option `badgeColor`, c3.itemNm as `disability_grade`"
    sql += " from new_tb_member m"
    sql += " left join new_tb_member_contract mc on mc.mIdx = m.idx"
    sql += " left join (select b.*, s.name from new_tb_member_assignment b left join new_tb_site s on s.idx = b.sIdx) as `ms` on ms.mIdx = m.idx"
    sql += " left join new_tb_code c on c.itemCd = m.type left join new_tb_code c2 on c2.itemCd = m.position";
    sql += " left join new_tb_code c3 on c3.itemCd = m.disability_grade"
    sql += " order by ms.sIdx desc, m.idx"
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

exports.getMemberIdxMap = async function (ids) {
    let sql = "SELECT id, idx FROM new_tb_member WHERE id IN (?)";
    try {
        let [res] = await pool.query(sql, [ids]);

        return res.reduce((acc, cur) => {
            acc[cur.id] = cur.idx;
            return acc;
        }, {});
    } catch (e) {
        console.log('mapping err', e);
        return {};
    }
}

exports.getMemberData = async function (id) {
    let sql = "SELECT m.*, IFNULL(ms.sIdx, '0') AS `sIdx`,s.payment_day,"
    sql += " cd.itemCd AS `positionCd`, cd.itemNm AS `position`,"
    sql += " cd2.itemNm AS `type`,"
    sql += " CONCAT('[',"
    sql += " GROUP_CONCAT(DISTINCT"
    sql += "   CASE WHEN ms.mIdx IS NOT NULL THEN"
    sql += "     JSON_OBJECT('name', s.name, 'address', s.address)"
    sql += "   END"
    sql += " ),']') AS `sites`,"
    sql += " CONCAT('[',"
    sql += " GROUP_CONCAT(DISTINCT"
    sql += "   CASE WHEN mc.idx IS NOT NULL THEN"
    sql += "     JSON_OBJECT("
    sql += "       'contractData', mc.jsonData,"
    sql += "       'startDt', mc.startDt,"
    sql += "       'endDt', mc.endDt,"
    sql += "       'monthWorkTime', mc.month_work_time,"
    sql += "       'dayWorkTime', mc.day_work_time"
    sql += "     )"
    sql += "   END"
    sql += " ),']') AS `contract`"
    sql += " FROM new_tb_member m"
    sql += " INNER JOIN new_tb_code cd ON cd.itemCd = m.position"
    sql += " INNER JOIN new_tb_code cd2 ON cd2.itemCd = m.type"
    sql += " LEFT JOIN new_tb_member_assignment ms ON m.idx = ms.mIdx"
    sql += " LEFT JOIN new_tb_site s ON s.idx = ms.sIdx"
    sql += " LEFT JOIN ("
    sql += "   SELECT mIdx, MAX(idx) AS max_idx"
    sql += "   FROM new_tb_member_contract"
    sql += "   GROUP BY mIdx"
    sql += " ) LatestC ON m.idx = LatestC.mIdx"
    sql += " LEFT JOIN new_tb_member_contract mc"
    sql += "   ON mc.idx = LatestC.max_idx"
    sql += " WHERE m.id = ?"
    sql += " GROUP BY m.idx";
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
    let sql = "SELECT *, (select itemNm from new_tb_code where m.position = itemCd) as `role` FROM new_tb_member m WHERE m.idx NOT IN"
    sql += " (SELECT ma.mIdx"
    sql += " FROM new_tb_member_assignment ma"
    sql += " WHERE ma.sIdx in (?)) and m.status = 0"; //m.stauts 0 : 재직 / 1: 퇴사
    let aParameter = [sIdx];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
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


/*
exports.getPayroll1 = async function () {
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
    sql += " group by m.idx limit 1"
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

 */
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

//직원 연차 조회 (리스트)
exports.getMemberLeave = async function (sIdx, year) {
    let sql = "select ml.*, m.inDate, m.name,"
    sql += " (select itemNm from new_tb_code c where c.itemCd = m.position) as `position`"
    sql += " from new_tb_member m"
    sql += " left join new_tb_member_annual_leave m; on m.idx = ml.mIdx"
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

//직원 연차 신청
exports.setMemberOff = async function (mIdx, sIdx, startDt, endDt, reason) {
    let sql = "insert into new_tb_member_off (mIdx, sIdx, startDt, endDt, reason)"
    sql += " values (?, ?, ?, ?, ?)"
    let aParameter = [mIdx, sIdx, startDt, endDt, reason];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getMemberOff = async function (cIdx, startDt, endDt) {
    let sql = "select mo.idx, m.name as `staff`,"
    sql += " DATE_FORMAT(mo.regDt, '%Y-%m-%d') AS reqDate,"
    sql += " mo.startDt, mo.endDt, DATEDIFF(endDt, startDt) + 1 as `days`,"
    sql += " (select name from new_tb_site where idx = mo.sIdx) as  `site`,"
    sql += " mo.reason, mo.status"
    sql += " from new_tb_member_off mo"
    sql += " inner join new_tb_member m on m.idx = mo.mIdx"
    sql += " where mo.cIdx in (?)"
    sql += " and DATE(mo.regDt) between (?) and (?)"
    let aParameter = [cIdx, startDt, endDt];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.updateOffStatus = async function (idx, status) {
    let sql = "update new_tb_member_off set status = (?) where idx = ?"
    let aParameter = [status, idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//직원 연차 등록(관리자)
exports.setMemberOffForce = async function (mIdx, sIdx, startDt, endDt, reason) {
    let sql = "insert into new_tb_member_off (mIdx, sIdx, startDt, endDt, reason, status)"
    sql += " values (?, ?, ?, ?, ?, '1')" //자동등록
    let aParameter = [mIdx, sIdx, startDt, endDt, reason];

    try {
        let [res] = await pool.query(sql, aParameter);
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

//직원 배치 해제
exports.removeMemberStaffing = async function (idx) {
    let sql = "delete from new_tb_member_assignment WHERE idx = ?";
    let aParameter = [idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.insertMember = async function (member) {
    let sql = `
        INSERT INTO new_tb_member 
        (type, name, id, password, birthDt, phone, position, gender, email,
         disability, disability_date, disability_grade, disability_bigo, defector, patriot, intern, beneficiary, foreigner, nationality, visa_code, visa_date,
         bank, accountNo, inDate, outDate, outReason, addr, bigo, guarantee, retire_pension, four_ins)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    let aParameter = [
        member.type, member.name, member.id, member.password, member.birthDt, member.phone, member.position, member.gender, member.email,
        member.disability, member.disability_date, member.disability_grade, member.disability_bigo, member.defector, member.patriot, member.intern, member.beneficiary, member.foreigner, member.nationality, member.visa_code, member.visa_date,
        member.bank, member.accountNo, member.inDate, member.outDate, member.outReason, member.addr, member.bigo, member.guarantee, member.retire_pension, member.four_ins
    ];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res.insertId;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};

exports.insertContract = async function (contract) {
    let sql = `
        INSERT INTO new_tb_member_contract 
        (mIdx, sIdx, type, jsonData, startDt, endDt, bigo)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    let aParameter = [contract.mIdx, contract.sIdx, contract.type, contract.jsonData, contract.startDt, contract.endDt, contract.bigo];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};

exports.insertAssignment = async function (staffing) {
    let sql = `
        INSERT INTO new_tb_member_assignment (mIdx, sIdx) 
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE sIdx = VALUES(sIdx)
    `;
    let aParameter = [staffing.mIdx, staffing.sIdx];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};

exports.registerMemberWithContractAndStaffing = async function (member, contract, staffing) {
    const connection = await pool.getConnection(); // 커넥션 가져오기

    try {
        await connection.beginTransaction(); // 트랜잭션 시작

        // -----------------------------------------------------
        // 1. 직원(Member) 등록
        // -----------------------------------------------------
        let sqlMember = `
            INSERT INTO new_tb_member 
            (type, name, id, password, birthDt, phone, position, gender, email,
             disability, disability_date, disability_grade, defector, patriot, intern, beneficiary, foreigner, nationality, visa_code, visa_date,
             bank, accountNo, inDate, outDate, outReason, addr, bigo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        let paramMember = [
            member.type, member.name, member.id, member.password, member.birthDt, member.phone, member.position, member.gender, member.email,
            member.disability, member.disability_date, member.disability_grade, member.defector, member.patriot, member.intern, member.beneficiary, member.foreigner, member.nationality, member.visa_code, member.visa_date,
            member.bank, member.accountNo, member.inDate, member.outDate, member.outReason, member.addr, member.bigo
        ];

        let resMember = await connection.query(sqlMember, paramMember);
        let new_mIdx = resMember[0].insertId; // 생성된 직원 PK (mIdx) 가져오기

        // -----------------------------------------------------
        // 2. 계약서(Contract) 등록
        // -----------------------------------------------------
        // contract 데이터에 위에서 만든 new_mIdx를 사용합니다.
        let sqlContract = `
            INSERT INTO new_tb_member_contract 
            (mIdx, sIdx, type, jsonData, startDt, endDt, bigo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        let paramContract = [
            new_mIdx,
            contract.sIdx,
            contract.type,
            contract.jsonData, // JSON 문자열 상태
            contract.startDt,
            contract.endDt,
            contract.bigo
        ];

        await connection.query(sqlContract, paramContract);

        // -----------------------------------------------------
        // 3. 직원 배치(Staffing/Assignment) 등록
        // -----------------------------------------------------
        let sqlStaffing = `
            INSERT INTO new_tb_member_assignment (mIdx, sIdx) 
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE sIdx = VALUES(sIdx)
        `;
        let paramStaffing = [new_mIdx, staffing.sIdx];

        await connection.query(sqlStaffing, paramStaffing);

        // 모든 쿼리가 성공하면 커밋
        await connection.commit();

        return { result: true, mIdx: new_mIdx };

    } catch (e) {
        // 에러 발생 시 롤백 (등록된 직원 정보도 취소됨)
        await connection.rollback();
        console.log('Transaction Error:', e);
        return { result: false, error: e };

    } finally {
        connection.release(); // 커넥션 반납
    }
}
