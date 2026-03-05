const workModel = require("../model/work.model")
const memberModel = require("../model/member.model");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs/promises");
//출근 여부 확인
exports.getWorkFl = async function (req, res) {
    let mIdx = req.query.mIdx,
        sIdx = req.query.sIdx,
        today = new Date().toISOString().slice(0, 10); // '2025-11-07'

    let result = await workModel.getWorkFl(mIdx, sIdx, today);

    res.json({'result': true, 'data': result})
}

exports.uploadExcel = async function (req, res) {
    console.log("\n===================================================");
    console.log("🚀 [근태 엑셀 업로드] 프로세스 시작");
    console.log("===================================================\n");

    try {
        // ---------------------------------------------------------
        // 1. 요청 파라미터 및 파일 검증
        // ---------------------------------------------------------
        const { sIdx } = req.body;
        const file = req.file;

        if (!sIdx) {
            return res.status(400).json({ result: false, message: "현장 인덱스(sIdx) 값이 없습니다." });
        }
        if (!file || !file.buffer) {
            return res.status(400).json({ result: false, message: "파일이 업로드되지 않았습니다." });
        }

        // ---------------------------------------------------------
        // 2. 엑셀 파일 읽기 (타임존 밀림 방지를 위해 cellDates 옵션 제외)
        // ---------------------------------------------------------
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // 헤더 행(1행) 추출
        const headerRow = xlsx.utils.sheet_to_json(sheet, {
            header: 1,
            range: 0,
            raw: false,             // 엑셀의 화면 표시값(텍스트) 그대로 추출
            dateNF: 'yyyy-mm-dd',   // 날짜 형식 지정
            defval: ""              // 빈 칸도 배열의 자리를 차지하도록 설정
        })[0] || [];

        if (headerRow.length < 2) {
            return res.status(400).json({ result: false, message: "헤더 행의 데이터가 부족합니다." });
        }

        // ---------------------------------------------------------
        // 3. 날짜 헤더 분석 및 매핑 (컬럼 인덱스 : 날짜 문자열)
        // ---------------------------------------------------------
        const dateHeaders = {};
        const currentYear = new Date().getFullYear();

        for (let col = 1; col < headerRow.length; col++) {
            const val = headerRow[col];
            if (!val) continue;

            // 구분자를 '-'로 통일 (예: 2026/01/01, 2026.01.01 -> 2026-01-01)
            let str = String(val).trim().replace(/[\/\.]/g, '-');
            let dateStr = '';

            // 형식 1: YYYY-MM-DD
            if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
                const parts = str.split('-');
                dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
            // 형식 2: MM-DD-YYYY 또는 MM-DD-YY (미국식)
            else if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(str)) {
                const parts = str.split('-');
                let year = parseInt(parts[2], 10);
                if (year < 100) year += 2000;
                dateStr = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            }
            // 형식 3: MM-DD (연도가 생략된 경우 올해로 간주)
            else if (/^\d{1,2}-\d{1,2}$/.test(str)) {
                const parts = str.split('-');
                dateStr = `${currentYear}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            }

            // 정상적인 날짜라면 객체에 저장
            if (dateStr) {
                dateHeaders[col] = dateStr;
            }
        }

        console.log('✅ 추출된 날짜 헤더:', Object.values(dateHeaders).slice(0, 5), '...');

        if (Object.keys(dateHeaders).length === 0) {
            return res.status(400).json({ result: false, message: "유효한 날짜 헤더를 찾을 수 없습니다." });
        }

        // ---------------------------------------------------------
        // 4. 데이터 행 읽기 및 가공
        // ---------------------------------------------------------
        const dataRows = xlsx.utils.sheet_to_json(sheet, {
            header: 1,
            range: 1,
            blankrows: false,
            defval: ""
        });

        const insertData = [];
        const seen = new Set(); // 중복 데이터 방지용 Set
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' '); // 현재 시간

        for (const row of dataRows) {
            const memberId = String(row[0] || '').trim();
            if (!memberId) continue;

            // 사번으로 회원 정보 조회
            const memberRes = await memberModel.getMemberData(memberId);
            if (!memberRes || (Array.isArray(memberRes) && memberRes.length === 0)) {
                console.warn(`⚠️ 사번 [${memberId}] 회원을 찾을 수 없습니다. 건너뜁니다.`);
                continue;
            }

            const mIdx = Array.isArray(memberRes) ? memberRes[0].idx : memberRes.idx;

            // 열(Column)을 순회하며 근무 기록 추출
            for (let col = 1; col < row.length; col++) {
                if (!dateHeaders[col]) continue; // 헤더에 날짜가 없는 열(이름, 비고 등)은 건너뜀

                const cellValue = String(row[col] || '').trim().toUpperCase();
                if (!cellValue) continue;

                // 허용된 근무 상태 텍스트만 처리
                if (!['O', 'X', 'WORK', 'HOLIDAY', 'OFF'].includes(cellValue)) continue;

                const workDate = dateHeaders[col];
                const uniqueKey = `${mIdx}-${workDate}`;

                // 중복 등록 방지
                if (seen.has(uniqueKey)) continue;
                seen.add(uniqueKey);

                let workType = 'work';
                let workFl = 'Y';

                if (cellValue === 'OFF') {
                    workType = 'annual';
                    workFl = 'Y';
                } else if (cellValue === 'HOLIDAY') {
                    workType = 'holiday';
                    workFl = 'Y';
                }else if (cellValue === 'X') {
                    workType = 'absent';
                    workFl = 'Y'
                }

                // DB 입력용 데이터 배열 구성
                insertData.push([
                    Number(mIdx),          // 1. mIdx
                    Number(sIdx),          // 2. sIdx
                    workDate,              // 3. workStartDt
                    workType,              // 4. workType ('work', 'holiday', 'annual')
                    '',                    // 5. bigo
                    currentTime            // 6. regDt
                ]);
            }
        }

        if (insertData.length === 0) {
            return res.status(200).json({ result: true, message: "등록할 근무 기록이 없습니다.", count: 0 });
        }

        // ---------------------------------------------------------
        // 5. 데이터베이스 저장 (모델 형태에 맞춰 개별 인자로 전달)
        // ---------------------------------------------------------
        let successCount = 0;

        for (const data of insertData) {
            // data = [mIdx, sIdx, workStartDt, workType, bigo, regDt]
            const resData = await workModel.workStart(data[0], data[1], data[2], data[3], data[4], data[5]);

            // 모델에서 정상 처리되었는지 확인
            if (resData && resData.data !== '-9999') {
                successCount++;
            }
        }

        console.log(`✅ 데이터베이스 저장 완료: ${insertData.length}건 중 ${successCount}건 성공\n`);

        res.status(200).json({
            result: true,
            count: successCount,
            message: `${insertData.length}건 중 ${successCount}건 등록 완료`
        });

    } catch (error) {
        console.error('❌ 근태 엑셀 업로드 치명적 오류:', error);
        res.status(500).json({ result: false, message: error.message || '서버 내부 오류가 발생했습니다.' });
    }
};

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
