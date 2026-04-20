const memberModel = require("../model/member.model")
const contractModel = require("../model/contract.model")
const settleModel = require("../model/settle.model")
const workModel = require("../model/work.model")
const bcrypt  = require("bcrypt");
const crypto = require("crypto");
const { encryptRRN, decryptRRN, hashPassword} = require("../utils/password");
const xlsx = require("xlsx");

//관리자 등록
exports.registerManager = async function (req, res) {
    let cIdx = req.body.cIdx,
        managerId = req.body.managerId,
        managerNm = req.body.managerNm,
        password = req.body.password,
        email = req.body.email,
        phone = req.body.phone,
        isMaster = req.body.isMaster;

    const hash = await bcrypt.hash(req.body.password, 10);

    if(!cIdx) return res.json({'result': false, 'msg':'회사 정보가 없습니다.'});
    if(!managerId) return res.json({'result': false, 'msg':'관리자 아이디가 없습니다.'});

    let result = await memberModel.registerManager(cIdx, managerId, managerNm, hash, email, phone, isMaster);

    res.json({'result': true, 'data': result})
}

exports.getManagerList = async function (req, res) {
    let cIdx = req.params.cIdx;

    let result = await memberModel.getManagerList(cIdx);

    res.json({'result': true, 'data': result})
}

exports.deleteManager = async function (req, res) {
    let managerId = req.params.managerId;

    let result = await memberModel.deleteManager(managerId);

    res.json({'result': true, 'data': result})
}

//직원 리스트 조회
exports.getMemberList = async function (req, res) {
    let cIdx = req.user.cIdx || 1;
    try {
        let result = await memberModel.getMemberList(cIdx);
        const safeResult = result.map(member => {
            const { password, ...safeMember } = member;  // password만 분리하고 나머지
            return safeMember;
        });

        res.json({'result': true, 'data': safeResult})
    } catch(err) {
        res.json({'result': false, 'msg': '회원정보를 찾을 수 없습니다.'})
    }
}

exports.getMemberRRNBatch = async function (req, res) {
    try {
        const { mIdxList } = req.body;
        const cIdx = req.user?.cIdx; // 미들웨어에서 세션/토큰으로 주입
        const adminId = req.user?.id;

        let clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
        // x-forwarded-for 가 여러 IP의 콤마 배열로 들어올 경우 첫 번째 IP만 추출
        if (clientIp && clientIp.includes(',')) {
            clientIp = clientIp.split(',')[0].trim();
        }

        if (!mIdxList || !mIdxList.length) {
            return res.status(400).json({ result: false, message: '회원 리스트 정보가 없습니다.' });
        }

        const data = await memberModel.getMemberRRNBatch(mIdxList, adminId, cIdx, clientIp);
        res.status(200).json({ result: true, data });
    } catch (e) {
        console.error('RRN batch 오류:', e);
        res.status(500).json({ result: false, message: '서버 오류' });
    }
};

//직원 데이터 조회
exports.getMemberData = async function (req, res) {
    let id = req.params.id;

    let result = await memberModel.getMemberData(id);
    if(result.length > 0) delete result?.[0].password;

    res.json({'result': true, 'data': result})
}

exports.getMemberAvailable = async function (req, res) {
    let cIdx = req.user.cIdx,
        sIdx = req.query.sIdx;

    try {
        let result = await memberModel.getMemberAvailable(sIdx, cIdx);
        result.forEach(member => { delete member.password;});
        res.json({'result': true, 'data': result})
    } catch (e) {
        console.error('getMemberAvailable Error:', e);
        res.json({result: false, msg: '조회 중 오류가 발생했습니다.'});
    }
}

exports.setMemberData1 = async function (req, res) {
    console.log(req.body, req.file);
    try {
        const memberData = JSON.parse(req.body.memberData);
        const contractData = JSON.parse(req.body.contractData);

        // 업로드된 파일 정보 확인
        const uploadedFile = req.file;

        //비밀번호 해시
        const hash = await bcrypt.hash(memberData.password, 10);

        // 직원 정보 DB 저장
        let memberResult = await memberModel.setMemberData(
            memberData.type, memberData.name, memberData.id, hash, memberData.birthDate, memberData.phone,
            memberData.position, null, memberData.gender, memberData.email,
            memberData.disability, memberData.disability_date, memberData.disability_grade,
            memberData.defector, memberData.patriot, memberData.intern, memberData.beneficiary,
            memberData.foreigner, memberData.nationality, memberData.visa_code, memberData.visa_date,
            memberData.bankName, memberData.accountNumber, memberData.joinDate, memberData.endDate,
            memberData.departureReason, memberData.address, memberData.bigo
        );

        const mIdx = memberResult.insertId;
        if (mIdx && uploadedFile) {

            const jsonString = JSON.stringify(contractData.jsonData);

            await contractModel.setMemberContract(
                mIdx,           // mIdx (방금 만든 직원 ID)
                contractData.sIdx,      // sIdx
                contractData.type,      // type
                jsonString,             // jsonData
                uploadedFile.filename,  // filePath (파일명 또는 전체 경로)
                contractData.startDt,   // startDt
                contractData.endDt,     // endDt
                contractData.bigo       // bigo
            );
        }

        res.json({ result: true, msg: '등록 성공' });

    } catch (e) {
        console.error('Registration Error:', e);
        res.json({result: false, msg: '등록 중 오류가 발생했습니다.'});
    }
}

exports.setMemberData = async function(req, res) {
    console.log(req.body)
    //return;
    let type = req.body.type,
        name = req.body.name,
        id = req.body.id,
        password = req.body.password,
        birthDt = req.body.birthDate,
        phone = req.body.phone,
        position = req.body.position,
        contract = req.body.contract,
        gender = req.body.gender,
        email = req.body.email,
        disability = req.body.disability,
        disability_date = req.body.disability_date,
        disability_grade = req.body.disability_grade,
        defector = req.body.defector,
        patriot = req.body.patriot,
        intern = req.body.intern,
        beneficiary = req.body.beneficiary,
        foreigner = req.body.foreigner,
        nationality = req.body.nationality,
        visa_code = req.body.visa_code,
        visa_date = req.body.visa_date,
        bank = req.body.bank,
        accountNumber = req.body.accountNumber,
        inDate = req.body.joinDate,
        outDate = req.body.outDate,
        outReason = req.body.outReason,
        addr = req.body.address,
        bigo = req.body.bigo;

    console.log(id, password)

    // const hash = await hashPassword(password);
    const hash = await bcrypt.hash(password, 10); // 비밀번호 해시

    let result = await memberModel.setMemberData(
        type, name, id, hash, birthDt, phone, position, contract, gender, email,
        disability, disability_date, disability_grade, defector, patriot, intern, beneficiary, foreigner, nationality, visa_code, visa_date,
        bank, accountNumber, inDate, outDate, outReason, address, bigo
    )

    res.json({'result': true, 'data': result})
}

exports.getMemberLeave = async function (req, res) {
    let cIdx = req.user.cIdx;

    let result = await memberModel.getMemberLeave(cIdx)

    res.json({'result': true, 'data': result})
}

//직원 연차 저장
exports.setMemberLeave = async function (req, res) {
    let mIdx = req.body.mIdx,
        sIdx = req.body.sIdx,
        name = req.body.name,
        type = req.body.type,
        year = req.body.year,
        middleDt = req.body.middleDt,
        totalCount = req.body.totalCount,
        overCount = req.body.overCount,
        usedCount = req.body.usedCount,
        bigo = req.body.bigo,
        regDt = new Date();

    let result = await memberModel.setMemberLeave(mIdx, sIdx, name, type, year, middleDt, totalCount, overCount, usedCount, bigo, regDt);

    res.json({'result': true, 'data': result})
}

exports.updateMemberLeave = async function (req, res) {
    let mIdx = req.body.mIdx,
        year = req.body.year,
        totalCount = req.body.totalCount,
        overCount = req.body.overCount,
        usedCount = req.body.usedCount,
        bigo = req.body.bigo,
        modDt = new Date();

    let result = await memberModel.updateMemberLeave(mIdx, year, totalCount, overCount, usedCount, bigo, modDt);

    res.json({'result': true, 'data': result})
}

//연차 정산
exports.setAnnualSettlement = async function (req, res) {
    try {
        // 1. 프론트엔드(Vue)에서 보낸 데이터 변수 매핑
        let mIdx = req.body.mIdx,
            sIdx = req.body.sIdx,
            year = req.body.year,             // ★ 연차 귀속 연도 추가
            payCount = req.body.settleDays,   // 프론트의 settleDays (정산 일수)
            settleDt = req.body.settleDate,   // 프론트의 settleDate (정산일)
            amount = req.body.settleAmount;   // 프론트의 settleAmount (금액)

        // 2. 연차 차감 로직 (new_tb_member_annual_leave)
        let result = await memberModel.setAnnualSettlement(mIdx, sIdx, year, payCount, settleDt);

        // 3. 바로 이어서 정산서(new_tb_site_settlement) 등록
        const cIdx = req.body.cIdx;
        const month = req.body.month;
        const billingData = req.body.billingData || [];

        const strBillingData = JSON.stringify(billingData);
        const strPayrollData = JSON.stringify({});
        const strViewConfig = JSON.stringify({});

        let settleResult = await settleModel.setSettleData(
            sIdx,
            cIdx,
            year,
            month,
            'RETIRE_ANNUAL',
            null,
            null,
            settleDt,       // billingDt
            amount,         // subTotal
            0,     // vatAmount
            amount,         // grandTotal
            strBillingData,
            strPayrollData,
            strViewConfig
        );

        res.json({'result': true, 'data': result, 'settleId': settleResult.insertId});

    } catch (err) {
        console.error("연차 정산 에러:", err);
        res.status(500).json({'result': false, 'msg': '연차 정산 처리 중 오류가 발생했습니다.'});
    }
}

exports.setMemberOff = async function (req, res) {
    let mIdx = req.params.mIdx,
        sIdx = req.body.sIdx,
        startDt = req.body.startDt,
        endDt = req.body.endDt,
        reason = req.body.reason;

    console.log(mIdx, sIdx, startDt, endDt, reason);
    let result = await memberModel.setMemberOff(mIdx, sIdx, startDt, endDt, reason);

    res.json({'result': true, 'data': result})
}

exports.getMemberOff = async function (req, res) {
    let cIdx = req.params.cIdx,
        startDt = req.query.startDt,
        endDt = req.query.endDt;

    let result = await memberModel.getMemberOff(cIdx, startDt, endDt);

    res.json({'result': true, 'data': result})
}

exports.updateOffStatus = async function (req, res) {
    const { idx, status } = req.body;

    try {
        // 1. 상태 업데이트 실행
        let result = await memberModel.updateOffStatus(idx, status);

        // 2. 승인(status == 1)일 경우에만 출근 데이터 등록
        if (status == 1) {
            const offInfo = await memberModel.getMemberOffDetail(idx);

            if (offInfo && offInfo.startDt && offInfo.endDt) {
                const { mIdx, sIdx, startDt, endDt } = offInfo;
                const workType = 'OFF';
                const bigo = '연차 승인 자동 등록';
                const regDt = new Date();

                // 날짜 처리를 위해 Date 객체 생성
                let currentDate = new Date(startDt);
                const lastDate = new Date(endDt);

                // 시작일부터 종료일까지 하루씩 증가하며 반복문 실행
                while (currentDate <= lastDate) {
                    // YYYY-MM-DD 형식으로 변환 (workStart 함수가 문자열을 받는 경우 대비)
                    const formattedDate = currentDate.toISOString().split('T')[0];

                    // 각 날짜별로 출근 데이터 생성
                    await workModel.workStart(mIdx, sIdx, formattedDate, workType, bigo, regDt);

                    // 다음 날로 이동
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
        }

        res.json({ 'result': true, 'data': result });

    } catch (e) {
        console.error('연차 승인 중 에러:', e);
        res.status(500).json({ result: false, message: '처리 중 서버 에러가 발생했습니다.' });
    }
}

exports.setMemberStaffing = async function (req, res) {
    let mIdx = req.params.mIdx,
        sIdx = req.body.sIdx;

    let result = await memberModel.setMemberStaffing(mIdx, sIdx)

    res.json({'result': true, 'data': result})
}

exports.updateMemberStaffing = async function (req, res) {
    let idx = req.params.idx;

    let result = await memberModel.updateMemberStaffing(idx)

    res.json({'result': true, 'data': result})
}

exports.registerFullMember = async function (req, res) {
    try {
        const body = req.body;
        console.log('전체 등록 요청 데이터:', body);

        // 비밀번호 해시화
        const hash = await bcrypt.hash(body.password, 10);

        // 주민번호 해시화
        const fullRrn = (body.firstNumber && body.lastNumber)
            ? `${body.firstNumber}-${body.lastNumber}`
            : null;
        const encryptedRrn = encryptRRN(fullRrn);
        // 2. 모델에 넘길 데이터 구조화
        // (1) Member 데이터
        const memberData = {
            cIdx: body.cIdx,
            type: body.type,
            name: body.name,
            id: body.id,
            password: hash, // 해시된 비밀번호
            birthDt: body.birthDate || null,
            rrn: encryptedRrn, // 해시된 주민번호
            phone: body.phone,
            position: body.position,
            gender: body.gender,
            email: body.email,
            disability: body.disability,
            disability_date: body.disability_date || null,
            disability_grade: body.disability_grade,
            defector: body.defector,
            patriot: body.patriot,
            intern: body.intern,
            beneficiary: body.beneficiary,
            foreigner: body.foreigner,
            nationality: body.nationality,
            visa_code: body.visa_code,
            visa_date: body.visa_date || null,
            etc_name_1: body.etc_name_1,
            etc_value_1: body.etc_value_1,
            etc_name_2: body.etc_name_2,
            etc_value_2: body.etc_value_2,
            etc_name_3: body.etc_name_3,
            etc_value_3: body.etc_value_3,
            bank: body.bankName,
            accountNumber: body.accountNumber,
            inDate: body.joinDate || null,
            outDate: body.outDate || null,
            outReason: body.endReason, // 필요시 추가
            status: body.status,
            address: body.address,
            bigo: body.bigo
        };

        // (2) Contract 데이터
        const contractData = {
            sIdx: body.site,      // 현장 ID
            type: body.type,      // 계약 타입 (직원 구분 등)
            jsonData: JSON.stringify(body.wageInputs || {}), // 급여 정보 JSON화
            contractStartDt: body.contractData.contractStartDt || null,
            contractEndDt: body.contractData.contractEndDt || null,
            bigo: body.bigo
        };

        // (3) Staffing 데이터
        const staffingData = {
            sIdx: body.site       // 현장 ID
        };

        // 3. 통합 모델 함수 호출
        const result = await memberModel.registerMemberWithContractAndStaffing(
            memberData,
            contractData,
            staffingData
        );

        if (result.result) {
            res.json({ result: true, data: result.mIdx, message: '직원 및 계약 등록 완료' });
        } else {
            res.json({ result: false, message: '등록 중 오류 발생', error: result.error });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ result: false, message: '서버 에러' });
    }
}

exports.updateMemberData = async function (req, res) {
    try {
        const mIdx = req.params.idx;
        const body = req.body;

        let hashedPassword = null;
        if (body.password) {
            hashedPassword = await bcrypt.hash(body.password, 10);
        }

        const memberData = {
            type: body.typeCd || body.type,
            name: body.name,
            id: body.id,
            password: hashedPassword,
            birthDt: body.birthDt,
            phone: body.phone,
            position: body.position,
            gender: body.gender,
            email: body.email,
            disability: body.disability || 'N',
            disability_date: body.disability_date || null,
            disability_grade: body.disability_grade || null,
            defector: body.defector,
            patriot: body.patriot,
            intern: body.intern,
            beneficiary: body.beneficiary,
            foreigner: body.foreigner || 'N',
            nationality: body.nationality || null,
            visa_code: body.visa_code || null,
            visa_date: body.visa_date || null,
            bank: body.bankName,
            accountNumber: body.accountNumber,
            inDate: body.joinDate,
            outDate: body.status == '1' ? body.endDate : null,
            outReason: body.status == '1' ? body.endReason : null,
            addr: body.address,
            bigo: body.bigo,
            status: body.status,
            retirePension: body.retire_pension,
            fourInsurance: body.four_ins,
        };

        const contractData = {
            sIdx: body.sIdx,
            type: body.typeCd || body.type,
            jsonData: JSON.stringify(body.wageInputs || {}),
            startDt: body.contractStartDt,
            endDt: body.contractEndDt,
            bigo: body.bigo
        };

        const staffingData = {
            sIdx: body.sIdx
        };

        const result = await memberModel.updateMemberWithContractAndStaffing(
            mIdx,
            memberData,
            contractData,
            staffingData
        );

        if (result.result) {
            res.json({ result: true, message: '직원 정보 수정 완료' });
        } else {
            res.json({ result: false, message: '수정 중 오류 발생', error: result.error });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ result: false, message: '서버 에러' });
    }
};

exports.uploadExcel = async function (req, res) {
    try {
        const { sIdx } = req.body; // 프론트에서 선택한 현장 idx
        const file = req.file;

        if (!sIdx) return res.status(400).json({ result: false, message: "배치할 현장을 선택해주세요." });
        if (!file) return res.status(400).json({ result: false, message: "파일이 업로드되지 않았습니다." });

        // 엑셀 파싱 (날짜 형식 유지)
        const workbook = xlsx.read(file.buffer, { type: 'buffer', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

        let successCount = 0;
        let failList = [];

        for (const row of rows) {
            try {
                const memberId = String(row['사번'] || '').trim();
                // if (!memberId) continue; // 사번 없으면 스킵

                // 1. 비밀번호 해시화 (초기 비밀번호는 사번으로 설정)
                const hash = await bcrypt.hash(memberId, 10);

                // 2. 데이터 구조화 (엑셀 한글 헤더 매핑)
                const memberData = {
                    type: row['구분(경비/미화)'] === '경비' ? 'S' : 'C',
                    name: row['이름'],
                    id: memberId,
                    password: hash,
                    birthDt: row['생년월일'],
                    phone: row['연락처'],
                    position: row['직위'],
                    gender: row['성별'] === '남' ? 'M' : 'F',
                    email: row['이메일'] || '',
                    disability: row['장애여부(Y/N)'] || 'N',
                    disability_date: row['장애등록일'],
                    disability_grade: row['장애등급'],
                    defector: row['새터민여부(Y/N)'] || 'N',
                    patriot: row['국가유공자여부(Y/N)'] || 'N',
                    intern: row['청년인턴(Y/N)'] || 'N',
                    beneficiary: row['기초생활수급자(Y/N)'] || 'N',
                    foreigner: row['외국인여부(Y/N)'] || 'N',
                    nationality: row['국적'],
                    visa_code: row['비자코드'],
                    visa_date: row['비자만료일'],
                    bank: row['은행'],
                    accountNumber: row['계좌번호'],
                    inDate: row['입사일'],
                    outDate: row['퇴사일'],
                    outReason: row['사직사유'],
                    addr: row['주소'],
                    bigo: row['비고']
                };

                // 계약 데이터 최소화 (엑셀에 없는 정보는 기본값 처리)
                const contractData = {
                    sIdx: sIdx, // 프론트에서 받은 현장 ID
                    type: memberData.type,
                    jsonData: JSON.stringify({}), // 급여 정보는 빈 객체로 생략
                    startDt: '',
                    endDt: '',
                    bigo: ''
                };

                const staffingData = {
                    sIdx: sIdx // 프론트에서 받은 현장 ID
                };

                // 3. 통합 모델 함수 호출
                const result = await memberModel.registerMemberWithContractAndStaffing(
                    memberData,
                    contractData,
                    staffingData
                );

                if (result.result) successCount++;
                else failList.push({ id: memberId, name: row['이름'], error: result.error });

            } catch (innerErr) {
                failList.push({ id: row['사번'], reason: innerErr.message });
            }
        }

        res.json({
            result: true,
            message: `${successCount}건 등록 완료`,
            total: rows.length,
            success: successCount,
            fails: failList
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ result: false, message: '서버 에러' });
    }
};

exports.deleteMember = async function (req, res) {
    let mId = req.params.id;
    console.log(mId, 'deleteMember')

    let result = await memberModel.deleteMember(mId);
    res.json({'result': true, 'data': result});
}
