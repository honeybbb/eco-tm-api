const etcModel = require("../model/etc.model");

exports.getMenus = async function (req, res) {
    let companyNo = req.params.companyNo,
        isMaster = req.query.isMaster == 'Y'? true:false,
        path = req.query.path;

    try {
        let result = await etcModel.getMenus(companyNo, isMaster, path);

        res.json({'result': true, 'data': result})

    } catch(err) {
        res.json({'result': false, 'msg': '관리자 메뉴를 찾을 수 없습니다.'})
    }
}

exports.updateMenus = async function (req, res) {
    let companyNo = req.params.companyNo,
        menuNo = req.body.menuNo,
        menuNm = req.body.menuNm,
        masterOnly = req.body.masterOnly,
        sort = req.body.sort,
        useFl = req.body.useFl;

    console.log(companyNo, menuNo, menuNm, masterOnly, sort, useFl);

    let result = await etcModel.updateMenus(companyNo, menuNo, menuNm, masterOnly, sort, useFl);

    res.json({'result': true, 'data': result})
}

exports.getBaseCode = async function (req, res) {
    let cIdx = req.params.cIdx;
    if(!cIdx) return res.json({'result': false, 'msg':'회사 정보가 없습니다.'});
    let result = await etcModel.getBaseCode(cIdx);

    res.json({'result': true, 'data': result})

}

exports.getGroupCode = async function (req, res) {
    let cIdx = req.user.cIdx,
        groupCd = req.params.groupCd;

    if(!cIdx) return res.json({'result': false, 'msg':'회사 정보가 없습니다.'});
    if(groupCd == ':groupCd') return res.json({'result': false, 'msg':'그룹코드가 없습니다.'});

    let result = await etcModel.getGroupCode(cIdx, groupCd);

    res.json({'result': true, 'data': result})
}

exports.setWageCode = async function (req, res) {
    let cIdx = req.params.cIdx,
        groupCd = req.body.groupCd,
        itemCd = req.body.itemCd,
        itemNm = req.body.itemNm,
        sort = req.body.sort || 0,
        useFl = req.body.useFl,
        option = req.body.option || 0,//비과세한도
        regDt = new Date();

    let result = await etcModel.setWageCode(cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt);

    res.json({'result': true, 'data': result})
}

exports.setBaseCode = async function (req, res) {
    let cIdx = req.params.cIdx,
        groupCd = req.body.groupCd,
        itemCd = req.body.itemCd,
        itemNm = req.body.itemNm,
        sort = req.body.sort,
        useFl = req.body.useFl,
        option = req.body.option || req.body.tax_free,
        // logicFl = req.body.logicFl,
        regDt = new Date();

    let result = await etcModel.setBaseCode(cIdx, groupCd, itemCd, itemNm, sort, useFl, option, regDt);

    res.json({'result': true, 'data': result})
}

exports.updateBaseCode = async function (req, res) {
    let itemCd = req.params.itemCd,
        itemNm = req.body.itemNm,
        useFl = req.body.useFl,
        option = req.body.option,
        sort = req.body.sort,
        modDt = new Date();

    let result = await etcModel.updateBaseCode(itemCd, itemNm, useFl, option, sort, modDt);

    res.json({'result': true, 'data': result})
}

exports.getCompanyData = async function (req, res) {
    let idx = req.user.cIdx;

    let result = await etcModel.getCompanyData(idx);

    res.json({'result': true, 'data': result})
}

exports.setCompanyAccount = async function (req, res) {
    let cIdx = req.params.cIdx,
        bank = req.body.bank,
        accountNumber = req.body.accountNumber,
        accountName = req.body.accountName,
        isDefault = req.body.isDefault,
        memo = req.body.memo;
    console.log(cIdx, bank, accountNumber, accountName, isDefault, memo)

    let result = await etcModel.setCompanyAccount(cIdx, bank, accountNumber, accountName, isDefault, memo);

    res.json({'result': true, 'data': result})
}

exports.getCompanyAccount = async function (req, res) {
    let cIdx = req.user.cIdx;

    let result = await etcModel.getCompanyAccount(cIdx);

    res.json({'result': true, 'data': result})
}

exports.updateCompanyAccount = async function (req, res) {
    let idx = req.params.idx,
        bank = req.body.bank,
        accountNumber = req.body.accountNumber,
        accountName = req.body.accountName,
        memo = req.body.memo,
        isDefault = req.body.isDefault;

    let result = await etcModel.updateCompanyAccount(idx, bank, accountNumber, accountName, memo, isDefault);

    res.json({'result': true, 'data': result})
}

exports.deleteCompanyAccount = async function (req, res) {
    let idx = req.params.idx;

    let result = await etcModel.deleteCompanyAccount(idx);

    res.json({'result': true, 'data': result})

}

exports.getWageCode = async function (req, res) {
    let cIdx = req.params.cIdx;

    let result = await etcModel.getWageCode(cIdx);

    res.json({'result': true, 'data': result})
}

exports.getWageCode2 = async function (req, res) {
    let cIdx = req.params.cIdx;

    let result = await etcModel.getWageCode2(cIdx);

    res.json({'result': true, 'data': result})
}

exports.deleteWageCode = async function (req, res) {
    let itemCd = req.params.itemCd;
    //console.log('deleteBaseCode', groupCd);

    let result = await etcModel.deleteWageCode(itemCd);

    res.json({'result': true, 'data': result})
}

exports.deleteBaseCode = async function (req, res) {
    let itemCd = req.params.itemCd;

    let result = await etcModel.deleteBaseCode(itemCd);

    res.json({'result': true, 'data': result})
}

exports.setWorkDays = async function (req, res) {
    let cIdx = req.body.cIdx,
        sIdx = req.body.sIdx,
        year = req.body.year,
        month = req.body.month,
        days = req.body.days,
        bigo = req.body.bigo;

    let uIdx = `${cIdx}${year}${month}`;

    let result = await etcModel.setWorkDays(uIdx, cIdx, sIdx, year, month, days, bigo);

    res.json({'result': true, 'data': result})
}

exports.getWorkDays = async function (req, res) {
    let cIdx = req.query.cIdx,
        from = req.query.from,
        to = req.query.to;

    let result = await etcModel.getWorkDays(cIdx, from, to);

    if(result) {
        res.json({'result': true, 'data': result})
    }else {
        res.json({'result': false, 'msg': '조회된 결과가 없습니다.'})
    }
}

exports.delWorkDays = async function (req, res) {
    let uIdx = req.params.uIdx;

    let result = await etcModel.delWorkDays(uIdx);

    res.json({'result': true, 'data': result})
}

exports.setTaxRate = async function (req, res) {
    let appliedYear = req.body.applied_year, //당해년도
        pensionRate = req.body.pension_rate, //국민연금
        healthRate = req.body.health_rate,   //건강보험
        longTermCareRate = req.body.long_term_care_rate,   //장기요양보험
        employmentRate = req.body.employment_rate,   //고용보험
        industrialRate = req.body.industrial_rate;   //산재보험

    //console.log(appliedYear, pensionRate, healthRate, longTermCareRate, employmentRate)

    let result = await etcModel.setTaxRate(appliedYear, pensionRate, healthRate, longTermCareRate, employmentRate, industrialRate);

    res.json({'result': true, 'data': result})
}

exports.getTaxRate = async function (req, res) {
    let year = req.params.year;

    let result = await etcModel.getTaxRate(year);

    res.json({'result': true, 'data': result})
}

exports.setTaxIncome = async function (req, res) {

}

exports.getTaxIncome = async function (req, res) {
    let year = req.params.year,
        salary = req.query.salary,
        familyCnt = req.query.familyCnt;

    // salary가 없으면 구간표 전체 반환 (프론트 초기 로드용)
    if (salary === undefined) {
        const table = await etcModel.getTaxIncomeTable(year);
        return res.json({ result: true, data: table });
    }

    // 기존 단건 계산 로직 그대로 유지
    let result = await etcModel.getTaxIncome(year, salary, familyCnt);

    const incomeTax = result[0]?.tax_amt || 0;
    const localTax = Math.floor(incomeTax * 0.1 / 10) * 10;

    res.json({ result: true, incomeTax, localTax });
}

//품목 신청
exports.setOrders = async function (req, res) {
    try {
        let sIdx = req.params.sIdx,
            mIdx = req.body.mIdx,
            orderList = req.body.orders;

        console.log(orderList, 'orderList')

        if (orderList.length === 0) {
            return res.status(400).json({ result: false, message: "신청할 물품이 없습니다." });
        }

        let result = await etcModel.setOrders(sIdx, orderList, mIdx);

        res.json({ result: true, data: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ result: false, message: "서버 오류" });
    }
}

//품목신청 리스트
exports.getOrders = async function (req, res) {
    let result = await etcModel.getOrders();

    res.json({'result': true, 'data': result})
}

exports.updateOrderStatus = async function (req, res) {
    let sIdx = req.body.sIdx,
        oIdx = req.body.oIdx,
        status = req.body.status,
        managerId = req.body.managerId;

    let result = await etcModel.updateOrderStatus(sIdx, oIdx, status, managerId);
    res.json({'result': true, 'data': result})
}

/* =========================================================================
 * 공휴일 (특일 정보) — 공공데이터포털 한국천문연구원_특일 정보 서비스
 *   getRestDeInfo: 국경일/공휴일/대체공휴일을 포함한 "쉬는 날" 목록
 *   - 월 단위(solYear + solMonth)로만 조회되는 API라서, 요청받은 연도의
 *     12개월을 병렬로 모아 한 해치 목록으로 합친다.
 *   - 같은 연도는 서버 메모리에 캐싱해 외부 API 호출 횟수를 줄인다.
 *     (data.go.kr 은 1일 호출 횟수 제한이 있음 — 서버 재시작 시 캐시는 초기화됨.
 *      트래픽이 많거나 다중 인스턴스 환경이면 DB/Redis 캐시로 교체 권장)
 * ========================================================================= */
const REST_DE_URL = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';

// 연도(number) -> 공휴일 문자열 배열(YYYY-MM-DD) 캐시
const restDeCache = new Map();

const toIsoDate = (locdate) =>
    String(locdate).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');

// 한 달치 조회 — http/https/axios 전부 안 쓰고 Node 전역 fetch만 사용 (Node 18+ 필요)
const fetchRestDeMonth = async (serviceKey, year, month) => {
    const qs = new URLSearchParams({
        serviceKey,               // decodeURIComponent 된 값 — URLSearchParams가 요청 시 1회만 인코딩
        solYear: String(year),
        solMonth: String(month).padStart(2, '0'),
        _type: 'json',
        numOfRows: '100'
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response;
    try {
        response = await fetch(`${REST_DE_URL}?${qs.toString()}`, { signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const text = await response.text();
        // data.go.kr이 인증키 오류 시 JSON 대신 XML/HTML을 주는 경우가 있어 원문 일부를 남긴다
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    const body = data?.response?.body;
    if (!body || Number(body.totalCount) === 0) return [];

    // 결과가 1건이면 item이 배열이 아니라 객체로 온다 — 항상 배열로 정규화
    let items = body.items?.item ?? [];
    if (!Array.isArray(items)) items = [items];

    return items
        .filter((it) => it.isHoliday === 'Y')
        .map((it) => ({ date: toIsoDate(it.locdate), name: it.dateName || '' }));
};

// 한 해치 조회 (캐시 우선)
const fetchRestDeYear = async (serviceKey, year) => {
    if (restDeCache.has(year)) return restDeCache.get(year);

    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const results = await Promise.all(months.map((m) => fetchRestDeMonth(serviceKey, year, m)));

    // 같은 날짜가 여러 달에 겹쳐 오는 경우는 없지만, 혹시 몰라 date 기준으로 중복 제거
    const map = new Map();
    results.flat().forEach((h) => { if (!map.has(h.date)) map.set(h.date, h); });
    const list = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

    restDeCache.set(year, list);
    return list;
};

exports.getRestDeInfo = async function (req, res) {
    // 공공데이터포털에서 발급받은 서비스키. 아래처럼 URL 인코딩된 형태로 하드코딩되어 있으면
    // axios params 에 그대로 넣었을 때 이중 인코딩(% -> %25)이 발생해 인증 오류가 날 수 있으므로
    // decodeURIComponent 로 원본 값으로 풀어서 사용한다.
    // (권장: 하드코딩 대신 process.env.HOLIDAY_SERVICE_KEY 사용)
    const SERVICE_KEY = 'tp6N4rpWzWq4vszXPwffUgry8UZ6tyGzcthyg%2B62a4FwWI1g7msVWAD9qNrzk3UQZ%2B96tL7haA5ASnZ4x62CxQ%3D%3D';

    const year = Number(req.query.year) || new Date().getFullYear();

    try {
        const decodedKey = decodeURIComponent(SERVICE_KEY);
        const list = await fetchRestDeYear(decodedKey, year);

        res.json({ result: true, data: list });
    } catch (err) {
        console.error('공휴일(getRestDeInfo) 호출 실패:', err.message);
        res.json({ result: false, msg: '공휴일 정보를 가져오지 못했습니다.', data: [] });
    }
}