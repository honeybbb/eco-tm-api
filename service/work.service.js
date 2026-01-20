const workModel = require("../model/work.model")
//출근 여부 확인
exports.getWorkFl = async function (req, res) {
    let mIdx = req.params.mIdx,
        sIdx = req.query.sIdx,
        today = new Date().toISOString().slice(0, 10); // '2025-11-07'

    console.log(mIdx, sIdx, today)

    let result = await workModel.getWorkFl(mIdx, sIdx, today);

    res.json({'result': true, 'data': result})
}

//직원 출근
exports.workStart = async function (req, res) {
    let mIdx = req.body.mIdx,
        sIdx = req.body.sIdx,
        workStartDt = new Date(),
        regDt = new Date();

    console.log(mIdx, sIdx, workStartDt, regDt)
    let result = await workModel.workStart(mIdx, sIdx, workStartDt, regDt);

    res.json({'result': true, 'data': result})
}

//직원 퇴근
exports.workEnd = async function (req, res) {
    let mIdx = req.body.mIdx,
        sIdx = req.body.sIdx,
        workEndDt = new Date(),
        today = new Date().toISOString().slice(0, 10); // '2025-11-07'

    console.log(mIdx, sIdx, workEndDt, today)

    let result = await workModel.workEnd(mIdx, sIdx, workEndDt, today);

    res.json({'result': true, 'data': result})
}

//직원 근무현황 조회
exports.getWorkSheet = async function (req, res) {
    let mIdx = req.params.mIdx, //직원idx
        startDt = req.query.startDt,
        endDt = req.query.endDt;

    let result = await workModel.getWorkSheet(mIdx, startDt, endDt);

    res.json({'result': true, 'data':result});
}

//직원 근태 수정
exports.modifyWork = async function (req, res) {
    let idx = req.params.idx,
        workStartDt = req.body.workStartDt,
        workEndDt = req.body.workEndDt,
        workFl = req.body.workFl,
        modDt = new Date();

    let result = await workModel.modifyWork(workStartDt, workEndDt, workFl, modDt, idx);

    res.json({'result': true, 'data':result});
}

exports.getWorkDayCount = async function (req, res) {
    let date = req.query.date;

    let result = await workModel.getWorkDayCount(date);

    res.json({'result': true, 'data':result});
}

exports.getWorkList = async function (req, res) {
    let month = req.query.month;
    let result = await workModel.getWorkList(month);

    res.json({'result': true, 'data':result});
}
