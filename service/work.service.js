const workModel = require("../model/work.model")
const memberModel = require("../model/member.model");
const multer = require("multer");
const xlsx = require("xlsx");
//출근 여부 확인
exports.getWorkFl = async function (req, res) {
    let mIdx = req.query.mIdx,
        sIdx = req.query.sIdx,
        today = new Date().toISOString().slice(0, 10); // '2025-11-07'

    let result = await workModel.getWorkFl(mIdx, sIdx, today);

    res.json({'result': true, 'data': result})
}

//직원근태 엑셀업로드
exports.excelUpload = async function (req, res) {
    try {
        const { sIdx } = req.params;
        const file = req.file;
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });


        const excelMemberIds = [...new Set(rows.map(row => String(row['사번'] || row['memberId']).trim()))];
        const idMap = await memberModel.getMemberIdxMap(excelMemberIds);

        const insertData = await Promise.all(rows.map(async (row) => {
            const memberId = row['사번'] || row['memberId'];

            // 기존 함수 호출 (배열로 반환되므로 [0] 접근)
            let memberRes = await memberModel.getMemberData(memberId);

            // getMemberData가 에러 시 {'data': '-9999'}를 반환하므로 체크 필요
            if (memberRes.data === '-9999' || !memberRes.length) return null;

            const mIdx = memberRes[0].idx; // idx 쏙 추출
            const type = String(row['근무타입'] || "").trim() || "work";

            return [
                sIdx,
                mIdx,
                row['출근시간'],
                row['퇴근시간'],
                type,
                new Date()
            ];
        }));

        const finalInsertData = insertData.filter(d => d !== null);

        let result = await workModel.excelUpload(finalInsertData);
        res.status(200).json({ result: true, count: result.affectedRows });

    } catch (error) {
        res.status(500).json({ result: false, message: error.message });
    }
}

//직원 출근
exports.workStart = async function (req, res) {
    let mIdx = req.body.mIdx,
        sIdx = req.body.sIdx,
        workStartDt = req.body.workStartDt || new Date(),
        workType = req.body.workType,
        bigo = req.body.bigo,
        regDt = new Date();

    console.log(mIdx, sIdx, workStartDt, regDt, bigo)
    try {
        let result = await workModel.workStart(mIdx, sIdx, workStartDt, workType, bigo, regDt);

        res.json({'result': true, 'data': result})
    }catch (e) {
        console.error(e);
        res.status(500).json({ result: false, message: '서버 에러' });

    }
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

//오늘 연차 여부 확인
exports.getDayOff = async function (req, res) {
    let mIdx = req.params.mIdx,
        today = new Date().toISOString().slice(0, 10);

    let result = await workModel.getDayOff(mIdx, today);

    res.json({'result': true, 'data':result});
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
    let month = req.query.month,
        sIdx = req.query.sIdx;
    let result = await workModel.getWorkList(month, sIdx);

    console.log(month, sIdx, result)

    res.json({'result': true, 'data':result});
}

exports.getWorkOffList = async function (req, res) {
    let month = req.query.month,
        sIdx = req.query.sIdx;
    let result = await workModel.getWorkOffList(month, sIdx);

    res.json({'result': true, 'data':result});
}
