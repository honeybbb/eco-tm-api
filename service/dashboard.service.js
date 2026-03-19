const siteModel = require("../model/site.model");
const memberModel = require("../model/member.model");
const dashboardModel = require("../model/dashboard.model");

const getSiteStats = async (cIdx) => {
    const [result, stats] = await Promise.all([
        siteModel.getSiteList(cIdx),
        dashboardModel.getSiteStats(cIdx)
    ]);
    return {
        totalCount: stats.totalCount,
        increaseCount: stats.lastMonthIncrease
    };
};

const getMemberStats = async (cIdx) => {
    const [result, stats] = await Promise.all([
        memberModel.getMemberList(cIdx),
        dashboardModel.getMemberStats(cIdx)
    ]);
    return {
        totalCount: stats.totalCount,
        increaseCount: stats.lastMonthIncrease
    };
};

// 2. 외부에서 접근할 수 있도록 exports에 할당합니다.
exports.getSiteStatus = async function (req, res) {
    let cIdx = req.params.cIdx;
    try {
        const stats = await getSiteStats(cIdx); // 내부 함수 호출
        res.json({ result: true, ...stats });
    } catch (e) {
        res.json({ result: false, message: '데이터 로드 실패' });
    }
};

exports.getEmployeeStatus = async function (req, res) {
    let cIdx = req.params.cIdx;
    try {
        const stats = await getMemberStats(cIdx); // 내부 함수 호출
        res.json({ result: true, ...stats });
    } catch (e) {
        res.json({ result: false, message: '데이터 로드 실패' });
    }
};

// 3. 메인 대시보드 함수
exports.getDashboards = async function (req, res) {
    const { cIdx } = req.params;
    if (!cIdx) return res.status(400).json({ message: "회사코드가 없습니다." });

    try {
        const [pending, siteStatus, memberStatus] = await Promise.all([
            dashboardModel.getPendingApprovals(cIdx),
            getSiteStats(cIdx),
            getMemberStats(cIdx)
        ]);

        res.json({ pending, siteStatus, memberStatus });
    } catch (e) {
        console.error(e);
        res.status(500).json({ result: false, message: "서버 에러" });
    }
};
