require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { verifyToken } = require('./middleware/auth');
const app = express()
const port = 3001

/*
app.get('/', (req, res) => {
    res.send('hello world');
})

 */
// app.use(cors());
app.disable('x-powered-by');
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 로그인 라우트는 토큰 검증 제외
app.use((req, res, next) => {
    const excludePaths = ['/v1/auth/member', '/v1/auth/manager'];
    if (excludePaths.includes(req.path)) {
        return next();
    }
    verifyToken(req, res, next);
});

module.exports = app;

var authRoutes = require('./controller/auth.controller');
authRoutes(app);

var siteRoutes = require("./controller/site.controller");
siteRoutes(app);

var memberRoutes = require("./controller/member.controller");
memberRoutes(app);

/*
var contractRoutes = require("./controller/contract.controller");
contractRoutes(app);
 */

var uploadRoutes = require("./controller/upload.controller");
uploadRoutes(app);

var payrollRoutes = require("./controller/payroll.controller");
payrollRoutes(app);

var settleRoutes = require("./controller/settle.controller");
settleRoutes(app);

var workRoutes = require("./controller/work.controller");
workRoutes(app);

var etcRoutes = require("./controller/etc.controller");
etcRoutes(app);

var equipmentRoutes = require("./controller/equipment.controller");
equipmentRoutes(app);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
