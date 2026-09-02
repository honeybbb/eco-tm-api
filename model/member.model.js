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
    let sql = "select m.*, c2.sort,"
    // sql += " case when status = 0 then '재직' when status = 1 then '퇴사' else '-' end as `status`,"
    // sql += " mc.jsonData as wage,"
    //sql += " ms.sIdx, ms.name as `siteName`,"
    sql += " IF(m.hq = 'Y', 0, ms.sIdx) as sIdx,"
    sql += " IF(m.hq = 'Y', '본사', IFNULL(ms.name, '미배정(대기)')) as `siteName`,"
    sql += " ms.payment_day, mc.contractEndDt as `contract`,"
    sql += " c.itemNm as `type`, c2.itemNm as `position`, c3.option as `badgeColor`, c3.itemNm as `disability_grade`"
    sql += " from new_tb_member m"

    // 직원별로 가장 최근(idx가 제일 큰) 계약서 딱 1건만 찾아내서 조인
    sql += " left join ("
    sql += "   select c1.* from new_tb_member_contract c1"
    sql += "   inner join ("
    sql += "     select mIdx, max(idx) as max_idx from new_tb_member_contract group by mIdx"
    sql += "   ) c2 on c1.idx = c2.max_idx"
    sql += " ) mc on mc.mIdx = m.idx"

    // 직원별로 가장 최근(idx가 제일 큰) 배정 내역 딱 1건만 찾아내서 조인
    sql += " left join ("
    sql += "    select a1.*, s.name, s.payment_day from new_tb_member_assignment a1"
    sql += "    inner join ("
    sql += "      select mIdx, max(idx) as max_idx from new_tb_member_assignment group by mIdx"
    sql += "    ) a2 on a1.idx = a2.max_idx"
    sql += "    left join new_tb_site s on s.idx = a1.sIdx"
    sql += " ) as `ms` on ms.mIdx = m.idx"

    // AND c.cIdx = m.cIdx 조건을 모두 추가하여 내 회사의 코드만 1:1로 매칭시킴
    sql += " left join new_tb_code c on c.itemCd = m.type and c.cIdx = m.cIdx"
    sql += " left join new_tb_code c2 on c2.itemCd = m.position and c2.cIdx = m.cIdx"
    sql += " left join new_tb_code c3 on c3.itemCd = m.disability_grade and c3.cIdx = m.cIdx"

    sql += " where m.cIdx in (?) and m.deleteFl = 'N'"
    // sql += " order by ms.sIdx desc, m.idx"
    sql += " order by ms.sIdx desc, c.itemCd, c2.sort, m.idx"

    let aParameter = [cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);

        const processedRes = res.map(member => {
            if (member.rrn) {
                try {
                    // 1. 일단 복호화
                    const decrypted = decryptRRN(member.rrn);
                    // 2. 복호화된 원본 대신 마스킹된 값을 전달
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

exports.getMemberData = async function (id, cIdx) {
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
            cd3.itemCd AS \`disabilityCd\`,
            
            -- 현장 정보
            CONCAT('[',
                GROUP_CONCAT(DISTINCT
                    CASE WHEN ms.mIdx IS NOT NULL THEN
                        JSON_OBJECT('name', s.name, 'address', s.address)
                    END
                ), ']') AS \`sites\`,
                
            -- 계약 정보
            CONCAT('[',
                GROUP_CONCAT(DISTINCT
                    CASE WHEN mc.idx IS NOT NULL THEN
                        JSON_OBJECT(
                            'payItems', mc.payItems,
                            'deductionItems', mc.deductionItems,
                            'contractStartDt', mc.contractStartDt,
                            'contractEndDt', mc.contractEndDt,
                            'workSchedule', mc.workSchedule,
                            'monthWorkTime', mc.month_work_time,
                            'dayWorkTime', mc.day_work_time
                        )
                    END
                ), ']') AS \`contract\`,
                
            -- 특이사항(비고) 누적 히스토리
            CONCAT('[',
                GROUP_CONCAT(DISTINCT
                    CASE WHEN mb.idx IS NOT NULL THEN
                        JSON_OBJECT(
                            'bgIdx', mb.idx,
                            'type', mb.type,
                            'bigo', mb.bigo,
                            'regDt', DATE_FORMAT(mb.regDt, '%Y-%m-%d %H:%i:%s'),
                            'admin_id', IFNULL(mb.admin_id, '')
                        )
                    END
                ), ']') AS \`bigoList\`,
                
            -- 입사/퇴사/휴직/일용/대근 누적 히스토리
            CONCAT('[',
                GROUP_CONCAT(DISTINCT
                    CASE WHEN mh.idx IS NOT NULL THEN
                        JSON_OBJECT(
                            'hIdx', mh.idx,
                            'status', mh.historyStatus,
                            'startDate', IFNULL(DATE_FORMAT(mh.startDate, '%Y-%m-%d'), ''),
                            'endDate', IFNULL(DATE_FORMAT(mh.endDate, '%Y-%m-%d'), ''),
                            'outReason', IFNULL(mh.outReason, '')
                        )
                    END
                ), ']') AS \`historyList\`

        FROM new_tb_member m
            LEFT JOIN new_tb_code cd ON cd.itemCd = m.position
            LEFT JOIN new_tb_code cd2 ON cd2.itemCd = m.type
            LEFT JOIN new_tb_code cd3 ON cd3.itemCd = m.disability_grade
            LEFT JOIN new_tb_member_assignment ms ON m.idx = ms.mIdx
            LEFT JOIN new_tb_site s ON s.idx = ms.sIdx
            LEFT JOIN (
            SELECT mIdx, MAX(idx) AS max_idx
            FROM new_tb_member_contract
            GROUP BY mIdx
            ) LatestC ON m.idx = LatestC.mIdx
            LEFT JOIN new_tb_member_contract mc ON mc.idx = LatestC.max_idx
            LEFT JOIN new_tb_member_bigo mb ON m.idx = mb.mIdx
            LEFT JOIN new_tb_member_history mh ON m.idx = mh.mIdx AND mh.useFl = 'Y'

        WHERE m.id = ? and cd.cIdx = ? and m.cIdx = ?
        GROUP BY m.idx
    `;

    let aParameter = [id, cIdx, cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'};
    }
};

exports.getMemberData_v2 = async function (id, cIdx) {
    // JSON 문자열 잘림 방지용 세션 변수 설정
    await pool.query(`SET SESSION group_concat_max_len = 100000;`);

    let sql = `
        SELECT
            m.*,
            (SELECT itemNm FROM new_tb_code WHERE itemCd = m.disability_grade AND cIdx = ? LIMIT 1) AS disability_grade,
            
            -- 루트 레벨 sIdx 추가 (배정 내역이 여러 개일 경우 가장 최신(idx 역순) 값을 가져옴)
            IFNULL((
                SELECT sIdx 
                FROM new_tb_member_assignment 
                WHERE mIdx = m.idx 
                ORDER BY idx DESC 
                LIMIT 1
            ), '0') AS \`sIdx\`,
            
            cd.itemCd AS \`positionCd\`,
            cd.itemNm AS \`positionName\`,
            cd2.itemNm AS \`type\`,
            cd2.itemCd AS \`typeCd\`,
            cd3.itemCd AS \`disabilityCd\`,
            
            -- 현장 정보 (내부 객체에도 sIdx를 포함시켜주면 활용하기 좋습니다)
            (
                SELECT CONCAT('[', IFNULL(GROUP_CONCAT(
                    JSON_OBJECT('sIdx', s.idx, 'name', s.name, 'address', s.address)
                ), ''), ']')
                FROM new_tb_member_assignment ms
                JOIN new_tb_site s ON s.idx = ms.sIdx
                WHERE ms.mIdx = m.idx
            ) AS \`sites\`,
                
            -- 계약 정보
            (
                SELECT CONCAT('[', IFNULL(GROUP_CONCAT(
                    JSON_OBJECT(
                        'payItems', mc.payItems,
                        'deductionItems', mc.deductionItems,
                        'contractStartDt', mc.contractStartDt,
                        'contractEndDt', mc.contractEndDt,
                        'workSchedule', mc.workSchedule,
                        'monthWorkTime', mc.month_work_time,
                        'dayWorkTime', mc.day_work_time
                    )
                ), ''), ']')
                FROM new_tb_member_contract mc
                WHERE mc.mIdx = m.idx
                  AND mc.idx = (SELECT MAX(idx) FROM new_tb_member_contract WHERE mIdx = m.idx)
            ) AS \`contract\`,
                
            -- 특이사항 누적 히스토리
            (
                SELECT CONCAT('[', IFNULL(GROUP_CONCAT(
                    JSON_OBJECT(
                        'bgIdx', mb.idx,
                        'type', mb.type,
                        'bigo', mb.bigo,
                        'regDt', DATE_FORMAT(mb.regDt, '%Y-%m-%d %H:%i:%s'),
                        'admin_id', IFNULL(mb.admin_id, '')
                    )
                ), ''), ']')
                FROM new_tb_member_bigo mb
                WHERE mb.mIdx = m.idx
            ) AS \`bigoList\`,
                
            -- 히스토리
            (
                SELECT CONCAT('[', IFNULL(GROUP_CONCAT(
                    JSON_OBJECT(
                        'hIdx', mh.idx,
                        'status', mh.historyStatus,
                        'startDate', IFNULL(DATE_FORMAT(mh.startDate, '%Y-%m-%d'), ''),
                        'endDate', IFNULL(DATE_FORMAT(mh.endDate, '%Y-%m-%d'), ''),
                        'outReason', IFNULL(mh.outReason, '')
                    )
                ), ''), ']')
                FROM new_tb_member_history mh
                WHERE mh.mIdx = m.idx AND mh.useFl = 'Y'
            ) AS \`historyList\`

        FROM new_tb_member m
            LEFT JOIN new_tb_code cd ON cd.itemCd = m.position AND cd.cIdx = ?
            LEFT JOIN new_tb_code cd2 ON cd2.itemCd = m.type AND cd2.cIdx = ?
            LEFT JOIN new_tb_code cd3 ON cd3.itemCd = m.disability_grade AND cd3.cIdx = ?

        WHERE m.id = ? AND m.cIdx = ?
    `;

    // 서브쿼리에 들어가는 파라미터까지 총 6개
    let aParameter = [
        cIdx, // 1. 서브쿼리 장애등급 cIdx
        cIdx, // 2. cd (직급) cIdx
        cIdx, // 3. cd2 (유형) cIdx
        cIdx, // 4. cd3 (장애등급) cIdx
        id,   // 5. m.id
        cIdx  // 6. m.cIdx
    ];

    try {
        let [res] = await pool.query(sql, aParameter);

        if (res.length === 0) return null;

        return res;
    } catch (e) {
        console.error('db err', e);
        return {'data': '-9999'}; // 기존 에러 리턴 방식 유지
    }
};

exports.getStaffBySite = async function(sIdx, cIdx) {
    let sql = `
        SELECT m.idx, m.type, m.name, m.id AS memberId, m.position, m.status, m.outDate, m.inDate
        FROM new_tb_member m
                 INNER JOIN new_tb_member_assignment ma ON ma.mIdx = m.idx
                 INNER JOIN (
            SELECT mIdx, MAX(idx) AS maxIdx
            FROM new_tb_member_assignment
            WHERE sIdx = ?
            GROUP BY mIdx
        ) latest ON latest.mIdx = ma.mIdx AND latest.maxIdx = ma.idx
        WHERE m.cIdx = ? and m.status in (0, 1) /*재직과 퇴사만(일용,대근은 X)*/
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

// 최신 계약 기준 현장 직책별 스케줄 전체 조회
exports.getWorkScheduleBySite = async function(sIdx) {
    const query = `
        SELECT wc.position, wc.workhours, wc.breaktime
        FROM new_tb_work_contract wc
        INNER JOIN new_tb_site_contract sc ON sc.idx = wc.ctIdx
        WHERE wc.sIdx = ?
          AND sc.idx = (
              SELECT idx FROM new_tb_site_contract
              WHERE sIdx = ?
                AND startDt <= CURDATE()
                AND endDt >= CURDATE()
              ORDER BY regDt DESC
              LIMIT 1
          )
    `;
    const [rows] = await pool.query(query, [sIdx, sIdx]);
    return rows;
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
exports.getMemberLeave = async function (cIdx) {
    let sql = `
        SELECT
            mal.idx  AS \`quotaIdx\`,
            m.inDate,
            m.type   AS \`mType\`,
            m.idx    AS \`mIdx\`,
            m.name,
            m.position,
            c.itemNm AS \`role\`,
            mal.totalCount,
            mal.usedCount,
            mal.overCount,
            mal.payCount,
--             mal.middleDt,
            mal.year,
            ma.sIdx,
            s.name   AS \`siteName\`
        FROM new_tb_member m

                 -- ★ 핵심: 묶지 않고(GROUP BY 안 함) 모든 연도의 연차 데이터를 그대로 다 조인합니다.
                 LEFT JOIN new_tb_member_annual_leave mal ON mal.mIdx = m.idx

                 LEFT JOIN new_tb_member_assignment ma ON ma.idx = (
            SELECT idx FROM new_tb_member_assignment
            WHERE mIdx = m.idx ORDER BY idx DESC LIMIT 1
            )
            LEFT JOIN new_tb_code c ON c.itemCd = m.position AND c.cIdx = m.cIdx
            LEFT JOIN new_tb_site s ON s.idx = ma.sIdx

        WHERE m.cIdx = ?
        -- AND m.status = 1 (필요하다면 퇴사자 제외)
        ORDER BY s.idx DESC, c.sort ASC, m.idx ASC, mal.year DESC;
    `

    let aParameter = [cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'};
    }
}

//직원 연차 저장
exports.setMemberLeave = async function (mIdx, sIdx, type, year, middleDt, count, over_count, used_count, payCount, bigo, regDt) {
    let sql = "insert into new_tb_member_annual_leave (mIdx, sIdx, mType, year, middleDt, totalCount, overCount, usedCount, payCount, bigo, regDt)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    sql += " ON DUPLICATE KEY UPDATE totalCount=?, overCount=?, usedCount=?, payCount=?, bigo=?, modDt=?"
    let aParameter = [
        mIdx, sIdx, type, year, middleDt, count, over_count, used_count, payCount, bigo, regDt,
        count, over_count, used_count, payCount, bigo, regDt
    ];

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

exports.setAnnualSettlement = async function (mIdx, sIdx, year, payCount, settleDt) {
    // 기존 payCount에 새로운 정산일수(payCount)를 더하고(+), 중간정산일 갱신
    let sql = `
        UPDATE new_tb_member_annual_leave 
        SET 
            payCount = IFNULL(payCount, 0) + ?, 
            middleDt = ?, 
            modDt = CURRENT_TIMESTAMP
        WHERE mIdx = ? 
          AND sIdx = ? 
          AND year = ?
    `;

    // 파라미터 순서 주의: 누적할 일수, 정산일, 회원idx, 현장idx, 귀속년도
    let aParameter = [payCount, settleDt, mIdx, sIdx, year];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

//직원 연차 신청
exports.setMemberOff = async function (cIdx, mIdx, sIdx, startDt, endDt, reason) {
    let sql = "insert into new_tb_member_off (cIdx, mIdx, sIdx, startDt, endDt, reason)"
    sql += " values (?, ?, ?, ?, ?, ?)"
    let aParameter = [cIdx, mIdx, sIdx, startDt, endDt, reason];

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

exports.registerMemberWithContractAndStaffing = async function (member, contract, staffing, bigoLogs, periodsData) {
    const connection = await pool.getConnection(); // 커넥션 가져오기

    try {
        await connection.beginTransaction(); // 트랜잭션 시작

        // -----------------------------------------------------
        // 1. 직원(Member) 등록
        // -----------------------------------------------------
        let sqlMember = `
            INSERT INTO new_tb_member 
            (cIdx, hq, type, name, billingName, id, password, 
             birthDt, rrn, phone, position, gender, email,
             disability, disability_date, disability_grade, defector, patriot, intern, beneficiary,
             foreigner, nationality, visa_code, visa_date,
             etc_name_1, etc_value_1, etc_name_2, etc_value_2, etc_name_3, etc_value_3,
             bank, accountNm, accountNumber, four_ins, retire_pension, 
             inDate, outDate, outReason, 
             transferDate, 
             status, address)
            VALUES (?, ?, ?, ?, ?, ?, ?, 
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, 
                    ?, ?, ?, 
                    ?, 
                    ?, ?)
        `;

        let paramMember = [
            member.cIdx, member.mType == 'HQ'?'Y':'N', member.type, member.name, member.billingName, member.id, member.password,
            member.birthDt, member.rrn,
            member.phone, member.position, member.gender, member.email,
            member.disability, member.disability_date, member.disability_grade, member.defector, member.patriot, member.intern,
            member.beneficiary, member.foreigner, member.nationality, member.visa_code, member.visa_date,
            member.etc_name_1, member.etc_value_1,
            member.etc_name_2, member.etc_value_2,
            member.etc_name_3, member.etc_value_3,
            member.bank, member.accountNm, member.accountNumber,
            member.four_ins, member.retire_pension,
            member.inDate, member.outDate, member.outReason,
            member.transferDate,
            member.status, member.address
        ];

        let resMember = await connection.query(sqlMember, paramMember);
        let new_mIdx = resMember[0].insertId; // 생성된 직원 PK (mIdx) 가져오기

        // -----------------------------------------------------
        // 1-2. 비고 누적 기록 (new_tb_member_bigo) 등록
        // -----------------------------------------------------
        // 기본 특이사항 (type: 1)
        if (bigoLogs.bigo && bigoLogs.bigo.trim() !== '') {
            let sqlBigo1 = `
                INSERT INTO new_tb_member_bigo (mIdx, bigo, type, regDt) 
                VALUES (?, ?, '1', NOW())
            `;
            await connection.query(sqlBigo1, [new_mIdx, bigoLogs.bigo]);
        }

        // 급여 관련 특이사항 (type: 2)
        if (bigoLogs.payrollBigo && bigoLogs.payrollBigo.trim() !== '') {
            let sqlBigo2 = `
                INSERT INTO new_tb_member_bigo (mIdx, bigo, type, regDt) 
                VALUES (?, ?, '2', NOW())
            `;
            await connection.query(sqlBigo2, [new_mIdx, bigoLogs.payrollBigo]);
        }

        // -----------------------------------------------------
        // 2. 계약서(Contract) 등록
        // -----------------------------------------------------
        // contract 데이터에 위에서 만든 new_mIdx를 사용합니다.
        let sqlContract = `
            INSERT INTO new_tb_member_contract 
            (mIdx, sIdx, type, day_work_time, month_work_time, 
             payItems, deductionItems, workSchedule, 
             contractStartDt, contractEndDt, bigo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        let paramContract = [
            new_mIdx,
            contract.sIdx,
            contract.type,
            // contract.jsonData, // JSON 문자열 상태
            contract.dayWorkTime,
            contract.monthWorkTime,
            contract.payItems,
            contract.deductionItems,
            contract.workSchedule,
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

        // -----------------------------------------------------
        // 4. 입사/퇴사일 이력 누적 기록(new_tb_member_history) 등록
        // -----------------------------------------------------
        if (periodsData && periodsData.length > 0) {
            let sqlPeriod = `
                INSERT INTO new_tb_member_history 
                (mIdx, sIdx, historyStatus, startDate, endDate, outReason, regDt) 
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            `;

            // 다중 기간(일용직/대근)일 경우 배열 길이만큼 반복해서 INSERT
            for (const period of periodsData) {
                // startDate나 endDate가 null이 아닐 때만 유효한 기록으로 간주하여 넣거나,
                // 무조건 넣고 싶다면 조건문 없이 바로 쿼리 실행 가능
                await connection.query(sqlPeriod, [
                    new_mIdx,
                    staffing.sIdx,
                    period.status,
                    period.startDate,
                    period.endDate,
                    period.outReason
                ]);
            }
        }

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

exports.updateMemberWithContractAndStaffing = async function (mIdx, member, contract, staffing, bigoLogs, periodsData) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let sqlMember, paramMember;
        const commonFields = `
            type = ?, name = ?, billingName = ?, id = ?, 
            birthDt = ?, rrn=?, phone = ?, position = ?, 
            gender = ?, email = ?, disability = ?, disability_date = ?, 
            disability_grade = ?, defector = ?, patriot = ?, intern = ?, 
            beneficiary = ?, foreigner = ?, nationality = ?, visa_code = ?, 
            visa_date = ?, bank = ?, accountNm = ?, accountNumber = ?,
            inDate = ?, outDate =?, outReason=?,
            transferDate = ?, 
            address = ?, status = ?,
            four_ins = ?, retire_pension = ?
        `;

        if (member.password) {
            sqlMember = `UPDATE new_tb_member SET ${commonFields}, password = ? WHERE idx = ?`;
            paramMember = [
                member.type, member.name, member.billingName, member.id,
                member.birthDt, member.rrn, member.phone, member.position,
                member.gender, member.email, member.disability, member.disability_date,
                member.disability_grade, member.defector, member.patriot, member.intern,
                member.beneficiary, member.foreigner, member.nationality, member.visa_code,
                member.visa_date, member.bank, member.accountNm, member.accountNumber,
                member.inDate, member.outDate, member.outReason,
                member.transferDate,
                member.addr, member.status,
                member.fourInsurance, member.retirePension, member.password, mIdx
            ];
        } else {
            sqlMember = `UPDATE new_tb_member SET ${commonFields} WHERE idx = ?`;
            paramMember = [
                member.type, member.name, member.billingName, member.id,
                member.birthDt, member.rrn, member.phone, member.position,
                member.gender, member.email, member.disability, member.disability_date,
                member.disability_grade, member.defector, member.patriot, member.intern,
                member.beneficiary, member.foreigner, member.nationality, member.visa_code,
                member.visa_date, member.bank, member.accountNm, member.accountNumber,
                member.inDate, member.outDate, member.outReason,
                member.transferDate,
                member.addr, member.status,
                member.fourInsurance, member.retirePension, mIdx
            ];
        }
        await connection.query(sqlMember, paramMember);

        // 내용이 존재할 때만 Insert 실행
        if (bigoLogs && bigoLogs.bigo && bigoLogs.bigo.trim() !== '') {
            const sqlBigo1 = `
                INSERT INTO new_tb_member_bigo (mIdx, bigo, type, regDt, admin_id) 
                VALUES (?, ?, '1', NOW(), ?)
            `;
            await connection.query(sqlBigo1, [mIdx, bigoLogs.bigo.trim(), bigoLogs.admin_id]);
        }

        if (bigoLogs && bigoLogs.payrollBigo && bigoLogs.payrollBigo.trim() !== '') {
            const sqlBigo2 = `
                INSERT INTO new_tb_member_bigo (mIdx, bigo, type, regDt, admin_id) 
                VALUES (?, ?, '2', NOW(), ?)
            `;
            await connection.query(sqlBigo2, [mIdx, bigoLogs.payrollBigo.trim(), bigoLogs.admin_id]);
        }

        // 2. Contract 업데이트
        const sqlContractCheck = `SELECT idx FROM new_tb_member_contract WHERE mIdx = ? ORDER BY idx DESC LIMIT 1`;
        const [contractRows] = await connection.query(sqlContractCheck, [mIdx]);

        if (contractRows.length > 0) {
            const sqlContract = `
                UPDATE new_tb_member_contract SET
                    sIdx = ?, type = ?, 
                    day_work_time = ?, month_work_time = ?, 
                    payItems = ?, deductionItems = ?, workSchedule = ?,
                    contractStartDt = ?, contractEndDt = ?, bigo = ?
                WHERE idx = ?
            `;
            await connection.query(sqlContract, [
                contract.sIdx, contract.type,
                contract.dayWorkTime, contract.monthWorkTime,
                contract.payItems, contract.deductionItems, contract.workSchedule,
                contract.startDt, contract.endDt, contract.bigo, contractRows[0].idx
            ]);
        } else {
            const sqlContract = `
                INSERT INTO new_tb_member_contract
                    (mIdx, sIdx, type, day_work_time, month_work_time, 
                     payItems, deductionItems,
                     workSchedule, contractStartDt, contractEndDt, bigo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await connection.query(sqlContract, [
                mIdx, contract.sIdx, contract.type,
                contract.dayWorkTime, contract.monthWorkTime,
                contract.payItems, contract.deductionItems, contract.workSchedule,
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

        // -----------------------------------------------------------------
        // 4. 이력(History) 테이블 업데이트 처리 (Upsert 방식)
        // -----------------------------------------------------------------
        if (periodsData && periodsData.length > 0) {
            const currentStatus = periodsData[0].status;
            const keepIdxList = periodsData.filter(p => p.idx).map(p => p.idx);

            // 사용자가 '일용직' 기간 중 특정 기간을 프론트에서 '-' 버튼으로 지웠을 때를 대비한 로직
            // '현재 저장하려는 상태(currentStatus)'에 해당하는 과거 이력 중, 넘어온 idx 목록에 없는 것은 N 처리
            if (keepIdxList.length > 0) {
                const placeholders = keepIdxList.map(() => '?').join(',');
                const sqlDeleteRemoved = `
            UPDATE new_tb_member_history 
            SET useFl = 'N' 
            WHERE mIdx = ? AND historyStatus = ? AND idx NOT IN (${placeholders})
        `;
                await connection.query(sqlDeleteRemoved, [mIdx, currentStatus, ...keepIdxList]);
            } else {
                // 넘어온 기존 idx가 하나도 없다면, 해당 상태의 기존 내역을 모두 N 처리 (사용자가 다 지운 경우)
                const sqlDeleteAllForStatus = `
            UPDATE new_tb_member_history 
            SET useFl = 'N' 
            WHERE mIdx = ? AND historyStatus = ?
        `;
                await connection.query(sqlDeleteAllForStatus, [mIdx, currentStatus]);
            }

            // 넘어온 데이터 Insert 또는 Update 처리
            for (const p of periodsData) {
                if (p.idx) {
                    // ① PK(idx)가 있으면 기존 이력이므로 UPDATE 처리 (regDt는 유지됨)
                    const sqlUpdateHistory = `
                UPDATE new_tb_member_history 
                SET sIdx = ?, startDate = ?, endDate = ?, outReason = ?, useFl = 'Y'
                WHERE idx = ?
            `;
                    await connection.query(sqlUpdateHistory, [
                        staffing.sIdx, p.startDate, p.endDate, p.outReason, p.idx
                    ]);
                } else if (p.startDate || p.endDate) {
                    // ② PK(idx)가 없으면 새로 추가된 이력(혹은 새로운 상태 전환)이므로 INSERT 처리
                    const sqlInsertHistory = `
                INSERT INTO new_tb_member_history 
                (mIdx, sIdx, historyStatus, startDate, endDate, outReason, useFl, regDt) 
                VALUES (?, ?, ?, ?, ?, ?, 'Y', NOW())
            `;
                    await connection.query(sqlInsertHistory, [
                        mIdx, staffing.sIdx, p.status, p.startDate, p.endDate, p.outReason
                    ]);
                }
            }
        }

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

exports.setMemberMemo = async function (mIdx, colName, type, text) {
    let selectSql = "SELECT memo FROM new_tb_member WHERE idx = ?";
    let updateSql = "UPDATE new_tb_member SET memo = ? WHERE idx = ?";

    try {
        // 1. 기존 직원의 메모 데이터(JSON) 조회
        let [rows] = await pool.query(selectSql, [mIdx]);

        // 2. 파싱 (DB에 null이거나 값이 없으면 빈 객체로 초기화)
        let memoObj = {};
        if (rows.length > 0 && rows[0].memo) {
            memoObj = typeof rows[0].memo === 'string' ? JSON.parse(rows[0].memo) : rows[0].memo;
        }

        // 3. 넘어온 컬럼명(colName)에 해당하는 데이터만 갱신
        memoObj[colName] = {
            type: type || '02004002',
            content: text,
            regDt: new Date().toISOString().slice(0, 16).replace('T', ' ') // '2026-07-24 10:11' 형태
        };

        // 4. 수정한 JSON 객체를 문자열로 변환하여 DB에 업데이트
        let aParameter = [JSON.stringify(memoObj), mIdx];
        await pool.query(updateSql, aParameter);

        // 5. 프론트엔드로 전달할 수 있도록 업데이트된 전체 메모 객체 반환
        return memoObj;

    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}; // 기존 에러 처리 방식과 동일하게 맞춤
    }
}

exports.deleteMemberMemo = async function (mIdx, colName) {
    let selectSql = "SELECT memo FROM new_tb_member WHERE idx = ?";
    let updateSql = "UPDATE new_tb_member SET memo = ? WHERE idx = ?";

    try {
        // 1. 기존 직원의 메모 데이터(JSON) 통째로 조회
        let [rows] = await pool.query(selectSql, [mIdx]);

        let memoObj = {};
        if (rows.length > 0 && rows[0].memo) {
            memoObj = typeof rows[0].memo === 'string' ? JSON.parse(rows[0].memo) : rows[0].memo;
        }

        // 2. JavaScript의 delete 연산자를 사용해 해당 컬럼(키)의 데이터만 쏙 삭제
        // 예: colName이 'name'이면 memoObj 안의 "name" 데이터만 날아감
        if (memoObj[colName]) {
            delete memoObj[colName];
        }

        // 3. 해당 컬럼이 지워진 나머지 JSON 객체를 다시 문자열로 변환하여 UPDATE (덮어쓰기)
        let aParameter = [JSON.stringify(memoObj), mIdx];
        await pool.query(updateSql, aParameter);

        // 4. 프론트 화면을 즉시 갱신할 수 있도록 남은 메모 객체 반환
        return memoObj;

    } catch (e) {
        console.log('db err', e);
        return { 'data': '-9999' };
    }
}

exports.updateMemberBigo = async function (idx, bigo, admin){
    let sql = "update new_tb_member_bigo set bigo=? where idx = ?"
    let aParameter = [bigo, idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.DeleteMemberBigo = async function (idx) {
    let sql = "delete from new_tb_member_bigo where idx = ?";
    let aParameter = [idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.updateMemberFourInsStatus = async function (cIdx, mIdx, colName, status) {
    // 1. 기존 `four_ins_status`를 동적 변수 ${colName}으로 변경
    // 2. WHERE 절에 누락되었던 AND 추가
    let sql = `UPDATE new_tb_member SET ${colName} = ? WHERE cIdx = ? AND idx = ?`;
    let aParameter = [status, cIdx, mIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'};
    }
}

exports.deleteMember = async function (mId) {
    // let sql = "delete from new_tb_member where id = ?"
    let sql = "update new_tb_member set deleteFl = 'Y' where id = ?";
    let aParameter = [mId];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getCleaningMembers = async function (cIdx) {
    let sql = "select * from new_tb_member where hq = 'Y' and cIdx in (?)";
    let aParameter = [cIdx];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setCleaningMembers = async function (memberValues) {
    let sql = "INSERT INTO new_tb_cleaning_team_member (tIdx, mIdx, leaderFl, regDt) VALUES ?";
    let aParameter = [memberValues];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'};
    }
}

// 특정 팀의 팀원 전체 삭제
exports.deleteCleaningMembers = async function (teamIdx) {
    let sql = "DELETE FROM new_tb_cleaning_team_member WHERE tIdx = ?";
    let aParameter = [teamIdx];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'};
    }
}

// 팀원 일괄 등록 (Bulk Insert)
exports.insertTeamMembers = async (tIdx, mIdx, leaderFl, regDt) => {
    let sql = `
        INSERT INTO new_tb_cleaning_team_member (tIdx, mIdx, leaderFl, regDt) 
        VALUES ?
    `;
    let aParameter = [tIdx, mIdx, leaderFl, regDt];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res.insertId;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};