const authRoutes = require("./auth.routes");
const builderRoutes = require("./builder.routes");
const contractorRoutes = require("./contractor.routes");
const customerRoutes = require("./customer.routes.js")

module.exports = function (app) {
    app.use("/auth", authRoutes);
    app.use("/builder", builderRoutes);
    app.use("/contractor", contractorRoutes);
    app.use("/customer", customerRoutes)
};