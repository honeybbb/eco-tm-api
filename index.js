const express = require('express');
const cors = require('cors');
const app = express()
const port = 3001

/*
app.get('/', (req, res) => {
    res.send('hello world');
})

 */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

module.exports = app;

var siteRoutes = require("./controller/site.controller");
siteRoutes(app);

var memberRoutes = require("./controller/member.controller");
memberRoutes(app);

var contractRoutes = require("./controller/contract.controller");
contractRoutes(app);

var payrollRoutes = require("./controller/payroll.controller");
payrollRoutes(app);

var workRoutes = require("./controller/work.controller");
workRoutes(app);

var etcRoutes = require("./controller/etc.controller");
etcRoutes(app);

var equipmentRoutes = require("./controller/equipment.controller");
equipmentRoutes(app);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
