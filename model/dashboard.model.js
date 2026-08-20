const mysql = require("mysql2/promise");
const pool = require("../config/mysql");

// 통계 데이터 가져오기 (전체 개수, 이번 달 추가된 개수)
exports.getSiteStats = async function (cIdx) {
    // 1. 전체 개수 (totalCount)
    // 2. 지난달 1일 ~ 마지막일 사이에 생성된 개수 (increaseCount)
    let sql = `
        SELECT 
            COUNT(*) AS totalCount,
            COUNT(CASE WHEN regDt >= LAST_DAY(NOW() - INTERVAL 2 MONTH) + INTERVAL 1 DAY 
                  AND regDt <= LAST_DAY(NOW() - INTERVAL 1 MONTH) THEN 1 END) AS lastMonthIncrease
        FROM new_tb_site 
        WHERE cIdx = ?
    `;

    try {
        let [res] = await pool.query(sql, [cIdx]);
        return res[0]; // { totalCount: 10, lastMonthIncrease: 2 }
    } catch (e) {
        console.log('db err', e);
        return { totalCount: 0, lastMonthIncrease: 0 };
    }
};

// 멤버 통계 데이터 가져오기 (전체 인원, 지난달 신규 입사자)
exports.getMemberStatsTemp = async function (cIdx) {
    /**
     * totalCount: 현재 등록된 전체 멤버 수
     * lastMonthIncrease: 지난달(1일~말일) 사이에 입사(inDate)한 멤버 수
     */
    let sql = `
        SELECT 
            COUNT(*) AS totalCount,
            COUNT(CASE WHEN inDate >= LAST_DAY(NOW() - INTERVAL 2 MONTH) + INTERVAL 1 DAY 
                  AND inDate <= LAST_DAY(NOW() - INTERVAL 1 MONTH) THEN 1 END) AS lastMonthIncrease
        FROM new_tb_member 
        WHERE cIdx = ? and status = 0 /* 재직중(status=0) */
    `;
    let aParameter = [cIdx];
    try {
        let [res] = await pool.query(sql, aParameter);
        // 만약 데이터가 없으면 기본값 반환
        return res[0] || { totalCount: 0, lastMonthIncrease: 0 };
    } catch (e) {
        console.log('db err', e);
        return { totalCount: 0, lastMonthNewcomers: 0 };
    }
};

// 통계 데이터 가져오기 (전체 인원, 지난달 신규 입사자, 총 계약 인원)
exports.getMemberStats = async function (cIdx) {
    let sql = `
        SELECT
            -- 1. 재직 인원 (status = 0)
            (SELECT COUNT(*) FROM new_tb_member WHERE cIdx = ? AND status = 0) AS totalCount,

            -- 2. 지난달 신규 입사자
            (SELECT COUNT(*) FROM new_tb_member
             WHERE cIdx = ? AND status = 0
               AND inDate >= LAST_DAY(NOW() - INTERVAL 2 MONTH) + INTERVAL 1 DAY
            AND inDate <= LAST_DAY(NOW() - INTERVAL 1 MONTH)) AS lastMonthIncrease,

            -- 3. 총 계약 인원 (현재 유효한 계약 기간 기준)
            IFNULL(
            (
            SELECT SUM(sc.staffCount)
            FROM new_tb_site_contract sc
            INNER JOIN (
            -- 핵심 수정 부분: 오늘 날짜가 계약 기간(startDt ~ endDt)에 포함되는 계약만 필터링
            SELECT sIdx, type, MAX(idx) AS max_idx
            FROM new_tb_site_contract
            WHERE CURDATE() >= DATE(startDt) AND CURDATE() <= DATE(endDt)
            GROUP BY sIdx, type
            ) active_latest ON sc.idx = active_latest.max_idx
            INNER JOIN new_tb_site s ON s.idx = sc.sIdx
            WHERE s.cIdx = ?
            ), 0
            ) AS contractCount
    `;

    // cIdx가 3번 사용되므로 배열에 3개 삽입
    let aParameter = [cIdx, cIdx, cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res[0] || { totalCount: 0, lastMonthIncrease: 0, contractCount: 0 };
    } catch (e) {
        console.log('db err', e);
        return { totalCount: 0, lastMonthIncrease: 0, contractCount: 0 };
    }
};

//승인대기업무
exports.getPendingApprovals = async (cIdx) => {
    let sql = `
        SELECT
          'off'          AS type,
          o.idx,
          m.name         AS applicant,
          s.name         AS site,
          o.reason       AS summary,
          o.startDt      AS date,
          o.status,
          o.regDt
        FROM new_tb_member_off o
        JOIN new_tb_member m ON m.idx = o.mIdx
        JOIN new_tb_site   s ON s.idx = o.sIdx
        WHERE o.status = 0
          AND s.cIdx = ?
    
        UNION ALL
    
        -- 물품 신청 (1신청 = 여러 행 → 서브쿼리로 먼저 GROUP BY)
        SELECT
          'order'        AS type,
          grouped.mIdx   AS idx,
          grouped.applicant,
          grouped.siteName AS site,
          grouped.summary,
          DATE(grouped.regDt) AS date,
          grouped.status,
          grouped.regDt
        FROM (
          SELECT
            o.regDt,
            o.mIdx,
            o.sIdx,
            o.status,
            s.name  AS siteName,
            m.name  AS applicant,
            -- 기존 getOrders와 동일한 summary 로직
            CONCAT(
              MAX(p.itemNm), ' (', MAX(c.itemNm), ')',
              IF(COUNT(o.idx) > 1, CONCAT(' 외 ', COUNT(o.idx) - 1, '건'), '')
            ) AS summary
          FROM new_tb_orders o
          LEFT JOIN new_tb_site   s ON s.idx = o.sIdx
          LEFT JOIN new_tb_member m ON m.idx = o.mIdx
          LEFT JOIN new_tb_code   c ON c.itemCd = o.itemCd
          LEFT JOIN new_tb_code   p ON LEFT(c.itemCd, 5) = p.itemCd
          WHERE o.status = 0
            AND s.cIdx = ?
          GROUP BY o.regDt, o.mIdx, o.sIdx, o.status
        ) grouped
    
        ORDER BY regDt DESC
        LIMIT 20
      `;

    let aParameter = [cIdx, cIdx];

    try {
        const [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return { data: '-9999' };
    }
};
