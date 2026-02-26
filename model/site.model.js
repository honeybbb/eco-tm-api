const pool = require("../config/mysql");
const mysql = require("mysql2/promise")

exports.getSiteList = async function (cIdx) {
    let sql = "select s.*, case when s.status = 'Y' then '운영 중' else '계약 종료' end as `status`,"
    sql += " CONCAT(DATE_FORMAT(sc.startDt, '%Y-%m-%d'), ' ~ ', DATE_FORMAT(sc.endDt, '%Y-%m-%d')) AS contract"
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
                SET sType=?, name=?, address=?, phone=?, building_su=?, unit_su=?, area=?,is_vat=?, director=?, director_phone=?, payment_day=?
                WHERE idx = ?
            `;
            let params = [
                site.sType, site.name, site.address, site.phone, site.building_su,
                site.unit_su, site.area, site.is_vat, site.director, site.director_phone, site.payment_day,
                new_sIdx
            ];
            await connection.query(sql, params);
        } else {
            // [INSERT]
            let sql = `
                INSERT INTO new_tb_site 
                (cIdx, sType, name, address, phone, building_su, unit_su, area, is_vat, director, director_phone, payment_day) 
                VALUES (?, ?,  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            let params = [
                site.cIdx, site.sType, site.name, site.address, site.phone, site.building_su,
                site.unit_su, site.area, site.is_vat, site.director, site.director_phone, site.payment_day
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
        if (contract.scIdx) {
            // [UPDATE]
            let sql = `
                UPDATE new_tb_site_contract 
                SET type=?, jsonData=?, total_cost=?, startDt=?, endDt=?, staffCount=?, staffDetail=?, 
                    workSchedule=?, breaktime=?
                WHERE scIdx = ? 
            `;
            let params = [
                contract.type,
                contract.jsonData,
                contract.totalCost,
                contract.startDt,
                contract.endDt,
                contract.staffCount,
                contract.staffDetail,
                contract.workSchedule,
                contract.breaktime,
                contract.scIdx // WHERE 조건
            ];
            await connection.query(sql, params);

        } else {
            // [INSERT]
            let sql = `
                INSERT INTO new_tb_site_contract 
                (sIdx, cIdx, type, workdays, total_cost, startDt, endDt, staffCount, staffDetail, workSchedule, breaktime) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ? , ?, ?, ?)
            `;
            let params = [
                contract.sIdx, // 현장 FK
                contract.cIdx,
                contract.type,
                contract.workDays,
                contract.totalCost,
                contract.startDt,
                contract.endDt,
                contract.staffCount,
                contract.staffDetail,
                contract.workSchedule,
                contract.breaktime
            ];
            await connection.query(sql, params);
        }

        return { success: true };

    } catch (e) {
        console.error("Contract Save Error:", e);
        return { success: false, error: e };
    } finally {
        connection.release();
    }
}

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

exports.getSiteBudget = async function (sIdx) {
    let sql = "select * from new_tb_site_contract where sIdx = ? order by regDt desc limit 1"
    let aParameter = [sIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
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

exports.getSiteData = async function (sIdx) {
    let sql = "select s.*, sa.jsonData, sc.startDt, sc.endDt, sc.total_cost,"
    sql += " CONCAT('[',GROUP_CONCAT(DISTINCT CASE WHEN sb.sIdx is not null THEN JSON_OBJECT('bigo', sb.bigo, 'regDt', sb.regDt) END),']') as bigoList,"
    sql += " CONCAT('[',GROUP_CONCAT(DISTINCT CASE WHEN sc.sIdx is not null THEN JSON_OBJECT('workDays', sc.workdays, 'startDt', sc.startDt,"
    sql += " 'endDt', sc.endDt, 'workSchedule', sc.workSchedule, 'breaktime', sc.breaktime,'budget', sc.jsonData, 'scIdx', sc.idx,"
    sql += " 'category', (select itemNm from new_tb_code where itemCd = sc.type),"
    sql += " 'type', (select itemCd from new_tb_code where itemCd = sc.type),"
    sql += " 'staffList', sc.staffDetail, 'staffCount', sc.staffCount) END),']') as `contractList`"
    sql += " from new_tb_site s"
    sql += " left join new_tb_site_assignment sa on sa.sIdx = s.idx"
    sql += " left join new_tb_site_contract sc on sc.sIdx = s.idx"
    sql += " left join new_tb_site_bigo sb on sb.sIdx = s.idx"
    sql += " where s.idx in (?)";
    // sql += " order by regDt desc limit 1"
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
