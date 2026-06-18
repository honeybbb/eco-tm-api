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
    let files = req.files; // upload.any()로 수집된 모든 파일 배열
    let sIdx = req.params.sIdx; // 현장 PK

    if (!files || files.length === 0) {
        return res.json({'result': false, 'msg': '파일이 전달되지 않았습니다.'});
    }

    try {
        // 1. 해당 현장(sIdx)에 등록된 계약 노무 그룹들을 순서대로(idx 정렬) 가져옵니다.
        // /site/register 단계에서 이미 계약 로우들이 생성되어 있어야 매핑이 가능합니다.
        let contracts = await contractModel.getContractsBySite(sIdx);

        if (!contracts || contracts.length === 0) {
            return res.json({'result': false, 'msg': '해당 현장에 등록된 계약 정보가 존재하지 않습니다.'});
        }

        // 2. 프론트엔드에서 전송한 contract 인덱스별로 파일들을 그룹화합니다.
        // 구조 예시: { '0': [file1, file2], '1': [file3] }
        let fileGroups = {};
        files.forEach(file => {
            let match = file.fieldname.match(/file_contract_(\d+)/);
            if (match) {
                let contractIndex = match[1];
                if (!fileGroups[contractIndex]) {
                    fileGroups[contractIndex] = [];
                }
                fileGroups[contractIndex].push(file);
            }
        });

        // 3. 그룹화된 파일들을 순회하며 해당하는 계약 row의 파일 컬럼을 업데이트합니다.
        for (const [contractIndexStr, groupFiles] of Object.entries(fileGroups)) {
            let contractIndex = parseInt(contractIndexStr, 10);

            // DB에서 가져온 계약 로우 중 프론트 인덱스와 매핑되는 계약 데이터 선택
            let targetContract = contracts[contractIndex];
            if (!targetContract) continue; // 해당 인덱스에 매칭되는 DB 계약 row가 없으면 패스

            let originalNames = [];
            let fileUrls = [];

            groupFiles.forEach(file => {
                originalNames.push(file.originalname);
                fileUrls.push(`/uploads/${file.filename}`);
            });

            // 파일 매핑 저장 방식 규칙에 맞춰 문자열화 (Varchar(255) 구조 고려)
            const originalNamesStr = JSON.stringify(originalNames);
            const fileUrlsStr = JSON.stringify(fileUrls);

            // 4. 계약 테이블(new_tb_site_contract)의 PK(idx)를 타겟으로 파일 경로 업데이트
            await contractModel.updateContractFilePath(originalNamesStr, fileUrlsStr, targetContract.idx);
        }

        res.json({'result': true, 'msg': '계약별 파일 업로드가 완료되었습니다.'});
    } catch (err) {
        console.error('계약서 파일 업로드 중 서버 에러:', err);
        res.json({'result': false, 'msg': '파일 저장 중 서버 오류가 발생했습니다.'});
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
