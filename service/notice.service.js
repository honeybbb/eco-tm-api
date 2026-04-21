const etcModel = require("../model/notice.model");
exports.getNoticeList = async function (req, res) {
    let cIdx = req.params.cIdx;

    try {
        let result = await etcModel.getNoticeList(cIdx);
        res.json({'result': true, 'data': result})
    }catch (e) {
        console.error(e);
        res.status(500).json({result: false, message: '서버 에러'});
    }
}

exports.getNoticeData = async function(req, res) {
    let idx = req.params.idx;

    let result = await etcModel.getNoticeData(idx);

    res.json({'result': true, 'data': result})
}

exports.setNotice = async function (req, res) {
    let cIdx = req.body.cIdx,
        must = req.body.must,
        type = req.body.type,
        target = req.body.target,
        title = req.body.title,
        content = req.body.content,
        author = req.body.author,
        regDt = new Date();

    try {
        let result = await etcModel.setNotice(cIdx, must, type, target, title, content, author, regDt);

        res.json({'result': true, 'data': result})

    }catch(err) {
        res.json({'result': false, 'msg': '공지 등록에 실패했습니다.'})
    }

}

exports.removeNotice = async function (req, res) {
    let idx = req.params.idx;

    try {
        let result = await etcModel.removeNotice(idx);

        res.json({'result': true, 'data': result})

    }catch(err) {
        res.json({'result': false, 'msg': '공지 삭제에 실패했습니다.'})
    }
}
