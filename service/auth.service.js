const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authModel = require("../model/auth.model");

//사용자 로그인
exports.loginUser = async function (req, res) {
    let loginId = req.body.id,
        password = req.body.password;

    try {
        const user = await authModel.findByLoginId(loginId);
        const match = await bcrypt.compare(password, user?.[0].password);
        delete user?.[0].password;

        //let result = await memberModel.loginUser(loginId, password);
        if(match) {
            // JWT 토큰 발급
            const token = jwt.sign(
                { id: user[0].id, role: 'user', cIdx: user[0].cIdx },  // 토큰에 담을 정보
                process.env.JWT_SECRET,
                { expiresIn: '8h' }
            );

            res.json({'result': true, token, 'data': user})
        }else {
            res.json({'result': false, 'msg': '아이디 혹은 비밀번호를 확인해주세요.'})
        }
    }catch(err) {
        res.json({'result': false, 'msg': '회원정보를 찾을 수 없습니다.'})
    }
}
//관리자 로그인
exports.loginManager = async function (req, res) {
    let loginId = req.body.id,
        password = req.body.password;

    try {
        const admin = await authModel.findByAdminId(loginId);
        const match = await bcrypt.compare(password, admin?.[0].password);
        delete admin?.[0].password;

        if (match) {
            // 단기 Access Token (1~2시간)
            const accessToken = jwt.sign(
                { id: admin[0].managerId, role: 'admin', cIdx: admin[0].cIdx },
                process.env.JWT_SECRET,
                { expiresIn: '2h' }
            );

            // 장기 Refresh Token (7일)
            const refreshToken = jwt.sign(
                { id: admin[0].managerId },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );

            res.json({ result: true, accessToken, refreshToken, data: admin });
        }else {
            res.json({'result': false, 'msg': '아이디 혹은 비밀번호를 확인해주세요.'})
        }
    } catch(err) {
        res.json({'result': false, 'msg': '회원정보를 찾을 수 없습니다.'})
    }

}

exports.refreshToken = async function (req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ result: false, msg: '토큰 없음' });

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const newAccessToken = jwt.sign(
            { id: decoded.id, role: 'admin', cIdx: decoded.cIdx },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );
        res.json({ result: true, accessToken: newAccessToken });
    } catch (e) {
        res.status(401).json({ result: false, msg: '재로그인 필요' });
    }
};
