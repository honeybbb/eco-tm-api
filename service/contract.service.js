const fs = require('fs');
const path = require('path');
const contractModel = require("../model/contract.model")

//직원 근로계약서 작성
exports.setMemberContract = async function (req, res) {
    let mIdx = req.params.mIdx,
        startDt = req.body.startDt, //계약시작일
        endDt = req.body.endDt, //계약종료일
        sIdx = req.body.sIdx, //현장idx
        job = req.body.job, //직무
        jsonData = req.body.jsonData, //임금
        bigo = req.body.bigo; //비고

    console.log(req.body);

    let result = await contractModel.setMemberContract(mIdx, sIdx, job, jsonData, startDt, endDt, bigo);

    res.json({'result': true, 'data': result})
}

exports.getMemberContract = async function (req, res) {
    let mIdx = req.params.mIdx;

    let result = await contractModel.getMemberContract(mIdx);

    res.json({'result': true, 'data': result})
}

//현장 계약
exports.setSiteContract = async function (req, res) {
    let sIdx = req.params.sIdx,
        cIdx = req.body.cIdx,
        contract = req.body.contract,
        totalCost = req.body.totalCost,
        startDt = req.body.contractStart,
        endDt = req.body.contractEnd;

    let result = await contractModel.setSiteContract(sIdx, cIdx, contract, totalCost, startDt, endDt);

    res.json({'result': true, 'data': result})
}

exports.uploadContractFile = async function (req, res) {
    let file = req.file,
        sIdx = req.params.sIdx;

    if (!file) return res.json({'result': false, 'msg':'파일이 전달되지 않았습니다.'});

    const originalName = file.originalname; // 사용자가 올린 원래 파일명 (예: 계약서.pdf)
    const savedFileName = file.filename;    // 서버에 저장된 난수화된 파일명 (예: 17099238123.pdf)
    const fileSize = file.size;             // 파일 용량
    const fileUrl = `/uploads/${savedFileName}`;

    let result = await contractModel.updateFilePath(originalName, fileUrl, sIdx);

    res.json({'result': true, 'data': result})
}

exports.downLoadContractFile = async function (req, res) {
    let sIdx = req.params.sIdx;

    try {
        let result = await contractModel.downloadFilePath(sIdx);

        if (!result || result.length === 0 || !result[0].contractFileSaved) {
            return res.status(404).send('<script>alert("등록된 계약서 파일이 없습니다."); window.close();</script>');
        }

        const originalName = result[0].contractFileOriginal; // 예: "에코그린_청소계약서.pdf"
        const savedName = result[0].contractFileSaved;       // 예: "1773042263924_455410645.pdf"

        const filePath = path.join(__dirname, '../../uploads', savedName);

        if (!fs.existsSync(filePath)) {
            return res.status(404).send('<script>alert("서버 디스크에 파일이 존재하지 않습니다. 관리자에게 문의하세요."); window.close();</script>');
        }

        res.download(filePath, originalName, (err) => {
            if (err) {
                console.error('파일 다운로드 중 에러 발생:', err);
                if (!res.headersSent) {
                    res.status(500).send('<script>alert("다운로드 처리 중 서버 오류가 발생했습니다."); window.close();</script>');
                }
            }
        });

    } catch (e) {
        console.error('다운로드 서비스 쿼리 에러:', e);
        if (!res.headersSent) {
            return res.status(500).send('<script>alert("서버 통신 중 오류가 발생했습니다."); window.close();</script>');
        }
    }
};
