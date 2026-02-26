const settleModel = require("../model/settle.model");

exports.getSettleMents = async function (req, res) {
    let selectedYear = req.query.year;

    let result = await settleModel.getSettleMents(selectedYear);

    res.json({"result": true, "data": result});
}
