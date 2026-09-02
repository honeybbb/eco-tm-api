const memberModel = require("../model/member.model")
const contractModel = require("../model/contract.model")
const settleModel = require("../model/settle.model")
const workModel = require("../model/work.model")
const bcrypt  = require("bcrypt");
const crypto = require("crypto");
const { encryptRRN, decryptRRN, hashPassword} = require("../utils/password");
const xlsx = require("xlsx");
const siteModel = require("../model/site.model");

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
    let cIdx = req.user.cIdx;

    if(!cIdx) return res.json({'result': false, 'msg': '회사 정보가 없습니다. 로그인을 다시 해주세요.'})

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
    let cIdx = req.user.cIdx,
        id = req.params.id;

    let result = await memberModel.getMemberData_v2(id, cIdx);
    if (result.length > 0) {
        let member = result[0];

        // 2. 비밀번호 제거
        delete member.password;

        // 3. 주민번호 복호화 및 앞/뒷자리 분리
        member.firstNumber = '';
        member.lastNumber = '';

        if (member.rrn) {
            try {
                // 이전에 만드신 복호화 함수를 사용해 평문으로 변환
                let decryptedRrn = decryptRRN(member.rrn);

                // 혹시 모를 하이픈(-)이나 특수문자 제거 후 숫자만 남기기
                let cleanRrn = decryptedRrn.replace(/[^0-9]/g, '');

                // 총 13자리가 맞다면 6자리, 7자리로 쪼개서 담아주기
                if (cleanRrn.length === 13) {
                    member.firstNumber = cleanRrn.substring(0, 6);
                    member.lastNumber = cleanRrn.substring(6, 13);
                }
            } catch (err) {
                console.error('주민번호 복호화 중 에러 발생:', err);
            }
        }
    }

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
        // name = req.body.name,
        type = req.body.mType,
        year = req.body.year,
        middleDt = req.body.middleDt,
        totalCount = req.body.totalCount,
        overCount = req.body.overCount,
        usedCount = req.body.usedCount,
        payCount = req.body.payCount,
        bigo = req.body.bigo,
        regDt = new Date();

    console.log(mIdx, sIdx, type, year, middleDt, totalCount, overCount, usedCount, bigo, regDt)

    let result = await memberModel.setMemberLeave(mIdx, sIdx, type, year, middleDt, totalCount, overCount, usedCount, payCount, bigo, regDt);

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
    let cIdx = req.user.cIdx,
        mIdx = req.params.mIdx,
        sIdx = req.body.sIdx,
        startDt = req.body.startDt,
        endDt = req.body.endDt,
        reason = req.body.reason;

    console.log(cIdx, mIdx, sIdx, startDt, endDt, reason);
    let result = await memberModel.setMemberOff(cIdx, mIdx, sIdx, startDt, endDt, reason);

    res.json({'result': true, 'data': result})
}

exports.getMemberOff = async function (req, res) {
    let cIdx = req.user.cIdx,
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
            mType: body.member_type,
            cIdx: body.cIdx,
            type: body.type,
            name: body.name,
            billingName: body.billingName,
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
            accountNm: body.accountNm,
            accountNumber: body.accountNumber,
            four_ins: body.four_ins,
            retire_pension: body.retire_pension,
            inDate: body.joinDate || null,
            outDate: body.outDate || null,
            outReason: body.outReason,
            transferDate: body.transferDate || null,
            status: body.status,
            address: body.address,
            // bigo: body.bigo
        };

        // -----------------------------------------------------
        // 입사/퇴사일 누적용 데이터 정규화 배열
        // -----------------------------------------------------
        let normalizedPeriods = [];

        if (body.status === '2' || body.status === '3') {
            // 일용직(2) 또는 대근(3)인 경우 다중 periodsData 배열 사용
            if (Array.isArray(body.periodsData) && body.periodsData.length > 0) {
                normalizedPeriods = body.periodsData.map(p => ({
                    status: body.status,
                    startDate: p.startDate || null,
                    endDate: p.endDate || null,
                    outReason: p.outReason || ''
                }));
            }
        } else {
            // 재직(0), 퇴사(1), 휴직(4)인 경우 기본 폼의 joinDate, outDate 사용
            normalizedPeriods.push({
                status: body.status,
                startDate: body.joinDate || null,
                endDate: body.outDate || null,
                outReason: body.outReason || ''
            });
        }

        // 비고 누적용 데이터
        const bigoLogs = {
            bigo: body.bigo,           // type: '1'
            payrollBigo: body.payrollBigo,  // type: '2'
            // admin_id: body.id           //토큰/세션에서 가져온 등록자 ID
        };

        const wageInputs = body.contractData?.wageInputs || {};
        const payItems = {};
        const deductionItems = {};

        Object.keys(wageInputs).forEach(key => {
            if (key.startsWith('04001')) {
                payItems[key] = wageInputs[key];
            } else if (key.startsWith('04002')) {
                deductionItems[key] = wageInputs[key];
            }
        });

        // (2) Contract 데이터
        const contractData = {
            sIdx: body.site,      // 현장 ID
            type: body.type,      // 계약 타입 (직원 구분 등)
            // jsonData: JSON.stringify(body.contractData.wageInputs || {}), // 급여 정보 JSON화
            dayWorkTime: body.dayWorkTime,
            monthWorkTime: body.monthWorkTime,
            payItems: JSON.stringify(payItems),         // 지급 항목 분리
            deductionItems: JSON.stringify(deductionItems), // 공제 항목 분리
            workSchedule: JSON.stringify(body.contractData?.workSchedule || {}), //근무 스케줄 JSON화
            startDt: body.contractData?.contractStartDt || null,
            endDt: body.contractData?.contractEndDt || null,
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
            staffingData,
            bigoLogs,
            normalizedPeriods
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

exports.registerBulkMember = async (req, res) => {
    try {
        const cIdx = req.user.cIdx;   // 인증 미들웨어를 통해 설정된 회사 식별자
        const sIdx = req.body.sIdx,
            type = req.body.type,
            members = req.body.members; // validItems 배열

        console.log(`일괄 등록 확인 - 현장 ID: ${sIdx}, 요청 인원: ${members?.length || 0}명`);

        if (!sIdx || !members || !Array.isArray(members) || members.length === 0) {
            return res.json({ result: false, message: '현장 및 등록할 직원 데이터가 없습니다.' });
        }

        const results = [];
        let successCount = 0;
        let failCount = 0;

        // "O", "Y" 등을 DB에 들어갈 Y/N으로 변환하는 함수
        const toYn = (val) => {
            if (!val) return 'N';
            const str = String(val).trim().toUpperCase();
            return (str === 'Y' || str === 'O' || str === '예' || str === 'TRUE') ? 'Y' : 'N';
        };

        // 성별 포맷 통일
        const getGender = (val) => {
            if (!val) return null;
            const str = String(val).trim();
            if (str === '남' || str === 'M' || str === '男') return 'M';
            if (str === '여' || str === 'F' || str === '女') return 'F';
            return null;
        };

        // For ... of 반복문을 사용하여 트랜잭션 순차 진입 (async/await 보장)
        for (const item of members) {
            try {
                // 1. 비밀번호 해시화 (1234로 임시 발급)
                const defaultPassword = '1234';
                const hash = await bcrypt.hash(defaultPassword, 10);

                // 2. 주민번호 암호화 및 생년월일(birthDt) 추출
                let birthDt = null;
                let encryptedRrn = null;

                if (item.rrn) {
                    const rrnStr = String(item.rrn).replace(/[^0-9-]/g, ''); // 숫자와 하이픈만 남기기
                    encryptedRrn = encryptRRN(rrnStr);

                    let front = '';
                    let back = '';

                    // 하이픈 분리 또는 전체 자릿수 기준으로 앞/뒷자리 분리
                    if (rrnStr.includes('-')) {
                        const parts = rrnStr.split('-');
                        front = parts[0];
                        back = parts[1] || '';
                    } else if (rrnStr.length === 13) {
                        front = rrnStr.substring(0, 6);
                        back = rrnStr.substring(6);
                    }

                    if (front.length === 6) {
                        const yy = front.substring(0, 2);
                        const mm = front.substring(2, 4);
                        const dd = front.substring(4, 6);

                        // 뒷자리 첫 번째 숫자로 세기(Century) 판별
                        // 1, 2, 5, 6 -> 1900년대 / 3, 4, 7, 8 -> 2000년대 / 9, 0 -> 1800년대
                        let century = '19';
                        if (back.length > 0) {
                            const centuryDigit = back.charAt(0);
                            if (['3', '4', '7', '8'].includes(centuryDigit)) {
                                century = '20';
                            } else if (['9', '0'].includes(centuryDigit)) {
                                century = '18';
                            }
                        } else {
                            // 뒷자리가 전달되지 않은 경우, 현재 연도(26년) 기준으로 대략적 추론
                            century = parseInt(yy, 10) > 26 ? '19' : '20';
                        }

                        birthDt = `${century}${yy}-${mm}-${dd}`;
                    }
                }

                // 3. 모델에 넘길 데이터 구조화

                // (1) Member 데이터
                const memberData = {
                    cIdx: cIdx,
                    type: type, // 일괄등록 시 기본 직원 구분 코드 (경비/미화)
                    name: item.name,
                    id: item.empNo || null, // 사번을 ID로 활용
                    password: hash,
                    birthDt: birthDt, // 추출 및 가공된 생년월일(yyyy-mm-dd) 주입
                    rrn: encryptedRrn,
                    phone: item.phone || null,
                    position: item.position || null,
                    gender: getGender(item.gender),
                    email: null,

                    disability: toYn(item.disability),
                    disability_date: item.disability_date || null,
                    disability_grade: item.disability_grade || null,

                    defector: toYn(item.defector),
                    patriot: toYn(item.patriot),
                    intern: toYn(item.intern),
                    beneficiary: toYn(item.beneficiary),
                    foreigner: toYn(item.foreigner),

                    nationality: item.nationality || null,
                    visa_code: item.visa_code || null,
                    visa_date: item.visa_date || null,

                    etc_name_1: null, etc_value_1: null,
                    etc_name_2: null, etc_value_2: null,
                    etc_name_3: null, etc_value_3: null,

                    bank: item.bankName || null,
                    accountNm: item.accountNm || item.name, // 예금주가 입력 안되어 있으면 본인 이름
                    accountNumber: item.accountNumber || null,

                    four_ins: toYn(item.insurance),
                    retire_pension: toYn(item.retirementPension),

                    inDate: item.joinDate || null,
                    outDate: item.outDate || null,
                    outReason: item.outReason || null,

                    status: item.outDate ? '1' : '0', // 퇴사일이 있으면 퇴직상태(1)
                    address: item.address || null,
                    bigo: item.note || null
                };

                // (2) Contract 데이터
                const contractData = {
                    sIdx: sIdx, // 배치될 현장 번호
                    type: memberData.type,
                    dayWorkTime: 0,
                    monthWorkTime: 0,
                    payItems: JSON.stringify({}),
                    deductionItems: JSON.stringify({}),
                    workSchedule: JSON.stringify({}),
                    startDt: item.joinDate || null,
                    endDt: item.contractEndDate || null,
                    bigo: item.note || null
                };

                // (3) Staffing 데이터
                const staffingData = {
                    sIdx: sIdx
                };

                // 🌟 (4) 비고(BigoLogs) 데이터 구조화 추가
                const bigoLogs = {
                    bigo: item.note || null,
                    payrollBigo: item.payrollBigo || null // 프론트에서 급여 비고 컬럼 추가 시 매핑
                };

                // 🌟 (5) 이력(PeriodsData) 데이터 구조화 추가
                const periodsData = [];

                // 기본 입사/퇴사일 처리
                if (item.joinDate) {
                    periodsData.push({
                        status: item.outDate ? '1' : '0', // 퇴사일이 있으면 1(퇴사), 없으면 0(재직)
                        startDate: item.joinDate.trim(),
                        endDate: item.outDate ? item.outDate.trim() : null,
                        outReason: item.outReason || null
                    });
                }

                // 엑셀에서 "2023-01-01~2023-01-05, 2023-02-01~2023-02-10" 형태로
                // 추가 근무기간(extraPeriods)을 넘겼을 경우 분리해서 배열에 추가
                if (item.extraPeriods) {
                    const extraArray = item.extraPeriods.split(',');
                    for (const periodStr of extraArray) {
                        const [start, end] = periodStr.split('~');
                        if (start && start.trim()) {
                            periodsData.push({
                                status: '1', // 과거 이력이므로 퇴사 상태로 간주
                                startDate: start.trim(),
                                endDate: end ? end.trim() : null,
                                outReason: '일괄등록 추가이력'
                            });
                        }
                    }
                }

                // 4. 단일 직원 트랜잭션 함수 호출 구문 재활용 (수정됨)
                const result = await memberModel.registerMemberWithContractAndStaffing(
                    memberData,
                    contractData,
                    staffingData,
                    bigoLogs,    // 👈 4번째 파라미터 추가! (이게 없어서 에러가 났음)
                    periodsData  // 👈 5번째 파라미터 추가!
                );

                if (result.result) {
                    successCount++;
                    results.push({ name: item.name, success: true, mIdx: result.mIdx });
                } else {
                    failCount++;
                    results.push({ name: item.name, success: false, error: result.error });
                }

            } catch (innerErr) {
                console.error(`직원 [${item.name}] 등록 과정 에러:`, innerErr);
                failCount++;
                results.push({ name: item.name, success: false, error: innerErr.message });
            }
        }

        // 응답
        if (successCount > 0) {
            res.json({
                result: true,
                message: `총 ${members.length}명 중 ${successCount}명 성공, ${failCount}명 실패`,
                successCount,
                failCount,
                data: results
            });
        } else {
            res.json({
                result: false,
                message: '직원 일괄 등록에 실패했습니다.',
            });
        }

    } catch (err) {
        console.error('Bulk Register API Error:', err);
        res.status(500).json({ result: false, message: '서버 에러가 발생했습니다.' });
    }
};

exports.setMemberMemo = async function (req, res) {
    let mIdx = req.params.mIdx,
        colName = req.body.colName,
        type = req.body.type,
        text = req.body.text;

    console.log(mIdx, colName, type, text);
    // return;

    let result = await memberModel.setMemberMemo(mIdx, colName, type, text);

    res.json({'result': true, 'data': result})
}

exports.deleteMemberMemo = async function (req, res) {
    let mIdx = req.params.mIdx;
    let colName = req.body.colName;

    console.log(mIdx, req.body)
    // Model 함수 호출
    let result = await memberModel.deleteMemberMemo(mIdx, colName);

    return res.json({ result: true, data: result });
}

exports.updateMemberBigo = async function (req, res) {
    let bgIdx = req.params.bgIdx,
        bigo = req.body.bigo,
        adminId =  req.body.adminId;

    console.log(bgIdx, bigo, adminId);

    let result = await memberModel.updateMemberBigo(bgIdx, bigo, adminId);
    res.json({'result': true, 'data': result})
}

exports.DeleteMemberBigo = async function (req, res) {
    let bgIdx = req.params.bgIdx;

    let result = await memberModel.DeleteMemberBigo(bgIdx);
    res.json({'result': true, 'data': result})
}

exports.updateMemberData = async function (req, res) {
    try {
        const mIdx = req.params.idx;
        const body = req.body;
        console.log('전체 등록 요청 데이터:', body);

        let hashedPassword = null;
        if (body.password) {
            hashedPassword = await bcrypt.hash(body.password, 10);
        }

        let encryptedRrn = '';
        if (body.rrn && !body.rrn.includes('***')) { // 마스킹된 데이터가 아닐 때만 암호화
            encryptedRrn = encryptRRN(body.rrn);
        }

        const memberData = {
            type: body.typeCd || body.type,
            name: body.name,
            billingName: body.billingName,
            id: body.id,
            password: hashedPassword,
            birthDt: body.birthDt,
            rrn: encryptedRrn,
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
            accountNm: body.accountNm,
            accountNumber: body.accountNumber,
            inDate: body.joinDate,
            outDate: body.status == '1' ? body.outDate : null,
            outReason: body.status == '1' ? body.outReason : null,
            transferDate: body.transferDate,
            addr: body.address,
            bigo: body.bigo,
            status: body.status,
            retirePension: body.retire_pension,
            fourInsurance: body.four_ins,
        };

        const bigoLogs = {
            bigo: body.bigo,
            payrollBigo: body.payrollBigo,
            admin_id: body.adminId
        };

        const payItems = {};
        const deductionItems = {};

        if (body.contractData?.wageInputs) {
            Object.keys(body.contractData?.wageInputs).forEach(key => {
                if (key.startsWith('04001')) {
                    payItems[key] = body.contractData?.wageInputs[key];
                } else if (key.startsWith('04002')) {
                    deductionItems[key] = body.contractData?.wageInputs[key];
                }
            });
        }

        const contractData = {
            sIdx: body.sIdx,
            type: body.typeCd || body.type,
            // jsonData: JSON.stringify(body.contractData?.wageInputs || {}),
            dayWorkTime: body.dayWorkTime,
            monthWorkTime: body.monthWorkTime,
            payItems: JSON.stringify(payItems),         // 분리 저장
            deductionItems: JSON.stringify(deductionItems), // 분리 저장
            workSchedule: JSON.stringify(body.contractData?.workSchedule || {}),
            startDt: body.contractStartDt,
            endDt: body.contractEndDt,
            bigo: body.bigo
        };

        const staffingData = {
            sIdx: body.sIdx
        };

        const periodsData = [];

        if (body.status === '2' || body.status === '3') {
            // 일용직(2), 대근(3): 다중 배열 데이터 처리
            if (Array.isArray(body.periodsData)) {
                body.periodsData.forEach(p => {
                    // 시작일과 종료일이 모두 있는 유효한 데이터만 필터링
                    if (p.startDate && p.endDate) {
                        periodsData.push({
                            idx: p.idx || null,
                            status: body.status,
                            startDate: p.startDate,
                            endDate: p.endDate,
                            outReason: p.outReason || ''
                        });
                    }
                });
            }
        } else if (body.status === '4') {
            // 휴직(4): startDate, endDate 매핑
            periodsData.push({
                idx: body.historyIdx || null, // 단일 상태 PK
                status: body.status,
                startDate: body.startDate || body.joinDate || null,
                endDate: body.endDate || body.outDate || null,
                outReason: body.outReason || body.endReason || ''
            });
        } else {
            // 재직(0), 퇴사(1): joinDate, outDate 매핑
            periodsData.push({
                idx: body.historyIdx || null, // 단일 상태 PK
                status: body.status,
                startDate: body.joinDate || null,
                endDate: body.status === '1' ? (body.endDate || body.outDate || null) : null,
                outReason: body.status === '1' ? (body.endReason || body.outReason || '') : ''
            });
        }

        const result = await memberModel.updateMemberWithContractAndStaffing(
            mIdx,
            memberData,
            contractData,
            staffingData,
            bigoLogs,
            periodsData
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

exports.updateMemberFourInsStatus = async function (req, res) {
    let cIdx = req.user.cIdx,
        mIdx = req.params.idx,
        colName = req.body.colName, // 프론트에서 넘긴 'inYn' 또는 'outYn'
        status = req.body.status;   // 프론트에서 넘긴 'Y' 또는 'N'

    // [보안] SQL 인젝션을 막기 위해 허용된 컬럼명인지 엄격하게 검증합니다.
    const allowedColumns = ['inYn', 'outYn'];
    if (!allowedColumns.includes(colName)) {
        return res.json({'result': false, 'message': '잘못된 컬럼명입니다.'});
    }

    let result = await memberModel.updateMemberFourInsStatus(cIdx, mIdx, colName, status);

    if (result && result.data !== '-9999') {
        res.json({'result': true, 'data': result});
    } else {
        res.json({'result': false, 'message': 'DB 업데이트 실패'});
    }
}

exports.uploadExcel = async function (req, res) {
    try {
        const cIdx = req.user.cIdx;
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
                const BirthDt = String(row['생년월일']).trim();
                const rrn = encryptRRN(row['주민번호']);
                // if (!memberId) continue; // 사번 없으면 스킵

                // 1. 비밀번호 해시화 (초기 비밀번호는 주민번호 앞자리로 설정)
                const hash = await bcrypt.hash(BirthDt, 10);

                // 2. 데이터 구조화 (엑셀 한글 헤더 매핑)
                const memberData = {
                    cIdx: cIdx,
                    type: row['구분(경비/미화)'] === '경비' ? 'S' : 'C',
                    name: row['이름'],
                    id: memberId,
                    password: hash,
                    birthDt: BirthDt,
                    rrn: rrn,
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
                    address: row['주소'] || '',
                    bigo: row['비고'] || '',
                    four_ins: row['4대보험(Y/N)'] || 'Y',   // 기본값 Y
                    retire_pension: row['퇴직연금(Y/N)'] || 'N',  // 기본값 N
                    status: row['상태'] || 0,
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

    let result = await memberModel.deleteMember(mId);
    res.json({'result': true, 'data': result});
}

exports.getCleaningMembers = async function (req, res) {
    let cIdx = req.user.cIdx;

    let result = await memberModel.getCleaningMembers(cIdx);

    res.json({'result': true, 'data': result});
}

// 1. 신규 팀 + 팀원 등록 (POST)
exports.setCleaningMembers = async function (req, res) {
    let cIdx = req.user.cIdx,
        name = req.body.name,       // 프론트에서 보낸 팀 이름
        members = req.body.members; // 프론트에서 보낸 팀원 배열

    // 1) DB에 팀을 먼저 생성하고 진짜 PK(insertId)를 받아옴
    let newTeamIdx = await siteModel.setCleaningTeam(cIdx, name);

    if (newTeamIdx === '-9999' || !newTeamIdx) {
        return res.json({ 'result': false, 'data': '팀 등록 중 오류가 발생했습니다.' });
    }

    // 2) 새로 생성된 팀의 진짜 ID(newTeamIdx)를 사용해 팀원 일괄 등록
    if (members && members.length > 0) {
        let memberValues = members.map(m => [
            newTeamIdx,  // ★ 프론트에서 온 가짜 값이 아닌 DB가 방금 만든 진짜 idx
            m.mIdx,
            m.leaderFl,
            new Date()
        ]);

        let result = await memberModel.setCleaningMembers(memberValues);

        if (result.data === '-9999') {
            return res.json({ 'result': false, 'data': '팀원 등록 중 오류가 발생했습니다.' });
        }
    }

    res.json({ 'result': true, 'data': '팀과 팀원이 성공적으로 등록되었습니다.' });
}

// 2. 기존 팀 + 팀원 수정 (PUT)
exports.updateCleaningMembers = async function (req, res) {
    let teamIdx = req.params.tIdx, // URL에서 넘어온 기존 팀 idx
        cIdx = req.user.cIdx,
        name = req.body.name,
        members = req.body.members;

    // 1) 팀 이름 수정
    let updateTeam = await siteModel.updateCleaningTeam(teamIdx, cIdx, name);
    if (updateTeam.data === '-9999') {
        return res.json({ 'result': false, 'data': '팀 이름 수정 중 오류가 발생했습니다.' });
    }

    // 2) 기존 팀원 일괄 삭제
    let delResult = await memberModel.deleteCleaningMembers(teamIdx);
    if (delResult.data === '-9999') {
        return res.json({ 'result': false, 'data': '기존 팀원 삭제 중 오류가 발생했습니다.' });
    }

    // 3) 새로운 팀원 배열 일괄 등록
    if (members && members.length > 0) {
        let memberValues = members.map(m => [
            teamIdx,
            m.mIdx,
            m.leaderFl,
            new Date()
        ]);

        let insertResult = await memberModel.setCleaningMembers(memberValues);
        if (insertResult.data === '-9999') {
            return res.json({ 'result': false, 'data': '새 팀원 등록 중 오류가 발생했습니다.' });
        }
    }

    res.json({ 'result': true, 'data': '수정 완료' });
}

/*
exports.saveCleaningTeam = async function (req, res) {
    let cIdx = req.user.cIdx;         // 토큰 등에서 가져온 회사 idx
    let teamIdx = req.params.idx;     // PUT 요청일 경우 존재 (없으면 undefined)
    let { name, members } = req.body;

    // 서비스 함수 호출
    const result = await memberModel.saveCleaningTeamService(cIdx, teamIdx, name, members);

    res.json({'result': true, 'data': result});
};

 */