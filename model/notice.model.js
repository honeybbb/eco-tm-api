const mysql = require("mysql2/promise");
const pool = require("../config/mysql");

exports.getNoticeList = async function (cIdx) {
    let sql = "select n.*, c.itemNm as `targetName`"
    sql += " from new_tb_notice n"
    sql += " left join new_tb_code c on c.itemCd = n.target";
    sql += " where n.cIdx in (?)"
    let aParameter = [cIdx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getNoticeTarget = async function (target) {
    let sql = "select * from new_tb_notice where target in (?)"
    let aParameter = [target];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getNoticeData = async function (idx) {
    let sql = "select * from new_tb_notice where idx = ?"
    let aParameter = [idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setNotice = async function (cIdx, must, type, target, title, content, author, regDt){
    let sql = "insert into new_tb_notice (cIdx, must, type, target, title, content, author, regDt)"
    sql += " values (?, ?, ?, ?, ?, ?, ?, ?)"
    sql += " ON DUPLICATE KEY UPDATE must=?, type=?, target=?, title=?, content=?, modDt=?"
    let aParameter = [
        cIdx, must, type, target, title, content, author, regDt,
        must, type, target, title, content, regDt
    ];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.removeNotice = async function (idx){
    let sql = "delete from new_tb_notice where idx = ?"
    let aParameter = [idx];

    try {
        let [res] = await pool.query(sql, aParameter);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
