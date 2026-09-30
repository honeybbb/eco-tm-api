const pool = require("../config/mysql");

exports.getFavoriteList = async function (cIdx, managerId) {
    const sql = `
        SELECT idx, cIdx, managerId, path, title, sort, regDt, modDt
        FROM new_tb_manager_favorite
        WHERE cIdx = ? AND managerId = ?
        ORDER BY sort ASC, idx ASC
    `;
    try {
        const [rows] = await pool.query(sql, [cIdx, managerId]);
        return rows;
    } catch (e) {
        console.log('db err', e);
        return { data: '-9999' };
    }
};

exports.addFavorite = async function (cIdx, managerId, path, title) {
    // 신규 저장 시 마지막 순서 뒤에 붙인다. 이미 등록된 경로면 title 만 갱신.
    const sortSql = `
        SELECT COALESCE(MAX(sort), 0) + 1 AS nextSort
        FROM new_tb_manager_favorite
        WHERE cIdx = ? AND managerId = ?
    `;
    const insertSql = `
        INSERT INTO new_tb_manager_favorite (cIdx, managerId, path, title, sort, regDt)
        VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE title = VALUES(title), modDt = NOW()
    `;
    try {
        const [rows] = await pool.query(sortSql, [cIdx, managerId]);
        const nextSort = rows?.[0]?.nextSort ?? 1;
        const [res] = await pool.query(insertSql, [cIdx, managerId, path, title, nextSort]);
        return res;
    } catch (e) {
        console.log('db err', e);
        return { data: '-9999' };
    }
};

exports.removeFavorite = async function (cIdx, managerId, path) {
    const sql = `
        DELETE FROM new_tb_manager_favorite
        WHERE cIdx = ? AND managerId = ? AND path = ?
    `;
    try {
        const [res] = await pool.query(sql, [cIdx, managerId, path]);
        return res;
    } catch (e) {
        console.log('db err', e);
        return { data: '-9999' };
    }
};

exports.reorderFavorites = async function (cIdx, managerId, items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { affectedRows: 0 };
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const it of items) {
            await conn.query(
                `UPDATE new_tb_manager_favorite
                 SET sort = ?, modDt = NOW()
                 WHERE cIdx = ? AND managerId = ? AND path = ?`,
                [Number(it.sort) || 0, cIdx, managerId, it.path]
            );
        }
        await conn.commit();
        return { affectedRows: items.length };
    } catch (e) {
        await conn.rollback();
        console.log('db err', e);
        return { data: '-9999' };
    } finally {
        conn.release();
    }
};
