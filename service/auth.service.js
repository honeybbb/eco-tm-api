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

        if(match) {
            const token = jwt.sign(
                { id: admin[0].id, role: 'admin', cIdx: admin[0].cIdx },
                process.env.JWT_SECRET,
                { expiresIn: '60m' }
            );

            res.json({'result': true, token, 'data': admin})
        }else {
            res.json({'result': false, 'msg': '아이디 혹은 비밀번호를 확인해주세요.'})
        }
    } catch(err) {
        res.json({'result': false, 'msg': '회원정보를 찾을 수 없습니다.'})
    }

}
