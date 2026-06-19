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
    let files = req.files || [];

    try {
        let targetScIdxs = new Set();

        // 1. 넘어온 데이터에서 scIdx 번호들만 쏙쏙 추출
        files.forEach(f => {
            let match = f.fieldname.match(/file_contract_(\d+)/);
            if (match) targetScIdxs.add(match[1]);
        });
        Object.keys(req.body).forEach(key => {
            let match = key.match(/existing_files_(\d+)/);
            if (match) targetScIdxs.add(match[1]);
        });

        if (targetScIdxs.size === 0) return res.json({result: true});

        // 2. 추출한 scIdx 계약만 콕 집어서 DB 업데이트!
        for (let scIdx of targetScIdxs) {
            let newFiles = files.filter(f => f.fieldname === `file_contract_${scIdx}`);
            let existStr = req.body[`existing_files_${scIdx}`];

            // 변경사항이 없으면 안전하게 스킵
            if (newFiles.length === 0 && !existStr) continue;

            let existFiles = existStr ? JSON.parse(existStr) : [];
            let finalNames = existFiles.map(f => f.name);
            let finalUrls = existFiles.map(f => f.url);

            newFiles.forEach(f => {
                finalNames.push(f.originalname);
                finalUrls.push(`/uploads/${f.filename}`);
            });

            // 🚨 다른 계약은 절대 건드리지 않고, 지정된 scIdx만 완벽하게 덮어쓰기!
            await contractModel.updateContractFilePath(JSON.stringify(finalNames), JSON.stringify(finalUrls), scIdx);
        }
        res.json({result: true, msg: '파일 업로드 성공'});
    } catch (err) {
        console.error(err);
        res.json({result: false, msg: '서버 에러'});
    }
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
