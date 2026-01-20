const mysql = require("mysql");
const pool = require("../config/mysql");
exports.setFormAccident = async function (sIdx, cIdx, siteName, issueDt, description, created_by, created_at, updated_at) {
    let sql = "insert into new_tb_form_accident (sIdx, cIdx, siteName, issueDt, description, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    let aParameter = [sIdx, cIdx, siteName, issueDt, description, created_by, created_at, updated_at];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.getFormAccidentData = async function (idx) {
    let sql = "select * from new_tb_form_accident where idx = ?"
    let aParameter = [idx];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}

exports.setFormRepairRequest = async function (siteName, startDt, endDt, eqName, description, file_edit1, file_edit2, file_edit3, bigo) {
    let sql = "insert into (siteName, startDt, endDt, eqName, description, file_edit1, file_edit2, file_edit3, bigo) values (?, ?, ?, ?, ?, ?, ?, ? ,?)"
    let aParameter = [siteName, startDt, endDt, eqName, description, file_edit1, file_edit2, file_edit3, bigo];

    let query = mysql.format(sql, aParameter);
    try {
        let res = await pool.query(query);
        return res;
    }catch (e) {
        console.log('db err', e);
        return {'data': '-9999'}
    }
}
