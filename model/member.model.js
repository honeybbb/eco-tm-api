const pool = require("../config/mysql");
const mysql = require("mysql2/promise");
const { encryptRRN, decryptRRN, hashPassword} = require("../utils/password");

exports.registerManager = async function (cIdx, managerId, managerNm, password, email, phone, isMaster) {
    let sql = "insert into new_tb_manager (cIdx, managerId, managerNm, password, email, phone, isMaster, regDt)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, NOW())"

    let aParameter = [cIdx, managerId, managerNm, password, email, phone, isMaster];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getManagerList = async function (cIdx) {
    let sql = "select * from new_tb_manager where cIdx = ?"
    let aParameter = [cIdx];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.deleteManager = async function (managerId) {
    let sql = "delete from new_tb_manager where managerId = ?"
    let aParameter = [managerId];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getMemberRRNBatch = async function (mIdxList, adminId, cIdx, clientIp) {
    let sql = "SELECT idx, rrn FROM new_tb_member WHERE idx IN (?) AND cIdx = ?";
    let aParameter = [mIdxList, cIdx];
    try {
        let [res] = await pool.query(sql, aParameter);

        const result = {};
        res.forEach(member => {
            if (!member.rrn) return;
            result[member.idx] = decryptRRN(member.rrn);
        });

        // 로그 일괄 기록
        let logSql = "INSERT INTO new_tb_access_log (type, adminId, cIdx, clientIp, regDt) VALUES ('RRN_VIEW', ?, ?, ?, NOW())";
        let logParams = [adminId, cIdx, clientIp];
        await pool.query(logSql, logParams);

        return result; // { 101: '900101-1234567', 102: '850305-2345678', ... }
    } catch (e) {
        console.log('db err', e);
        return { 'data': '-9999' };
    }
};

const maskRRN = (rrn) => {
    if (!rrn) return null;
    // 하이픈이 있든 없든 처리하기 위해 숫자만 추출하거나 포맷 확인
    const clean = rrn.replace(/[^0-9]/g, '');
    if (clean.length === 13) {
        // 앞 6자리 + 뒤 1자리 + ******
        return `${clean.substring(0, 6)}-${clean.substring(6, 7)}******`;
    }
    return rrn; // 형식이 이상하면 그대로 반환하거나 아예 가림
};

exports.getMemberList = async function (cIdx) {
    let sql = "select m.*, case when status = 0 then '재직' when status = 1 then '퇴사' else '-' end as `status`,"
    // sql += " mc.jsonData as wage,"
    sql += " ms.sIdx, ms.name as `siteName`, mc.contractEndDt as `contract`,"
    sql += " c.itemNm as `type`, c2.itemNm as `position`, c3.option as `badgeColor`, c3.itemNm as `disability_grade`"
    sql += " from new_tb_member m"

    // 직원별로 가장 최근(idx가 제일 큰) 계약서 딱 1건만 찾아내서 조인
    sql += " left join ("
    sql += "   select c1.* from new_tb_member_contract c1"
    sql += "   inner join ("
    sql += "     select mIdx, max(idx) as max_idx from new_tb_member_contract group by mIdx"
    sql += "   ) c2 on c1.idx = c2.max_idx"
    sql += " ) mc on mc.mIdx = m.idx"

    sql += " left join (select b.*, s.name from new_tb_member_assignment b left join new_tb_site s on s.idx = b.sIdx) as `ms` on ms.mIdx = m.idx"

    // ★ 수정된 부분: AND c.cIdx = m.cIdx 조건을 모두 추가하여 내 회사의 코드만 1:1로 매칭시킴
    sql += " left join new_tb_code c on c.itemCd = m.type and c.cIdx = m.cIdx"
    sql += " left join new_tb_code c2 on c2.itemCd = m.position and c2.cIdx = m.cIdx"
    sql += " left join new_tb_code c3 on c3.itemCd = m.disability_grade and c3.cIdx = m.cIdx"

    sql += " where m.cIdx in (?)"
    sql += " order by ms.sIdx desc, m.idx"

    let aParameter = [cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);

        const processedRes = res.map(member => {
            if (member.rrn) {
                try {
                    // 1. 일단 복호화
                    const decrypted = decryptRRN(member.rrn);
                    // 2. ★ 중요: 복호화된 원본 대신 마스킹된 값을 전달
                    member.rrn = maskRRN(decrypted);
                } catch (err) {
                    member.rrn = "복호화 오류";
                }
            }
            return member;
        });

        return processedRes;
        // return res;
    } catch (e) {
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
    let sql = `
        SELECT 
            m.*,
            (SELECT itemNm FROM new_tb_code WHERE itemCd = m.disability_grade LIMIT 1) AS disability_grade,
            IFNULL(ms.sIdx, '0') AS \`sIdx\`,
            s.payment_day,
            cd.itemCd AS \`positionCd\`,
            cd.itemNm AS \`positionName\`,
            cd2.itemNm AS \`type\`,
            cd2.itemCd AS \`typeCd\`,
            CONCAT('[',
                GROUP_CONCAT(DISTINCT
                    CASE WHEN ms.mIdx IS NOT NULL THEN
                        JSON_OBJECT('name', s.name, 'address', s.address)
                    END
                ), ']') AS \`sites\`,
            CONCAT('[',
                GROUP_CONCAT(DISTINCT
                    CASE WHEN mc.idx IS NOT NULL THEN
                        JSON_OBJECT(
                            'contractData', mc.jsonData,
                            'contractStartDt', mc.contractStartDt,
                            'contractEndDt', mc.contractEndDt,
                            'monthWorkTime', mc.month_work_time,
                            'dayWorkTime', mc.day_work_time
                        )
                    END
                ), ']') AS \`contract\`
        FROM new_tb_member m
        LEFT JOIN new_tb_code cd ON cd.itemCd = m.position
        LEFT JOIN new_tb_code cd2 ON cd2.itemCd = m.type
        LEFT JOIN new_tb_member_assignment ms ON m.idx = ms.mIdx
        LEFT JOIN new_tb_site s ON s.idx = ms.sIdx
        LEFT JOIN (
            SELECT mIdx, MAX(idx) AS max_idx
            FROM new_tb_member_contract
            GROUP BY mIdx
        ) LatestC ON m.idx = LatestC.mIdx
        LEFT JOIN new_tb_member_contract mc ON mc.idx = LatestC.max_idx
        WHERE m.id = ?
        GROUP BY m.idx
    `;

    let aParameter = [id];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'};
    }
};

exports.getStaffBySite = async function(sIdx, cIdx) {
    let sql = `
        SELECT m.idx, m.name, m.id AS memberId
        FROM new_tb_member m
                 INNER JOIN new_tb_member_assignment ma ON ma.mIdx = m.idx
                 INNER JOIN (
            SELECT mIdx, MAX(idx) AS maxIdx
            FROM new_tb_member_assignment
            WHERE sIdx = ?
            GROUP BY mIdx
        ) latest ON latest.mIdx = ma.mIdx AND latest.maxIdx = ma.idx
        WHERE m.cIdx = ?
        ORDER BY m.name ASC
    `;

    let aParameter = [sIdx, cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};

exports.getMemberAvailable = async function(sIdx, cIdx) {
    // 1. role 서브쿼리에 cIdx = m.cIdx 조건과 안전장치(LIMIT 1) 추가
    let sql = "SELECT m.*, ";
    sql += " (SELECT itemNm FROM new_tb_code WHERE itemCd = m.position AND cIdx = m.cIdx LIMIT 1) AS role";
    sql += " FROM new_tb_member m";

    // 2. 전체 직원이 아닌 '내 회사(cIdx)' 소속이면서 '재직 중(status=0)'인 사람만 필터링
    sql += " WHERE m.cIdx = ? AND m.status = 0";

    // 3. 해당 현장(sIdx)에 이미 배치된 직원은 제외 (NOT IN)
    sql += " AND m.idx NOT IN (";
    sql += "   SELECT ma.mIdx FROM new_tb_member_assignment ma WHERE ma.sIdx = ?";
    sql += " )";

    let aParameter = [cIdx, sIdx]; // 맵핑: cIdx, sIdx 순서

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setMemberData = async function(type, name, id, password, birthDt, phone, position, contract, gender, email,
                                       disability, disability_date, disability_grade, defector, patriot, intern, beneficiary, foreigner, nationality, visa_code, visa_date,
                                       bank, accountNumber, inDate, outDate, outReason, address, bigo){
    let sql = "insert into new_tb_member (type, name, id, password, birthDt, phone, position, contract, gender, email,"
    sql += " disability, disability_date, disability_grade, defector, patriot, intern, beneficiary, foreigner, nationality, visa_code, visa_date,"
    sql += " bank, accountNumber, inDate, outDate, outReason, address, bigo)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    sql += " ON DUPLICATE KEY UPDATE name=?, birthDt=?, phone=?, position=?, gender=?,email=?,"
    sql += " disability=?, disability_date=?, disability_grade=?, defector=?, patriot=?, intern=?, beneficiary=?, foreigner=?, nationality=?, visa_code=?, visa_date=?,"
    sql += " bank=?,accountNumber=?,inDate=?,outDate=?,outReason=?,addr=?,bigo=?"
    let aParameter = [type, name, id, password, birthDt, phone, position, contract, gender, email,
        disability, disability_date, disability_grade, defector, patriot, intern, beneficiary, foreigner, nationality, visa_code, visa_date,
        bank, accountNumber, inDate, outDate, outReason, address, bigo,
        name, birthDt, phone, position, gender, email,
        disability, disability_date, disability_grade, defector, patriot, intern, beneficiary, foreigner, nationality, visa_code, visa_date,
        bank, accountNumber, inDate, outDate, outReason, address, bigo
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
exports.getMemberLeave = async function (cIdx, year) {
    /*
    let sql = "select ml.*, m.inDate, m.name,"
    sql += " (select itemNm from new_tb_code c where c.itemCd = m.position) as `position`"
    sql += " from new_tb_member m"
    sql += " left join new_tb_member_annual_leave ml on m.idx = ml.mIdx"
    sql += " where ml.sIdx in (?) and ml.year in (?)"
    let aParameter = [sIdx, year];

     */
    let sql = `
        select 
            mal.idx as \`quotaIdx\`,
            m.inDate,
            m.type as \`mType\`,
            m.idx as \`mIdx\`,
            m.name,
            m.position,
            (select itemNm from new_tb_code c where c.itemCd = m.position) as \`role\`,
            mal.totalCount,
            mal.usedCount,
            mal.overCount,
            mal.payCount,
            mal.middleDt,
            ma.sIdx, 
            (select name from new_tb_site where idx = ma.sIdx) as \`siteName\`
        from new_tb_member m
            left join new_tb_member_annual_leave mal on mal.mIdx = m.idx
            left join new_tb_member_assignment ma on ma.mIdx = m.idx
        where m.cIdx in (?)
        `
    let aParameter = [cIdx, year];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//직원 연차 저장
exports.setMemberLeave = async function (mIdx, sIdx, name, type, year, middleDt, count, over_count, used_count, bigo, regDt) {
    let sql = "insert into new_tb_member_annual_leave (mIdx, sIdx, mName, mType, year, middleDt, totalCount, overCount, usedCount, bigo, regDt)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [mIdx, sIdx, name, type, year, middleDt, count, over_count, used_count, bigo, regDt];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.updateMemberLeave = async function (mIdx, year, totalCount, overCount, usedCount, bigo, modDt){
    let sql = "update new_tb_member_annual_leave set totalCount=?,overCount=?,usedCount=?,bigo=?,modDt=? where mIdx in (?) and year (?)"
    let aParameter = [totalCount, overCount, usedCount, bigo, modDt, mIdx, year];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setAnnualSettlement = async function (mIdx, sIdx, payCount, settleDt, bigo, amount, regDt) {
    let sql = "insert into new_tb_member_settlement (mIdx, sIdx, payCount, settleDt, bigo, amount, regDt)"
    sql += " values (?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [mIdx, sIdx, payCount, settleDt, bigo, amount, regDt];

    try {
        let [res] = await pool.query(sql, aParameter);
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
    let sql = "select mo.idx, m.name as `staff`, mo.sIdx,"
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

// 특정 연차 신청 정보 상세 조회
exports.getMemberOffDetail = async function (idx) {
    let sql = "SELECT mIdx, sIdx, startDt, endDt FROM new_tb_member_off WHERE idx = ?";
    let aParameter = [idx];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res[0]; // 데이터 한 건 반환
    } catch (e) {
        console.log('db err', e);
        return null;
    }
};

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
exports.updateMemberStaffing = async function (idx) {
    console.log(idx, 'remove1')
    //let sql = "delete from new_tb_member_assignment WHERE idx = ?";
    let sql = "update new_tb_member_assignment set isActive = 'N' where idx in (?)"
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
         bank, accountNumber, inDate, outDate, outReason, address, bigo, guarantee, retire_pension, four_ins)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    let aParameter = [
        member.type, member.name, member.id, member.password, member.birthDt, member.phone, member.position, member.gender, member.email,
        member.disability, member.disability_date, member.disability_grade, member.disability_bigo, member.defector, member.patriot, member.intern, member.beneficiary, member.foreigner, member.nationality, member.visa_code, member.visa_date,
        member.bank, member.accountNumber, member.inDate, member.outDate, member.outReason, member.address, member.bigo, member.guarantee, member.retire_pension, member.four_ins
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
            (cIdx, type, name, id, password, birthDt, rrn, phone, position, gender, email,
             disability, disability_date, disability_grade, defector, patriot, intern, beneficiary,
             foreigner, nationality, visa_code, visa_date,
             etc_name_1, etc_value_1, etc_name_2, etc_value_2, etc_name_3, etc_value_3,
             bank, accountNumber, inDate, outDate, outReason, address, bigo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?)
        `;

        let paramMember = [
            member.cIdx, member.type, member.name, member.id, member.password, member.birthDt, member.rrn,
            member.phone, member.position, member.gender, member.email,
            member.disability, member.disability_date, member.disability_grade, member.defector, member.patriot, member.intern,
            member.beneficiary, member.foreigner, member.nationality, member.visa_code, member.visa_date,
            member.etc_name_1, member.etc_value_1,
            member.etc_name_2, member.etc_value_2,
            member.etc_name_3, member.etc_value_3,
            member.bank, member.accountNumber, member.inDate, member.outDate, member.outReason, member.address, member.bigo
        ];

        let resMember = await connection.query(sqlMember, paramMember);
        let new_mIdx = resMember[0].insertId; // 생성된 직원 PK (mIdx) 가져오기

        // -----------------------------------------------------
        // 2. 계약서(Contract) 등록
        // -----------------------------------------------------
        // contract 데이터에 위에서 만든 new_mIdx를 사용합니다.
        let sqlContract = `
            INSERT INTO new_tb_member_contract 
            (mIdx, sIdx, type, jsonData, contractStartDt, contractEndDt, bigo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        let paramContract = [
            new_mIdx,
            contract.sIdx,
            contract.type,
            contract.jsonData, // JSON 문자열 상태
            contract.contractStartDt,
            contract.contractEndDt,
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

exports.updateMemberWithContractAndStaffing = async function (mIdx, member, contract, staffing) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let sqlMember, paramMember;
        const commonFields = `
            type = ?, name = ?, id = ?, birthDt = ?, phone = ?, position = ?, 
            gender = ?, email = ?, disability = ?, disability_date = ?, 
            disability_grade = ?, defector = ?, patriot = ?, intern = ?, 
            beneficiary = ?, foreigner = ?, nationality = ?, visa_code = ?, 
            visa_date = ?, bank = ?, accountNumber = ?, inDate = ?, 
            outDate = ?, outReason = ?, address = ?, bigo = ?, status = ?,
            four_ins = ?, retire_pension = ?
        `;

        if (member.password) {
            sqlMember = `UPDATE new_tb_member SET ${commonFields}, password = ? WHERE idx = ?`;
            paramMember = [
                member.type, member.name, member.id, member.birthDt, member.phone, member.position,
                member.gender, member.email, member.disability, member.disability_date,
                member.disability_grade, member.defector, member.patriot, member.intern,
                member.beneficiary, member.foreigner, member.nationality, member.visa_code,
                member.visa_date, member.bank, member.accountNumber, member.inDate,
                member.outDate, member.outReason, member.addr, member.bigo, member.status,
                member.fourInsurance, member.retirePension, member.password, mIdx
            ];
        } else {
            sqlMember = `UPDATE new_tb_member SET ${commonFields} WHERE idx = ?`;
            paramMember = [
                member.type, member.name, member.id, member.birthDt, member.phone, member.position,
                member.gender, member.email, member.disability, member.disability_date,
                member.disability_grade, member.defector, member.patriot, member.intern,
                member.beneficiary, member.foreigner, member.nationality, member.visa_code,
                member.visa_date, member.bank, member.accountNumber, member.inDate,
                member.outDate, member.outReason, member.addr, member.bigo, member.status,
                member.fourInsurance, member.retirePension, mIdx
            ];
        }
        await connection.query(sqlMember, paramMember);

        // ... (나머지 계약/배치 업데이트 코드는 기존과 동일하게 유지)

        // 2. Contract 업데이트
        const sqlContractCheck = `SELECT idx FROM new_tb_member_contract WHERE mIdx = ? ORDER BY idx DESC LIMIT 1`;
        const [contractRows] = await connection.query(sqlContractCheck, [mIdx]);

        if (contractRows.length > 0) {
            const sqlContract = `
                UPDATE new_tb_member_contract SET
                    sIdx = ?, type = ?, jsonData = ?,
                    contractStartDt = ?, contractEndDt = ?, bigo = ?
                WHERE idx = ?
            `;
            await connection.query(sqlContract, [
                contract.sIdx, contract.type, contract.jsonData,
                contract.startDt, contract.endDt, contract.bigo, contractRows[0].idx
            ]);
        } else {
            const sqlContract = `
                INSERT INTO new_tb_member_contract
                    (mIdx, sIdx, type, jsonData, contractStartDt, contractEndDt, bigo)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            await connection.query(sqlContract, [
                mIdx, contract.sIdx, contract.type, contract.jsonData,
                contract.startDt, contract.endDt, contract.bigo
            ]);
        }

        // 3. Staffing 업데이트
        const sqlStaffing = `
            INSERT INTO new_tb_member_assignment (mIdx, sIdx)
            VALUES (?, ?)
                ON DUPLICATE KEY UPDATE sIdx = VALUES(sIdx)
        `;
        await connection.query(sqlStaffing, [mIdx, staffing.sIdx]);

        await connection.commit();
        return { result: true };
    } catch (e) {
        await connection.rollback();
        console.error("DB 업데이트 에러:", e); // 에러 확인용
        return { result: false, error: e };
    } finally {
        connection.release();
    }
};

exports.deleteMember = async function (mId) {
    let sql = "delete from new_tb_member where id = ?"
    let aParameter = [mId];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
