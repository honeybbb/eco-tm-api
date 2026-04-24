const pool = require("../config/mysql");
const mysql = require("mysql2/promise")

exports.getWorkFl = async function (mIdx, sIdx, today) {
    let sql = "select * from new_tb_work"
    sql += " where mIdx = ? and sIdx = ? and Date(regDt) = ?"
    sql += " and workEndDt is null"
    let aParameter = [mIdx, sIdx, today];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

// 특정 날짜 출근 기록 존재 여부 확인 (중복 방지용)
exports.getWorkByDate = async function(mIdx, sIdx, date) {
    let sql = `
        SELECT idx FROM new_tb_work
        WHERE mIdx = ? AND sIdx = ?
          AND DATE(workStartDt) = ?
        LIMIT 1
    `;
    let aPrameter = [mIdx, sIdx, date];

    try {
        const [res] = await pool.query(sql, aPrameter);
        return res;
    } catch (e) {
        console.error('DB Error [getSiteContractDetail]:', e);
        throw e;
    }
};

// workModel.js 또는 siteModel.js
exports.getSiteContractDetail = async function(sIdx, type) {
    let sql = `
        SELECT staffDetail
        FROM new_tb_site_contract
        WHERE sIdx = ? AND type = ?
        ORDER BY startDt DESC, regDt DESC
        LIMIT 1
    `;
    let aParameter = [sIdx, type];
    try {
        const [res] = await pool.query(sql, aParameter);
        return res[0] ? res[0].staffDetail : null;
    } catch (e) {
        console.error('DB Error [getSiteContractDetail]:', e);
        throw e;
    }
};

// 기존 근로 데이터 삭제 (선택된 직종의 일반 근무/특근만 삭제)
exports.deleteWorkByStaffList = async function (sIdx, month, mIdxList) {
    if (!mIdxList || mIdxList.length === 0) return;
    let sql = `
        DELETE FROM new_tb_work 
        WHERE sIdx = ? 
          AND DATE_FORMAT(workStartDt, '%Y-%m') = ?
          AND mIdx IN (?)
          AND workType IN ('work', 'holiday', 'absent') -- 연차(annual), 반차(half)는 보존
    `;

    let aParameter = [sIdx, month, mIdxList];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};

exports.getWorkScheduleBySite = async function(sIdx) {
    let sql = `
        SELECT wc.position, wc.workhours, wc.breaktime
        FROM new_tb_work_contract wc
                 INNER JOIN new_tb_site_contract sc ON sc.idx = wc.scIdx
        WHERE wc.sIdx = ?
          AND sc.idx = (
            -- 최신 유효 계약 idx 1개만 서브쿼리로 특정
            SELECT idx
            FROM new_tb_site_contract
            WHERE sIdx = ?
              AND startDt <= CURDATE()
              AND endDt >= CURDATE()
            ORDER BY regDt DESC
            LIMIT 1
            )
    `;

    let aParameter = [sIdx, sIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

// 해당 월 현장 전체 근태 삭제
exports.deleteWorkByMonth = async function(sIdx, month) {
    let sql = `
        DELETE FROM new_tb_work
        WHERE sIdx = ?
          AND DATE_FORMAT(workStartDt, '%Y-%m') = ?
    `;
    let aParameter = [sIdx, month];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};

exports.workStart = async function (mIdx, sIdx, workStartDt, workType, bigo, regDt) {
    let sql = "insert into new_tb_work (mIdx, sIdx, workStartDt, workType, bigo, regDt)"
    sql += " values (?, ?, ? , ?, ?, ?)"
    let aParameter = [mIdx, sIdx, workStartDt, workType, bigo, regDt];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.workEnd = async function (mIdx, sIdx, workEndDt, today) {
    let sql = "update new_tb_work set workEndDt=?, workFl='N' where mIdx = ? and sIdx = ? and Date(workStartDt) = ?"
    let aParameter = [workEndDt, mIdx, sIdx, today];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getDayOff = async function (mIdx, today) {
    let sql = "select * from new_tb_member_off"
    sql += " where mIdx in (?)" //직원idx
    sql += " and AND (?) BETWEEN startDt AND endDt" //날짜
    sql += " and status = 1"; //연차 승인 상태
    let aParameter = [mIdx, today];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getDayOffList = async function (mIdx, startDt, endDt) {
    let sql = "select * from new_tb_member_off"
}

/*
exports.getWorkDaysAdmin = async function (sIdx, ym) {
    let sql = "SELECT mIdx,COUNT(*) AS workdays"
    sql += " FROM (SELECT mIdx,DATE(workStartDt) AS work_date FROM new_tb_work WHERE sIdx = ?"
    sql += " AND DATE_FORMAT(workStartDt, '%Y-%m') = (?)"
    sql += " GROUP BY mIdx, DATE(workStartDt)"
    sql += " HAVING COUNT(workStartDt) > 0 AND COUNT(workEndDt) > 0"
    sql += " ) AS w GROUP BY mIdx";

    let aParameter = [sIdx, ym];

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


exports.getWorkDaysAdmin = async function (sIdx, ym) {
    let sql = "SELECT w.mIdx,COUNT(*) AS workdays, mw.jsonData"
    // sql += " mw.basic_wage as `bWage`, mw.position_wage as `pWage`, mw.other_wage as `oWage`"
    sql += " FROM (SELECT mIdx,DATE(workStartDt) AS work_date FROM new_tb_work WHERE sIdx = ?"
    sql += " AND DATE_FORMAT(workStartDt, '%Y-%m') = (?)"
    sql += " GROUP BY mIdx, DATE(workStartDt)"
    sql += " HAVING COUNT(workStartDt) > 0 AND COUNT(workEndDt) > 0"
    // sql += " ) AS w left join new_tb_member_wage mw on w.mIdx = mw.mIdx GROUP BY w.mIdx";
    sql += " ) AS w left join new_tb_member_contract mw on w.mIdx = mw.mIdx GROUP BY w.mIdx";

    let aParameter = [sIdx, ym];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWorkDays = async function (targetMonthStr) {
    // let sql = "select COUNT(*) as workdays from new_tb_work where mIdx = ? and LEFT(?, 7) = ?";
    let sql = "SELECT mIdx, DATE_FORMAT(workStartDt, '%Y-%m-%d') as workDate"
    sql += " FROM new_tb_work WHERE DATE_FORMAT(workStartDt, '%Y-%m') = ?"
    let aParameter = [targetMonthStr];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.excelUpload = async function (insertData) {
    let sql = "INSERT INTO new_tb_work (sIdx, mIdx, workStartDt, workEndDt, workType, regDt) VALUES ?";
    let query = mysql.format(sql, [insertData]);

    try {
        let [res] = await pool.query(query);
        return res;
    } catch (e) {
        console.log('db err', e);
        return { 'data': '-9999' }
    }
};

exports.getWorkSheet = async function (mIdx, startDt, endDt) {
    let sql = "SELECT DATE_FORMAT(workStartDt, '%Y-%m-%d') AS `date`,"
    sql += " IFNULL(TIMESTAMPDIFF(HOUR, workStartDt, workEndDt), 0) AS `duration`,"
    sql += " DATE_FORMAT(workStartDt, '%H:%i') AS `workin`,"
    sql += " DATE_FORMAT(workEndDt, '%H:%i') AS `workout`,"
    sql += " workType"
    sql += " FROM new_tb_work"
    sql += " WHERE mIdx = ?"
    sql += " AND workStartDt >= ?"                          // regDt → workStartDt
    sql += " AND workStartDt <= CONCAT(?, ' 23:59:59')"    // regDt → workStartDt
    sql += " ORDER BY workStartDt ASC"                     // 날짜 정렬 추가

    let aParameter = [mIdx, startDt, endDt];

    let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(query);
        return res;
    } catch (e) {
        console.log('db err', e);
        return { 'data': '-9999' }
    }
}

exports.modifyWork = async function (workStartDt, workEndDt, workFl, modDt, idx) {
    let sql = "update new_tb_work set workStartDt = ?, workEndDt = ?, workFl=?, modDt = ? where idx = ?"
    let aParameter = [workStartDt, workEndDt, workFl, modDt, idx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWorkDayCount = async function (date)  {
    let sql = "SELECT mIdx,COUNT(*) as workDays"
    sql += " FROM new_tb_work"
    sql += " WHERE workStartDt LIKE (?)" // 선택된 연월"
    // sql += " AND workFl = 'Y'"  // 유효 근무만
    sql += " GROUP BY mIdx";
    let aParameter = [date];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWorkList = async function (month, sIdx) {
    let sql = "select *,(select type from new_tb_member m where m.idx=mIdx) as `type` from new_tb_work"
    sql += " WHERE workStartDt LIKE CONCAT(?, '%') AND sIdx in (?)";
    /*
    let sql = "SELECT mIdx,COUNT(*) as workDays"
    sql += " FROM new_tb_work"
    sql += " WHERE workStartDt LIKE CONCAT(?, '%')" // 선택된 연월"
    sql += " AND workFl = 'Y'"  // 유효 근무만
    sql += " GROUP BY mIdx";

     */
    let aParameter = [month, sIdx];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getWorkOffList = async function (month, sIdx) {
    let sql = "select * from new_tb_member_off"
    sql += " WHERE startDt LIKE CONCAT(?, '%') AND endDt LIKE CONCAT(?, '%')"
    sql += " AND sIdx in (?)";

    let aParameter = [month, month, sIdx];

    //let query = mysql.format(sql, aParameter);
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

// work.model.js

// 특정 날짜 근태 조회 (수동 수정용)
exports.getWorkByMemberDate = async function(mIdx, sIdx, date) {
    let sql = `
        SELECT idx, workType, bigo
        FROM new_tb_work
        WHERE mIdx = ? AND sIdx = ?
          AND DATE(workStartDt) = ?
        LIMIT 1
    `;
    let aParameter = [mIdx, sIdx, date];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res[0] || null;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};

// 근태 타입 UPDATE (수동 수정)
exports.updateWorkType = async function(idx, workType, bigo) {
    let sql = `
        UPDATE new_tb_work
        SET workType = ?, bigo = ?, modDt = NOW()
        WHERE idx = ?
    `;
    let aParameter = [workType, bigo || '', idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};

// 근태 삭제
exports.deleteWork = async function(idx) {
    let sql = `DELETE FROM new_tb_work WHERE idx = ?`;
    let aParameter = [idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};

// 해당 월 현장 전체 근태 삭제
exports.deleteWorkByMonth = async function(sIdx, month) {
    let sql = `
        DELETE FROM new_tb_work
        WHERE sIdx = ?
          AND DATE_FORMAT(workStartDt, '%Y-%m') = ?
    `;
    let aParameter = [sIdx, month];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
};
