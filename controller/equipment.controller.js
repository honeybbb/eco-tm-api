'use strict';
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const service = require("../service/equipment.service")

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname); // 원래 파일의 확장자 추출 (.pdf)
        const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

module.exports = function (app) {
    //장비 등록
    app.route('/v1/equipment/register').post(upload.array('imgPath', 10), service.setEquipment);

    //장비 리스트
    app.route('/v2/equipment/list').get(service.getEquipmentList_v2);

    //장비 이동
    app.route('/v1/equipment/move').put(service.moveEquipment);

    //장비 조회
    app.route('/v1/equipment/data/:idx').get(service.getEquipmentData);

    //장비 수리등록 (before 사진 포함)
    app.route('/v1/equipment/repair').post(upload.array('beforeImgPath', 10), service.repairEquipment);

    //장비 수리 완료 처리 (after 사진 포함)
    app.route('/v1/equipment/repair/:repairIdx/complete').post(upload.array('afterImgPath', 10), service.completeRepair);

    //장비 폐기
    app.route('/v1/equipment/dispose/:idx').put(service.disposeEquipment);

    //장비 부분 폐기 처리 (현장/수량 지정)
    app.route('/v1/equipment/discard').post(service.discardEquipment);
}
