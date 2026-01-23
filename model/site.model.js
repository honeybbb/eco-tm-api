const pool = require("../config/mysql");
const mysql = require("mysql2/promise")

exports.getSiteList = async function (cIdx) {
    let sql = "select s.*,"
    sql += " CONCAT(DATE_FORMAT(sc.startDt, '%Y-%m-%d'), ' ~ ', DATE_FORMAT(sc.endDt, '%Y-%m-%d')) AS contract"
    sql += " from new_tb_site s"
    sql += " left join new_tb_site_contract sc on sc.sIdx = s.idx"
    sql += " where s.cIdx = ?";
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

exports.setSiteData = async function (cIdx, name, address, phone, bigo, building_su, unit_su, area) {
    let sql = "insert into new_tb_site (cIdx, name, address, phone, building_su, unit_su, area) values (?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [cIdx, name, address, phone, building_su, unit_su, area];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.insertSiteAndContract = async function (site, contract) {
    const connection = await pool.getConnection();

    try {
        // 트랜잭션 시작
        await connection.beginTransaction();

        // 현장등록 시작
        let sqlSite = `
            INSERT INTO new_tb_site 
            (cIdx, name, address, phone, building_su, unit_su, area) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        let paramSite = [
            site.cIdx,
            site.name,
            site.address,
            site.phone,
            site.building_su,
            site.unit_su,
            site.area
        ];

        // pool.query 대신 connection.query 사용
        let result = await connection.query(sqlSite, paramSite);

        // ★ 중요: 방금 INSERT한 현장의 Primary Key (Auto Increment ID)를 가져옵니다.
        let new_sIdx = result[0].insertId;

        // 계약 등록
        // 위에서 얻은 newSiteIdx를 sIdx 값으로 사용합니다.
        let sqlContract = `
            INSERT INTO new_tb_site_contract 
            (sIdx, cIdx, jsonData, total_amount, startDt, endDt) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        let paramContract = [
            new_sIdx,        // ★ 여기서 현장 ID 연결
            contract.cIdx,
            JSON.stringify(contract.contract),
            contract.totalCost,
            contract.startDt,
            contract.endDt
        ];

        await connection.query(sqlContract, paramContract);
        await connection.commit();

        // 성공 시 생성된 현장 ID 반환
        return { success: true, sIdx: new_sIdx };

    } catch (e) {
        // ---------------------------------------------------------
        // Step D. 에러 발생 시 롤백 (모두 취소)
        // ---------------------------------------------------------
        await connection.rollback();
        console.log('Transaction Error:', e);
        return { success: false, error: e };

    } finally {
        // 3. 커넥션 반납 (필수)
        connection.release();
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

exports.getSiteData = async function (sIdx) {
    let sql = "select s.*, sa.jsonData, sc.startDt, sc.endDt, sc.total_cost"
    sql += " from new_tb_site s"
    sql += " left join new_tb_site_assignment sa on sa.sIdx = s.idx"
    sql += " left join new_tb_site_contract sc on sc.sIdx = s.idx"
    sql += " where s.idx in (?)";
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
