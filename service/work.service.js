const workModel = require("../model/work.model")
const memberModel = require("../model/member.model");
const xlsx = require("xlsx");
const path = require('path');
const ExcelJS = require('exceljs');

//출근 여부 확인
exports.getWorkFl = async function (req, res) {
    let mIdx = req.query.mIdx,
        sIdx = req.query.sIdx,
        today = new Date().toISOString().slice(0, 10); // '2025-11-07'

    let result = await workModel.getWorkFl(mIdx, sIdx, today);

    res.json({'result': true, 'data': result})
}

exports.downloadTemplate = async function (req, res) {
    try {
        const cIdx = req.user.cIdx;
        const { sIdx, month } = req.query;

        if (!sIdx) return res.status(400).json({ result: false, message: 'sIdx가 없습니다.' });
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({ result: false, message: 'month 형식이 올바르지 않습니다. (예: 2026-04)' });
        }

        // 현장 소속 직원 목록 조회
        const staffList = await memberModel.getStaffBySite(sIdx, cIdx);
        if (!staffList || staffList.length === 0) {
            return res.status(400).json({ result: false, message: '해당 현장에 등록된 직원이 없습니다.' });
        }

        // 양식 파일 로드 (스타일/색상/병합 모두 유지됨)
        const filePath = path.join(__dirname, '..', 'static', '근태등록_양식.xlsx');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const ws = workbook.getWorksheet('근태등록');

        // 1행 타이틀에 month 반영
        const titleCell = ws.getCell('A1');
        titleCell.value = `[${month}] 근태 예외 등록 양식  (연차 / 반차 / 대근 / 특근만 입력)`;

        // 4행부터 직원 사번 + 이름 채우기 (C~F열은 빈칸 유지)
        staffList.forEach((staff, i) => {
            const rowNum = i + 4; // 4행부터 시작
            const row = ws.getRow(rowNum);

            const aCell = row.getCell(1); // 사번
            const bCell = row.getCell(2); // 이름

            // 값만 업데이트 (기존 스타일 그대로 유지)
            aCell.value = String(staff.memberId);
            bCell.value = staff.name;

            row.commit();
        });

        // 버퍼로 변환 후 응답
        const buf = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(`근태등록_양식_${month}.xlsx`)}`);
        res.setHeader('Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);

    } catch (error) {
        console.error('❌ 양식 다운로드 오류:', error);
        res.status(500).json({ result: false, message: error.message });
    }
};

/*
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
        if (!file || !file.path) {
            return res.status(400).json({ result: false, message: "파일이 업로드되지 않았습니다." });
        }

        // ---------------------------------------------------------
        // 2. 엑셀 파일 읽기 (타임존 밀림 방지를 위해 cellDates 옵션 제외)
        // ---------------------------------------------------------
        const workbook = xlsx.readFile(file.path);
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

 */

function excelSerialToDateStr(serial) {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


/**
 * 날짜 문자열 배열 파싱 (쉼표 구분)
 * "2026-01-03,2026-01-10" → ["2026-01-03", "2026-01-10"]
 */
function parseDateList(cellValue) {
    if (!cellValue && cellValue !== 0) return [];
    return String(cellValue).split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
            if (/^\d{4,6}$/.test(s) && Number(s) > 40000) return excelSerialToDateStr(Number(s)); // 시리얼 숫자
            if (s.includes('T')) s = s.split('T')[0]; // ISO 형식
            const match = s.match(/(\d{4})-(\d{2})-(\d{2})/);
            return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
        })
        .filter(Boolean);
}

/**
 * 대근 셀 파싱: "대근자사번^날짜,대근자사번^날짜"
 * → [{ subMemberId: "1001005", date: "2026-01-20" }, ...]
 */
function parseSubstituteList(cellValue) {
    if (!cellValue) return [];
    return String(cellValue).split(',')
        .map(s => s.trim())
        .filter(s => s.includes('^'))
        .map(s => {
            const [subMemberId, datePart] = s.split('^').map(p => p.trim());
            const dates = parseDateList(datePart);
            return dates.length ? { subMemberId, date: dates[0] } : null;
        })
        .filter(Boolean);
}

/**
 * 해당 월의 모든 날짜 배열 생성
 * "2026-01" → ["2026-01-01", "2026-01-02", ..., "2026-01-31"]
 */
function getAllDatesOfMonth(yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dates = [];
    for (let d = 1; d <= daysInMonth; d++) {
        dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return dates;
}

exports.uploadExcel = async function (req, res) {
    try {
        const cIdx = req.user.cIdx;
        const { sIdx, month } = req.body;
        const file = req.file;

        if (!sIdx) return res.status(400).json({ result: false, message: "현장 인덱스(sIdx) 값이 없습니다." });
        if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ result: false, message: "month 파라미터가 없거나 형식이 올바르지 않습니다." });
        if (!file || !file.path) return res.status(400).json({ result: false, message: "파일이 업로드되지 않았습니다." });

        const workbook = xlsx.readFile(file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = xlsx.utils.sheet_to_json(sheet, {
            header: 1, range: 0, raw: true, defval: ""
        });

        const dataRows = allRows.slice(3).filter(row => String(row[0] || '').trim());
        if (dataRows.length === 0) {
            return res.status(400).json({ result: false, message: "입력된 데이터가 없습니다." });
        }

        const allStaffRes = await memberModel.getStaffBySite(sIdx, cIdx);
        if (!allStaffRes || allStaffRes.length === 0) {
            return res.status(400).json({ result: false, message: "해당 현장에 등록된 직원이 없습니다." });
        }

        // ─────────────────────────────────────────────────────
        // 현장 계약 근무스케줄 조회
        // position → workhours 매핑
        // ─────────────────────────────────────────────────────
        const contractRes = await workModel.getWorkScheduleBySite(sIdx);

        // { position: { "1":7, "2":7, ..., "6":{"hours":3,"weeks":"odd"} } }
        const contractMap = {};
        for (const contract of contractRes) {
            contractMap[contract.position] = typeof contract.workhours === 'string'
                ? JSON.parse(contract.workhours)
                : contract.workhours;
        }

        console.log('📋 계약 스케줄:', contractMap);

        // 사번 → mIdx, position 매핑
        const staffMap = {};
        for (const staff of allStaffRes) {
            staffMap[String(staff.memberId).trim()] = {
                mIdx: staff.idx,
                position: staff.position
            };
        }

        const allDates = getAllDatesOfMonth(month);
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const seen = new Set();
        const insertData = [];
        const exceptionDates = {};

        // ─── 엑셀 예외 파싱 (기존 로직 동일) ───
        for (const row of dataRows) {
            const memberId = String(row[0] || '').trim();
            if (!memberId) continue;

            const staffInfo = staffMap[memberId];
            if (!staffInfo) {
                console.warn(`⚠️ 사번 [${memberId}] 을 찾을 수 없습니다.`);
                continue;
            }

            const { mIdx } = staffInfo;
            if (!exceptionDates[mIdx]) exceptionDates[mIdx] = new Set();

            // 연차
            for (const date of parseDateList(row[2])) {
                const key = `${mIdx}-${date}`;
                if (seen.has(key)) continue;
                seen.add(key);
                exceptionDates[mIdx].add(date);
                insertData.push([mIdx, Number(sIdx), date, 'annual', '', currentTime]);
            }

            // 반차
            for (const date of parseDateList(row[3])) {
                const key = `${mIdx}-${date}`;
                if (seen.has(key)) continue;
                seen.add(key);
                exceptionDates[mIdx].add(date);
                insertData.push([mIdx, Number(sIdx), date, 'half', '', currentTime]);
            }

            // 대근
            for (const { subMemberId, date } of parseSubstituteList(row[4])) {
                const absentKey = `${mIdx}-${date}`;
                if (!seen.has(absentKey)) {
                    seen.add(absentKey);
                    exceptionDates[mIdx].add(date);
                    insertData.push([mIdx, Number(sIdx), date, 'absent', `대근: ${subMemberId}`, currentTime]);
                }

                const subInfo = staffMap[subMemberId];
                if (!subInfo) { console.warn(`⚠️ 대근자 [${subMemberId}] 없음`); continue; }

                const workKey = `${subInfo.mIdx}-${date}`;
                if (!seen.has(workKey)) {
                    seen.add(workKey);
                    if (!exceptionDates[subInfo.mIdx]) exceptionDates[subInfo.mIdx] = new Set();
                    exceptionDates[subInfo.mIdx].add(date);
                    insertData.push([subInfo.mIdx, Number(sIdx), date, 'work', `대근: ${memberId} 대체`, currentTime]);
                }
            }

            // 특근
            for (const date of parseDateList(row[5])) {
                const key = `${mIdx}-${date}`;
                if (seen.has(key)) continue;
                seen.add(key);
                exceptionDates[mIdx].add(date);
                insertData.push([mIdx, Number(sIdx), date, 'holiday', '', currentTime]);
            }
        }

        // ─────────────────────────────────────────────────────
        // 5. 자동 출근 등록 (계약 근무일만) ← 핵심 변경 부분
        // ─────────────────────────────────────────────────────
        for (const staff of allStaffRes) {
            const mIdx = staff.idx;
            const position = staff.position;
            const workhours = contractMap[position]; // 직책에 맞는 계약 스케줄

            if (!workhours) {
                console.warn(`⚠️ position [${position}] 계약 스케줄 없음 → 직원 [${staff.name}] 자동출근 스킵`);
                continue;
            }

            const exceptions = exceptionDates[mIdx] || new Set();

            for (const date of allDates) {
                // 계약 근무일이 아니면 스킵 ← 핵심
                if (!isContractWorkDay(date, workhours)) continue;

                const key = `${mIdx}-${date}`;
                if (seen.has(key)) continue; // 예외로 이미 등록된 날짜
                seen.add(key);
                insertData.push([mIdx, Number(sIdx), date, 'work', '', currentTime]);
            }
        }

        console.log(`📋 총 등록 예정: ${insertData.length}건`);

        // DB 저장
        let successCount = 0;
        for (const data of insertData) {
            const resData = await workModel.workStart(data[0], data[1], data[2], data[3], data[4], data[5]);
            if (resData && resData.data !== '-9999') successCount++;
        }

        console.log(`✅ 저장 완료: ${successCount}건 성공`);

        res.status(200).json({
            result: true,
            count: successCount,
            total: insertData.length,
            message: `${insertData.length}건 중 ${successCount}건 등록 완료`
        });

    } catch (error) {
        console.error('❌ 오류:', error);
        res.status(500).json({ result: false, message: error.message || '서버 내부 오류' });
    }
};

exports.uploadExcel1 = async function (req, res) {
    console.log("\n===================================================");
    console.log("🚀 [근태 엑셀 업로드 v2] 프로세스 시작");
    console.log("===================================================\n");

    try {
        // ─────────────────────────────────────────────────────
        // 1. 요청 파라미터 검증
        // ─────────────────────────────────────────────────────
        const cIdx = req.user.cIdx;
        const { sIdx, month } = req.body; // month: "2026-01" 형식
        const file = req.file;

        if (!sIdx) return res.status(400).json({ result: false, message: "현장 인덱스(sIdx) 값이 없습니다." });
        if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ result: false, message: "month 파라미터가 없거나 형식이 올바르지 않습니다. (예: 2026-01)" });
        if (!file || !file.path) return res.status(400).json({ result: false, message: "파일이 업로드되지 않았습니다." });

        // ─────────────────────────────────────────────────────
        // 2. 엑셀 파일 읽기 (1행: 타이틀, 2행: 헤더, 3행: 안내, 4행~: 데이터)
        // ─────────────────────────────────────────────────────
        const workbook = xlsx.readFile(file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = xlsx.utils.sheet_to_json(sheet, {
            header: 1,
            range: 0,
            raw: true,   // 날짜를 시리얼 숫자로 받아서 직접 변환
            defval: ""
        });

        // 데이터 행: 4행(index 3)부터 읽기 (1행 타이틀, 2행 헤더, 3행 안내 제외)
        const dataRows = allRows.slice(3).filter(row => String(row[0] || '').trim());

        if (dataRows.length === 0) {
            return res.status(400).json({ result: false, message: "입력된 데이터가 없습니다." });
        }

        // ─────────────────────────────────────────────────────
        // 3. 해당 현장 전체 직원 목록 조회
        // ─────────────────────────────────────────────────────
        const allStaffRes = await memberModel.getStaffBySite(sIdx, cIdx);
        if (!allStaffRes || allStaffRes.length === 0) {
            return res.status(400).json({ result: false, message: "해당 현장에 등록된 직원이 없습니다." });
        }

        // 사번 → mIdx 매핑
        const staffMap = {}; // { "1001001": mIdx }
        for (const staff of allStaffRes) {
            staffMap[String(staff.memberId).trim()] = staff.idx;
        }

        // ─────────────────────────────────────────────────────
        // 4. 엑셀 파싱: 예외 직원 처리
        //    exceptionMap: { mIdx: Set<날짜> } - 예외로 등록된 날짜 (자동출근 제외용)
        //    insertData: 실제 DB 입력 배열
        // ─────────────────────────────────────────────────────
        const allDates = getAllDatesOfMonth(month);
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const seen = new Set();
        const insertData = [];

        // 엑셀에 등장한 사번 Set (자동출근 제외용)
        const excelMemberIds = new Set();

        // 직원별 예외 날짜 수집 (mIdx → Set<date>)
        const exceptionDates = {}; // mIdx → Set of dates that have explicit entry (not auto-work)

        for (const row of dataRows) {
            const memberId = String(row[0] || '').trim();
            if (!memberId) continue;

            const mIdx = staffMap[memberId];
            if (!mIdx) {
                console.warn(`⚠️ 사번 [${memberId}] 현장 소속 직원을 찾을 수 없습니다. 건너뜁니다.`);
                continue;
            }

            excelMemberIds.add(memberId);
            if (!exceptionDates[mIdx]) exceptionDates[mIdx] = new Set();

            // ── C열: 연차 ──
            const annualDates = parseDateList(row[2]);
            for (const date of annualDates) {
                const key = `${mIdx}-${date}`;
                if (seen.has(key)) continue;
                seen.add(key);
                exceptionDates[mIdx].add(date);
                insertData.push([mIdx, Number(sIdx), date, 'annual', '', currentTime]);
            }

            // ── D열: 반차 ──
            const halfDates = parseDateList(row[3]);
            for (const date of halfDates) {
                const key = `${mIdx}-${date}`;
                if (seen.has(key)) continue;
                seen.add(key);
                exceptionDates[mIdx].add(date);
                insertData.push([mIdx, Number(sIdx), date, 'half', '', currentTime]);
            }

            // ── E열: 대근 (대근자사번^날짜) ──
            // 원래직원(row[0]) → 해당 날짜 결근 등록
            // 대근자(subMemberId) → 해당 날짜 출근 등록
            const substituteList = parseSubstituteList(row[4]);
            for (const { subMemberId, date } of substituteList) {
                // 원래 직원 결근
                const absentKey = `${mIdx}-${date}`;
                if (!seen.has(absentKey)) {
                    seen.add(absentKey);
                    exceptionDates[mIdx].add(date);
                    insertData.push([mIdx, Number(sIdx), date, 'absent', `대근: ${subMemberId}`, currentTime]);
                }

                // 대근자 출근
                const subMIdx = staffMap[subMemberId];
                if (!subMIdx) {
                    console.warn(`⚠️ 대근자 사번 [${subMemberId}] 을 찾을 수 없습니다.`);
                    continue;
                }
                const workKey = `${subMIdx}-${date}`;
                if (!seen.has(workKey)) {
                    seen.add(workKey);
                    if (!exceptionDates[subMIdx]) exceptionDates[subMIdx] = new Set();
                    exceptionDates[subMIdx].add(date);
                    insertData.push([subMIdx, Number(sIdx), date, 'work', `대근: ${memberId} 대체`, currentTime]);
                }
            }

            // ── F열: 특근 ──
            const holidayDates = parseDateList(row[5]);
            for (const date of holidayDates) {
                const key = `${mIdx}-${date}`;
                if (seen.has(key)) continue;
                seen.add(key);
                exceptionDates[mIdx].add(date);
                insertData.push([mIdx, Number(sIdx), date, 'holiday', '', currentTime]);
            }
        }

        // ─────────────────────────────────────────────────────
        // 5. 자동 출근 등록
        //    ① 엑셀에 없는 직원 → 해당 월 전체 자동 출근
        //    ② 엑셀에 있는 직원 → 예외 날짜 제외한 나머지 자동 출근
        // ─────────────────────────────────────────────────────
        for (const staff of allStaffRes) {
            const memberId = String(staff.memberId).trim();
            const mIdx = staff.idx;
            const exceptions = exceptionDates[mIdx] || new Set();

            for (const date of allDates) {
                const key = `${mIdx}-${date}`;
                if (seen.has(key)) continue; // 이미 예외 등록된 날짜
                seen.add(key);
                insertData.push([mIdx, Number(sIdx), date, 'work', '', currentTime]);
            }
        }

        console.log(`📋 총 등록 예정: ${insertData.length}건 (예외: ${seen.size - insertData.filter(d => d[3]==='work').length + '건'} 포함)`);

        // ─────────────────────────────────────────────────────
        // 6. DB 저장
        // ─────────────────────────────────────────────────────
        let successCount = 0;
        for (const data of insertData) {
            const resData = await workModel.workStart(data[0], data[1], data[2], data[3], data[4], data[5]);
            if (resData && resData.data !== '-9999') successCount++;
        }

        console.log(`✅ 저장 완료: ${insertData.length}건 중 ${successCount}건 성공\n`);

        res.status(200).json({
            result: true,
            count: successCount,
            total: insertData.length,
            message: `${insertData.length}건 중 ${successCount}건 등록 완료`
        });

    } catch (error) {
        console.error('❌ 근태 엑셀 업로드 오류:', error);
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

exports.bulkRegisterWork = async function (req, res) {
    console.log("\n===================================================");
    console.log("🚀 [월 출근 일괄 등록] 시작");
    console.log("===================================================\n");

    try {
        const cIdx = req.user.cIdx;
        const { sIdx, month } = req.body;

        if (!sIdx) return res.status(400).json({ result: false, message: 'sIdx가 없습니다.' });
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({ result: false, message: 'month 형식이 올바르지 않습니다. (예: 2026-04)' });
        }

        // ── 1. 현장 직원 목록 조회
        const staffList = await memberModel.getStaffBySite(sIdx, cIdx);
        if (!staffList || staffList.length === 0) {
            return res.status(400).json({ result: false, message: '해당 현장에 등록된 직원이 없습니다.' });
        }
        console.log(`👥 직원 ${staffList.length}명 조회 완료`);

        // ── 2. 현장 근로계약 스케줄 조회 (최신 계약 기준, 직책별 전체)
        const contractList = await workModel.getWorkScheduleBySite(sIdx);
        if (!contractList || contractList.length === 0) {
            return res.status(400).json({ result: false, message: '등록된 근로계약이 없습니다.' });
        }

        // position → workhours 매핑
        const contractMap = {};
        for (const c of contractList) {
            contractMap[c.position] = typeof c.workhours === 'string'
                ? JSON.parse(c.workhours)
                : c.workhours;
        }
        console.log('🗺️ contractMap keys:', Object.keys(contractMap));
        const deleted = await workModel.deleteWorkByMonth(sIdx, month);
        console.log(`🗑️ 기존 데이터 삭제: ${deleted.affectedRows}건`);

        // ── 3. 해당 월 전체 날짜 생성
        const allDates = getAllDatesOfMonth(month);
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        let successCount = 0;
        let skippedCount = 0;
        let noContractCount = 0;

        // ── 4. 직원별 계약 근무일만 등록
        for (const staff of staffList) {
            const workhours = contractMap[staff.position];

            if (!workhours) {
                console.warn(`⚠️ [${staff.name}] position(${staff.position}) 계약 없음 → 스킵`);
                noContractCount++;
                continue;
            }

            // ── 퇴사자 처리: 퇴사일 이후 날짜는 등록 안 함 ──
            const outDate = (staff.status === 1 && staff.outDate)
                ? staff.outDate.toISOString
                    ? staff.outDate.toISOString().split('T')[0]  // Date 객체인 경우
                    : String(staff.outDate).split('T')[0]        // 문자열인 경우
                : null;

            if (outDate) {
                console.log(`👋 [${staff.name}] 퇴사자 - 퇴사일: ${outDate} 이후 날짜 제외`);
            }

            for (const date of allDates) {
                // 퇴사일 이후면 스킵
                if (outDate && date > outDate) continue;
                // date > outDate  →  스킵 (퇴사일 이후)
                // date <= outDate →  계약 근무일이면 등록 (퇴사일 당일 포함)

                // 계약 근무일 아니면 스킵
                if (!isContractWorkDay(date, workhours)) continue;

                // 이미 등록된 날짜면 스킵 (중복 방지)
                const existing = await workModel.getWorkByDate(staff.idx, sIdx, date);
                if (existing && existing.length > 0) {
                    skippedCount++;
                    continue;
                }

                const result = await workModel.workStart(
                    staff.idx,
                    Number(sIdx),
                    date,
                    'work',
                    '',
                    currentTime
                );

                if (result && result.data !== '-9999') {
                    successCount++;
                } else {
                    console.warn(`⚠️ workStart 실패: mIdx=${staff.idx}, date=${date}`);
                }
            }
        }

        console.log(`✅ 완료 - 등록: ${successCount}건, 중복스킵: ${skippedCount}건, 계약없음: ${noContractCount}명`);

        res.status(200).json({
            result: true,
            success: successCount,
            skipped: skippedCount,
            message: `${successCount}건 등록 완료 (중복 ${skippedCount}건 스킵)`
        });

    } catch (error) {
        console.error('❌ 일괄 등록 오류:', error);
        res.status(500).json({ result: false, message: error.message || '서버 오류' });
    }
};

/**
 * 계약 근무일 여부 판단
 * workhours 형식: {"0": {"isActive": false, "isBiweekly": false, ...}, "1": {...}, ...}
 */
function isContractWorkDay(date, workhours) {
    if (!workhours) return false;

    // 격일제 처리
    if (workhours.type === 'alternate') {
        const start = new Date(workhours.startDt);
        const target = new Date(date);
        const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays % 2 === 0;
    }

    // 요일제 처리 - isActive 기반
    const dayOfWeek = String(new Date(date).getDay()); // "0"=일 ~ "6"=토
    const dayConfig = workhours[dayOfWeek];

    // 해당 요일 설정 없거나 비활성이면 비근무일
    if (!dayConfig || !dayConfig.isActive) return false;

    // 격주(isBiweekly) 처리
    if (dayConfig.isBiweekly) {
        const weekNum = getWeekOfDayInMonth(new Date(date));
        return weekNum % 2 === 1; // 홀수주만 근무 (필요시 짝수주로 변경)
    }

    return true;
}

// ── 해당 월에서 N번째 같은 요일인지
function getWeekOfDayInMonth(date) {
    const dayOfWeek = date.getDay();
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    let count = 0;
    let curr = new Date(first);
    while (curr <= date) {
        if (curr.getDay() === dayOfWeek) count++;
        curr.setDate(curr.getDate() + 1);
    }
    return count;
}
