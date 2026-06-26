const pool = require("../config/mysql");
const mysql = require("mysql2/promise")

/*
exports.getSiteList = async function (cIdx) {
    let sql = "select s.*, case when s.status = 'Y' then '운영 중' else '계약 종료' end as `status`,"
    sql += " CONCAT(DATE_FORMAT(sc.startDt, '%Y-%m-%d'), ' ~ ', DATE_FORMAT(sc.endDt, '%Y-%m-%d')) AS contract,"
    sql += " sc.total_cost"
    sql += " from new_tb_site s"
    sql += " left join new_tb_site_contract sc on sc.sIdx = s.idx"
    sql += " where s.cIdx = ?";
    sql += " group by s.idx"
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

 */
exports.getSiteList = async function (cIdx) {
    let sql = `
        SELECT s.*,
               CASE WHEN s.status = 'Y' THEN '운영 중' ELSE '계약 종료' END AS status,
               (
                   SELECT JSON_ARRAYAGG(
                                  JSON_OBJECT(
                                          'type', sc.type,
                                          'typeNm', IFNULL((SELECT itemNm FROM new_tb_code WHERE itemCd = sc.type LIMIT 1), sc.type),
                                            -- 최초계약일(firstContractDt)부터 계약종료일(endDt)까지 포맷팅하여 연결
                                          'contract_period', CONCAT(
                                                  IFNULL(DATE_FORMAT(sc.firstContractDt, '%Y-%m-%d'), '-'),
                                                  ' ~ ',
                                                  IFNULL(DATE_FORMAT(sc.endDt, '%Y-%m-%d'), '-')
                                                             ),
                                          'startDt', DATE_FORMAT(sc.startDt, '%Y-%m-%d'),
                                          'endDt', DATE_FORMAT(sc.endDt, '%Y-%m-%d'),
                                          'total_cost', sc.total_cost,
                                          'jsonData', sc.jsonData,
                                          'staffDetail', sc.staffDetail,
                                          'salarySource', sc.salarySource,
                                          'cleaningConfig', sc.cleaningConfig
                                  )
                          )
                   FROM new_tb_site_contract sc
                            INNER JOIN (
                       -- 각 현장(sIdx) 및 구분(type)별로 최신 계약(max_idx)과 최초 시작일(first_start_dt)만 1건씩 추출
                       SELECT
                           sIdx,
                           type,
                           MAX(idx) AS max_idx,
                           MIN(startDt) AS first_start_dt
                       FROM new_tb_site_contract
                       GROUP BY sIdx, type
                   ) latest ON sc.idx = latest.max_idx
                   WHERE sc.sIdx = s.idx
               ) AS contracts
        FROM new_tb_site s
        WHERE s.cIdx = ?
    `;

    let aParameter = [cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setSiteBigo = async function (sIdx, bigo, admin) {
    let sql = "insert into new_tb_site_bigo (sIdx, bigo, admin_id) values (?, ?, ?)"
    let aParameter = [sIdx, bigo, admin];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.updateSiteBigo = async function (idx, bigo, admin) {
    let sql = "update new_tb_site_bigo set bigo=?, admin_id=? where idx = ?"
    let aParameter = [bigo, admin, idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.DeleteSiteBigo = async function (idx) {
    let sql = "delete from new_tb_site_bigo where idx = ?";
    let aParameter = [idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setSiteOrderBudgets = async function (sIdx, value, admin) {
    let sql = "insert into new_tb_site_budget (sIdx, value, admin, regDt) values (?, ?, ?, NOW())";
    sql += " ON DUPLICATE KEY UPDATE value = ?, managerId = ?, modDt = NOW()";

    let aParameter = [sIdx, value, admin, value, admin];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setSiteData = async function (cIdx, name, address, phone, bigo, building_su, unit_su, area) {
    let sql = "insert into new_tb_site (cIdx, name, address, phone, bigo, building_su, unit_su, area) values (?, ?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [cIdx, name, address, phone, bigo, building_su, unit_su, area];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.saveSite = async function (site) {
    const connection = await pool.getConnection();
    try {
        let new_sIdx = site.sIdx;

        if (new_sIdx) {
            // [UPDATE]
            let sql = `
                UPDATE new_tb_site 
                SET sType=?, name=?, zipcode = ?, address=?, phone=?, building_su=?, unit_su=?, 
                    area=?, areaUnder=?, areaOver=?, is_vat=?, manager=?,
                    director=?, director_phone=?, billingManager = ?, payrollManager = ?,
                    bankName=?, accountNumber=?, accountName=?, payment_day=?,
                    businessNumber=?, businessName =?, representative=?, businessType=?, businessItem=?, 
                    email=?
                WHERE idx = ?
            `;
            let params = [
                site.sType, site.name, site.zipcode, site.address, site.phone, site.building_su, site.unit_su,
                site.area, site.areaUnder, site.areaOver, site.is_vat,site.manager,
                site.director, site.director_phone, site.billingManager, site.payrollManager,
                site.bankName, site.accountNumber, site.accountName, site.payment_day,
                site.businessNumber, site.businessName, site.representative, site.businessType, site.businessItem,
                site.email,
                new_sIdx
            ];
            await connection.query(sql, params);
        } else {
            // [INSERT]
            let sql = `
                INSERT INTO new_tb_site
                (cIdx, sType, name, zipcode, address, phone,
                 building_su, unit_su, area, areaUnder, areaOver, is_vat, manager,
                 director, director_phone, billingManager, payrollManager, 
                 bankName, accountNumber, accountName, payment_day,
                 businessNumber,businessName, representative, businessType, businessItem,
                 email)
                VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, 
                        ?, ?, ?, ?,
                        ?,?, ?, ?, ?,
                        ?
                       )
            `;
            let params = [
                site.cIdx, site.sType, site.name, site.zipcode, site.address,
                site.phone, site.building_su, site.unit_su,
                site.area, site.areaUnder, site.areaOver, site.is_vat, site.manager,
                site.director, site.director_phone, site.billingManager, site.payrollManager,
                site.bankName, site.accountNumber, site.accountName, site.payment_day,
                site.businessNumber, site.businessName, site.representative, site.businessType, site.businessItem,
                site.email
            ];
            let result = await connection.query(sql, params);
            new_sIdx = result[0].insertId;
        }

        return { success: true, sIdx: new_sIdx };

    } catch (e) {
        console.error(e);
        return { success: false, error: e };
    } finally {
        connection.release();
    }
}

exports.saveContract = async function (contract) {
    const connection = await pool.getConnection();
    try {
        // scIdx(계약 PK)가 있으면 UPDATE, 없으면 INSERT
        let current_scIdx = contract.scIdx;
        if (current_scIdx) {
            // [UPDATE]
            let sql = `
                UPDATE new_tb_site_contract 
                SET type=?, jsonData=?, total_cost=?, firstContractDt=?, startDt=?, endDt=?, staffCount=?, staffDetail=?, 
                    workSchedule=?, breaktime=?, isAutoCalc=?, meltOptions=?, viewConfig=?, salarySource=?, cleaningConfig=?
                WHERE idx = ? 
            `;
            let params = [
                contract.type,
                contract.costBreakdown,
                contract.totalCost,
                contract.firstContractDt,
                contract.startDt,
                contract.endDt,
                contract.staffCount,
                contract.staffDetail,
                contract.workSchedule,
                contract.breaktime,
                contract.isAutoCalc,
                contract.meltOptions,
                contract.viewConfig,
                contract.salarySource,
                contract.cleaningConfig,
                contract.scIdx // WHERE 조건
            ];
            await connection.query(sql, params);

        } else {
            // [INSERT]
            let sql = `
                INSERT INTO new_tb_site_contract 
                (sIdx, cIdx, type, workdays, total_cost,
                 firstContractDt, startDt, endDt, staffCount, staffDetail, workSchedule, breaktime,
                 jsonData, isAutoCalc, meltOptions, viewConfig, salarySource, cleaningConfig) 
                VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ? , ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?)
            `;
            let params = [
                contract.sIdx, // 현장 FK
                contract.cIdx,
                contract.type,
                contract.workDays,
                contract.totalCost,
                contract.firstContractDt,
                contract.startDt,
                contract.endDt,
                contract.staffCount,
                contract.staffDetail,
                contract.workSchedule,
                contract.breaktime,
                contract.costBreakdown,
                contract.isAutoCalc,
                contract.meltOptions,
                contract.viewConfig,
                contract.salarySource,
                contract.cleaningConfig,
            ];
            let [result] = await connection.query(sql, params);
            current_scIdx = result.insertId;
        }

        return { success: true, scIdx: current_scIdx };

    } catch (e) {
        console.error("Contract Save Error:", e);
        return { success: false, error: e };
    } finally {
        connection.release();
    }
}

exports.syncWorkContracts = async function (scIdx, sIdx, staffList) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. 해당 계약(scIdx)의 기존 스케줄 데이터 일괄 삭제
        await connection.query(`DELETE FROM new_tb_work_contract WHERE scIdx = ?`, [scIdx]);

        // 2. 넘어온 인원(직책) 리스트를 순회하며 새로 Insert
        if (staffList && Array.isArray(staffList) && staffList.length > 0) {
            let sql = `
                INSERT INTO new_tb_work_contract 
                (scIdx, sIdx, position, workhours, breaktime, regDt) 
                VALUES (?, ?, ?, ?, ?, NOW())
            `;

            for (const staff of staffList) {
                // 프론트에서 넘어온 객체를 JSON 문자열로 변환 (없으면 빈 객체)
                const workhoursJson = staff.schedule ? JSON.stringify(staff.schedule) : '{}';

                await connection.query(sql, [
                    scIdx,
                    sIdx,
                    staff.code,       // position 컬럼 (직책 코드)
                    workhoursJson,    // workhours json 컬럼
                    null              // 휴게시간은 json 내부에 있으므로 공란(null) 처리 또는 기본값
                ]);
            }
        }

        await connection.commit();
        return { success: true };

    } catch (e) {
        await connection.rollback();
        console.error("Work Contract Sync Error:", e);
        return { success: false, error: e };
    } finally {
        connection.release();
    }
}

// saveSite, saveContract 아래에 추가
exports.saveSiteBigo = async function (sIdx, bigo, type, adminId) {
    if (!bigo || !bigo.trim()) return; // 빈 값이면 저장 안 함
    const connection = await pool.getConnection();
    try {
        await connection.query(
            `INSERT INTO new_tb_site_bigo (sIdx, bigo, type, admin_id) VALUES (?, ?, ?, ?)`,
            [sIdx, bigo.trim(), type, adminId || null]
        );
    } catch (e) {
        console.error('saveSiteBigo Error:', e);
    } finally {
        connection.release();
    }
};

exports.insertSiteAndContract = async function (site, contract) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        let new_sIdx = site.sIdx; // sIdx가 있는지 확인 (수정 모드인지 확인)

        // ----------------------------------------------------
        // CASE 1: 수정 (sIdx가 있을 때 -> UPDATE)
        // ----------------------------------------------------
        if (new_sIdx) {
            // 1. 현장 정보 수정
            let sqlSite = `
                UPDATE new_tb_site 
                SET name=?, address=?, phone=?, building_su=?, unit_su=?, 
                    area=?, director=?, director_phone=?
                WHERE sIdx = ?
            `;
            let paramSite = [
                site.name,
                site.address,
                site.phone,
                site.building_su,
                site.unit_su,
                site.area,
                site.director,
                site.director_phone,
                new_sIdx // WHERE 조건
            ];
            await connection.query(sqlSite, paramSite);

            // 2. 계약 정보 수정
            let sqlContract = `
                UPDATE new_tb_site_contract 
                SET jsonData=?, total_cost=?, startDt=?, endDt=?, staffCount=?, staffDetail=?, 
                    workSchedule=?, breaktime=?
                WHERE sIdx = ?
            `;
            let paramContract = [
                JSON.stringify(contract.contract),
                contract.totalCost,
                contract.startDt,
                contract.endDt,
                contract.staffCount,
                contract.staffDetail,
                contract.workSchedule,
                contract.breaktime,
                new_sIdx // WHERE 조건
            ];
            await connection.query(sqlContract, paramContract);
        }
            // ----------------------------------------------------
            // CASE 2: 신규 등록 (sIdx가 없을 때 -> INSERT) : 기존 코드 그대로
        // ----------------------------------------------------
        else {
            // 1. 현장 등록
            let sqlSite = `
                INSERT INTO new_tb_site 
                (cIdx, name, address, phone, building_su, unit_su, area, director, director_phone) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            let paramSite = [
                site.cIdx,
                site.name,
                site.address,
                site.phone,
                site.building_su,
                site.unit_su,
                site.area,
                site.director,
                site.director_phone,
            ];
            let result = await connection.query(sqlSite, paramSite);

            new_sIdx = result[0].insertId; // 새로 생성된 ID 받기

            // 2. 계약 등록
            let sqlContract = `
                INSERT INTO new_tb_site_contract 
                (sIdx, cIdx, jsonData, total_cost, startDt, endDt, staffCount, staffDetail, workSchedule, breaktime) 
                VALUES (?, ?, ?, ?, ?, ?, ? , ?, ?, ?)
            `;
            let paramContract = [
                new_sIdx,
                contract.cIdx,
                JSON.stringify(contract.contract),
                contract.totalCost,
                contract.startDt,
                contract.endDt,
                contract.staffCount,
                contract.staffDetail,
                contract.workSchedule,
                contract.breaktime,
            ];
            await connection.query(sqlContract, paramContract);
        }

        await connection.commit();

        return { success: true, sIdx: new_sIdx };

    } catch (e) {
        await connection.rollback();
        console.log('Transaction Error:', e);
        return { success: false, error: e };

    } finally {
        connection.release();
    }
}

exports.registerBudget = async function (sIdx, jsonData) {
    let sql = "update new_tb_site_contract set jsonData=? where sIdx = ?"
    let aParameter = [jsonData,sIdx];

    try {
        let res = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getSiteBudget = async function (sIdx, type) {
    let sql = "select * from new_tb_site_contract where sIdx = ? and type=? order by regDt desc limit 1"
    let aParameter = [sIdx, type];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

// siteModel.js

exports.getSiteCleaningSchedule = async function (cIdx) {
    let query = `
        SELECT 
            scs.idx,
            scs.sIdx,
            ss.name AS siteName,
            scs.itemCd,
            scs.cleaningDt,
            scs.regDt
            -- sc.status -- 만약 상태 컬럼을 추가하셨다면 주석을 해제하세요.
        FROM new_tb_site_cleaning_schedule scs
        JOIN new_tb_site s ON scs.sIdx = s.idx
        WHERE s.cIdx = ?
        ORDER BY sc.cleaningDt ASC
    `;
    let aParameter = [cIdx];
    try {
        const [res] = await pool.query(query, aParameter);
        return res;
    } catch (err) {
        console.error("대청소 일정 조회 에러:", err);
        throw err;
    }
}

exports.updateSiteData = async function (sIdx, name, address, phone, bigo, building_su, unit_su, area) {
    let sql = "update new_tb_site set name=?,address=?,phone=?,bigo=?,building_su=?,unit_su=?,area=? where sIdx = ?";
    let aParameter = [name, address, phone, building_su, unit_su, area, sIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.DeleteSite = async function (cIdx, sIdx) {
    let sql = "delete from new_tb_site where cIdx = ? and idx = ?"
    let aParameter = [cIdx, sIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.updateSiteManager = async function (cIdx, siteIds, targetField, managerName) {
    // ?? 는 컬럼명(식별자), ? 는 데이터(값)로 매핑됩니다.
    // 기존에 sIdx를 사용하셨으므로 WHERE 절은 sIdx IN (?) 으로 유지합니다.
    let sql = "UPDATE new_tb_site SET ?? = ? WHERE sIdx IN (?) AND cIdx = ?";

    // 순서대로 targetField(컬럼명), managerName(이름), siteIds(배열), cIdx 매핑
    let aParameter = [targetField, managerName, siteIds, cIdx];

    let query = mysql.format(sql, aParameter);

    try {
        let res = await pool.query(query);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'};
    }
}

exports.setSiteHeadCount = async function (cIdx, sIdx, jsonData) {
    let sql = "insert into new_tb_site_assignment (cIdx, sIdx, jsonData) values (?, ?, ?)";
    let aParameter = [cIdx, sIdx, jsonData];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getSiteHeadCount = async function (sIdx) {
    let sql = "select m.name, (select itemNm from new_tb_code where itemCd = m.position) as role,"
    sql += " m.inDate as joinDate,"
    sql += " CASE WHEN m.status = 0 THEN '재직' WHEN m.status = 1 THEN '퇴사' ELSE '알 수 없음' END AS status,"
    sql += " m.phone"
    sql += " from new_tb_member_assignment ma"
    sql += " left join new_tb_member m on m.idx = ma.mIdx WHERE ma.sIdx = ?";
    let aParameter = [sIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getAssignedStaff = async function (sIdx) {
    let sql = `
        SELECT
            ma.mIdx,
            ma.idx AS assignIdx,
            DATE_FORMAT(ma.regDt, '%Y-%m-%d') AS assignDate,
            m.type,
            m.name,
            m.phone,
            m.position,
            (SELECT itemNm FROM new_tb_code WHERE itemCd = m.position AND cIdx = m.cIdx LIMIT 1) AS positionName
        FROM new_tb_member_assignment ma
            LEFT JOIN new_tb_member m ON m.idx = ma.mIdx
        WHERE ma.sIdx IN (?)
          AND ma.idx = (
            SELECT MAX(idx)
            FROM new_tb_member_assignment
            WHERE sIdx IN (?) AND mIdx = ma.mIdx AND isActive = 'Y'
            )
    `;
    let aParameter = [sIdx, sIdx];
    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    } catch (e) {
        console.log('db err', e);
        return [];
    }
}

exports.getSiteData = async function (sIdx) {
    /*
    let sql = "select s.*, sc.startDt, sc.endDt, sc.total_cost,"
    sql += " CONCAT('[',GROUP_CONCAT(DISTINCT CASE WHEN sb.sIdx is not null THEN JSON_OBJECT('bigo', sb.bigo, 'regDt', sb.regDt) END),']') as bigoList,"
    sql += " CONCAT('[',GROUP_CONCAT(DISTINCT CASE WHEN sc.sIdx is not null THEN JSON_OBJECT('workDays', sc.workdays, 'startDt', sc.startDt,"
    sql += " 'endDt', sc.endDt, 'workSchedule', sc.workSchedule, 'breaktime', sc.breaktime,'budget', sc.jsonData, 'scIdx', sc.idx,"
    sql += " 'category', (select itemNm from new_tb_code where itemCd = sc.type),"
    sql += " 'type', (select itemCd from new_tb_code where itemCd = sc.type),"
    sql += " 'staffList', sc.staffDetail, 'staffCount', sc.staffCount) END),']') as `contractList`"
    sql += " from new_tb_site s"
    sql += " left join new_tb_site_contract sc on sc.sIdx = s.idx"
    sql += " left join new_tb_site_bigo sb on sb.sIdx = s.idx"
    sql += " where s.idx in (?)";
    // sql += " order by regDt desc limit 1"

     */
    let sql = `
        SELECT
            s.*,
            -- type별 최신 계약 1건씩만 묶어서 반환
            CONCAT('[', GROUP_CONCAT(
                DISTINCT CASE 
            WHEN latest_sc.sIdx IS NOT NULL 
            THEN JSON_OBJECT(
              'workDays',    latest_sc.workdays,
              'firstContractDt', latest_sc.firstContractDt,
              'startDt',     latest_sc.startDt,
              'endDt',       latest_sc.endDt,
              'workSchedule',latest_sc.workSchedule,
              'breaktime',   latest_sc.breaktime,
              'budget',      latest_sc.jsonData,
              'totalCost',   latest_sc.total_cost,
              'scIdx',       latest_sc.idx,
              'staffList',   latest_sc.staffDetail,
              'staffCount',  latest_sc.staffCount,
              'isAutoCalc',   latest_sc.isAutoCalc,
                'meltOptions', latest_sc.meltOptions,
                'viewConfig', latest_sc.viewConfig,
                'salarySource', latest_sc.salarySource,
                'contractFileOriginal', latest_sc.contractFileOriginal,
              'contractFileSaved',    latest_sc.contractFileSaved,
              -- ★ 수정 1: cIdx 일치 조건 및 LIMIT 1 추가 (다중 행 에러 방지)
              'category',    (SELECT itemNm FROM new_tb_code WHERE itemCd = latest_sc.type AND cIdx = latest_sc.cIdx LIMIT 1),
              -- ★ 수정 2: 불필요한 서브쿼리 제거 (어차피 동일한 값이므로 그냥 컬럼 사용)
              'type',        latest_sc.type,
              'cleaningConfig',latest_sc.cleaningConfig
            ) 
          END
        ), ']') AS contractList,

            -- bigoList는 기존 그대로
            CONCAT('[', GROUP_CONCAT(
                DISTINCT CASE 
            WHEN sb.sIdx IS NOT NULL 
            THEN JSON_OBJECT('bgIdx', sb.idx ,'bigo', sb.bigo, 'writer', sb.admin_id, 'type', sb.type, 'regDt', sb.regDt) 
          END
        ), ']') AS bigoList

        FROM new_tb_site s

                 -- type별 최신 계약만 조인
                 LEFT JOIN new_tb_site_contract latest_sc
                           ON latest_sc.idx = (
                               SELECT idx
                               FROM new_tb_site_contract
                               WHERE sIdx = s.idx
                                 AND type = latest_sc.type   -- 같은 type 중에서
                               ORDER BY startDt DESC, idx DESC  -- 가장 최근 계약
            LIMIT 1
            )
            AND latest_sc.sIdx = s.idx

            LEFT JOIN new_tb_site_bigo sb ON sb.sIdx = s.idx

        WHERE s.idx IN (?)
        GROUP BY s.idx
    `;
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

exports.getSiteData_v2 = async function (sIdx) {
    let sql = `
        SELECT
            s.*,
            -- 모든 계약 정보를 JSON 배열로 묶어서 반환 (시작일 오름차순 정렬)
            CONCAT('[', GROUP_CONCAT(
                DISTINCT CASE 
                    WHEN sc.sIdx IS NOT NULL 
                    THEN JSON_OBJECT(
                        'workDays',       sc.workdays,
                        'firstContractDt',sc.firstContractDt,
                        'startDt',        sc.startDt,
                        'endDt',          sc.endDt,
                        'workSchedule',   sc.workSchedule,
                        'breaktime',      sc.breaktime,
                        'budget',         sc.jsonData,
                        'totalCost',      sc.total_cost,
                        'scIdx',          sc.idx,
                        'staffList',      sc.staffDetail,
                        'staffCount',     sc.staffCount,
                        'isAutoCalc',     sc.isAutoCalc,
                        'meltOptions',    sc.meltOptions,
                        'viewConfig',     sc.viewConfig,
                        'salarySource',   sc.salarySource,
                        'contractFileOriginal', sc.contractFileOriginal,
                        'contractFileSaved',    sc.contractFileSaved,
                        'category',       (SELECT itemNm FROM new_tb_code WHERE itemCd = sc.type AND cIdx = sc.cIdx LIMIT 1),
                        'type',           sc.type,
                        'cleaningConfig', sc.cleaningConfig
                    ) 
                END
                ORDER BY sc.startDt ASC -- 엑셀 시트 순서를 위해 과거 계약부터 오름차순 정렬
            ), ']') AS contractList,

            -- 특이사항(bigoList)은 기존 유지
            CONCAT('[', GROUP_CONCAT(
                DISTINCT CASE 
                    WHEN sb.sIdx IS NOT NULL 
                    THEN JSON_OBJECT('bigo', sb.bigo, 'writer', sb.admin_id, 'type', sb.type, 'regDt', sb.regDt) 
                END
            ), ']') AS bigoList

        FROM new_tb_site s
        
        -- latest 서브쿼리 제거하고 모든 계약 데이터를 그냥 JOIN
        LEFT JOIN new_tb_site_contract sc ON sc.sIdx = s.idx
        LEFT JOIN new_tb_site_bigo sb ON sb.sIdx = s.idx

        WHERE s.idx IN (?)
        GROUP BY s.idx
    `;

    try {
        let [res] = await pool.query(sql, [sIdx]);
        return res;
    } catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
exports.getWorkContracts = async function (sIdx) {
    let sql = `SELECT scIdx, position, workhours FROM new_tb_work_contract WHERE sIdx = ?`;
    try {
        let [res] = await pool.query(sql, [sIdx]);
        return res;
    } catch (e) {
        console.log('work contract db err', e);
        return [];
    }
}

exports.getSiteCoords = async function (sIdx) {
    let sql = "select latitude, longitude from new_tb_site where idx = ?";
    let aParameter = [sIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res[0];
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getSiteData1 = async function (sIdx) {
    // 현장 정보 가져오기
    let sqlSite = `SELECT * FROM new_tb_site WHERE idx = ?`;

    // 계약 정보 가져오기 (컬럼 일일이 안 적고 * 사용 가능!)
    let sqlContract = `SELECT * FROM new_tb_site_contract WHERE sIdx = ? ORDER BY startDt DESC`;

    // 3. 비고 정보 가져오기
    let sqlBigo = `SELECT * FROM new_tb_site_bigo WHERE sIdx = ? ORDER BY regDt DESC`;

    try {
        // Promise.all로 3개의 쿼리를 병렬(동시) 실행 -> 속도 빠름
        const [siteRows, contractRows, bigoRows] = await Promise.all([
            pool.query(sqlSite, [sIdx]),
            pool.query(sqlContract, [sIdx]),
            pool.query(sqlBigo, [sIdx])
        ]);

        // 현장 정보가 없으면 null 리턴
        if (siteRows.length === 0) {
            return null;
        }

        // 4. 데이터 합치기 (Javascript 객체 구조 만들기)
        const siteData = siteRows[0]; // 현장 기본 정보 (1개)

        // 현장 객체 안에 리스트를 집어넣음
        siteData.contractList = contractRows; // 계약 리스트 (배열)
        siteData.bigoList = bigoRows;         // 비고 리스트 (배열)

        return siteData;

    } catch (e) {
        console.error("DB Error:", e);
        throw e;
    }
}

exports.setAccountBill = async function (dno, cIdx, sIdx, date, receiver, title, period1, period2, jsonData, areaData, amount) {
    let sql = "insert into new_tb_account_bill (dno, cIdx, sIdx, date, receiver, title, period1, period2, jsonData, areaData, amount)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [dno, cIdx, sIdx, date, receiver, title, period1, period2, jsonData, areaData, amount];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getAccountBillList = async function (year, month){
    let sql = "select * new_tb_account_bill from where year in (?) and month (?)"
    let aParameter = [year, month];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getAccountBill = async function (year, month, sIdx, cIdx) {
    let sql = "select * from new_tb_account_bill where year in (?) and month in (?) and sIdx = ? and cIdx = ?";
    let aParameter = [year, month, sIdx, cIdx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setSiteEstimate = async function (sIdx, cIdx, jsonData, total) {
    let sql = "insert into new_tb_site_contract (sIdx, cIdx, jsonData, total) values (?, ?, ?, ?)"
    let aParameter = [sIdx, cIdx, jsonData, total];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
