const settleModel = require("../model/settle.model");

exports.getSettleMents = async function (req, res) {
    let year = req.query.year,
        month = req.query.month;

    let result = await settleModel.getSettleMents(year, month);

    res.json({"result": true, "data": result});
}

exports.setSettleMents = async function (req, res) {
    let year = req.query.year,
        month = req.query.month;

    let result = await settleModel.setSettleMents(year, month);

    res.json({"result": true, "data": result});
}
