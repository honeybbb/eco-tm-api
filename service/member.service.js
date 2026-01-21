const memberModel = require("../model/member.model")
const contractModel = require("../model/contract.model")
const {hashPassword} = require("../utils/password");
const bcrypt  = require("bcrypt");

//직원 리스트 조회
exports.getMemberList = async function (req, res) {
    let result = await memberModel.getMemberList();

    res.json({'result': true, 'data': result})
}

//직원 데이터 조회
exports.getMemberData = async function (req, res) {
    let id = req.params.id;

    let result = await memberModel.getMemberData(id);

    res.json({'result': true, 'data': result})
}

exports.getMemberAvailable = async function (req, res) {
    let sIdx = req.query.sIdx;
    let result = await memberModel.getMemberAvailable(sIdx);

    res.json({'result': true, 'data': result})
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
        accountNo = req.body.accountNo,
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
        bank, accountNo, inDate, outDate, outReason, addr, bigo
    )

    res.json({'result': true, 'data': result})
}

//직원급여등록
exports.setPayroll = async function (req, res) {
    let mIdx = req.params.mIdx, //회원idx
        sIdx = req.body.sIdx, //현장idx
        year = req.body.year,   //현재 년도
        paymentList = req.body.payItems, //json(지급항목)
        deductionList = req.body.deductionItems, //json(공제항목)
        grossPay = req.body.grossPay,
        deductions = req.body.deductions,
        netPay = req.body.netPay,
        total = req.body.total; //합계

    let result = await memberModel.setPayroll(mIdx, sIdx, year, paymentList, deductionList, grossPay, deductions, netPay, total);

    res.json({'result': true, 'data': result})
};

//직원기본급여조회
exports.getPayroll = async function (req, res) {
    let result = await memberModel.getPayroll();

    res.json({'result': true, 'data': result})
}

//직원급여내역조회
exports.getPayrollMonth = async function (req, res) {
    let result = await memberModel.getPayrollMonth();

    res.json({'result': true, 'data': result})
}

exports.getMemberLeave = async function (req, res) {
    let sIdx = req.query.sIdx,
        year = req.query.year;

    let result = await memberModel.getMemberLeave(sIdx, year)

    res.json({'result': true, 'data': result})
}

//직원 연차 저장
exports.setMemberLeave = async function (req, res) {
    let mIdx = req.body.mIdx,
        position = req.body.position,
        year = req.body.year,
        personalNo = req.body.personalNo,
        middle_date = req.body.middle_date,
        basis_cost = req.body.basis_code,
        count = req.body.count,
        over_count = req.body.over_count,
        used_count = req.body.used_count,
        amount = req.body.amount, //연차추계액
        bigo = req.body.bigo;

    let result = await memberModel.setMemberLeave(mIdx, position, year, personalNo, middle_date, basis_cost, count, over_count, used_count, amount, bigo);

    res.json({'result': true, 'data': result})
}

exports.setMemberStaffing = async function (req, res) {
    let mIdx = req.params.mIdx,
        sIdx = req.body.sIdx;

    let result = await memberModel.setMemberStaffing(mIdx, sIdx)

    res.json({'result': true, 'data': result})
}

exports.loginUser = async function (req, res) {
    let loginId = req.body.id,
        password = req.body.password;
    console.log(loginId, password)

    const user = await memberModel.findByLoginId(loginId);
    const match = await bcrypt.compare(password, user.password);
    delete user.password;

    //let result = await memberModel.loginUser(loginId, password);
    if(match) {
        res.json({'result': true, 'data': user})
    }else {
        res.json({'result': false, 'msg': '아이디 혹은 비밀번호를 확인해주세요.'})
    }
}

exports.loginManager = async function (req, res) {
    /*
    let loginId = req.body.id,
        password = req.body.password;

    const user = await memberModel.findByLoginManger(loginId);

     */
}
