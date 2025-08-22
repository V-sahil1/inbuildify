const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const builderRoutes = require("./builder.routes");
const contractorRoutes = require("./contractor.routes");
const customerRoutes = require("./customer.routes");
const leadRoutes = require("./leads.routes");

module.exports = function (app) {
  app.use("/auth", authRoutes);
  app.use("/user", userRoutes);
  app.use("/builder", builderRoutes);
  app.use("/contractor", contractorRoutes);
  app.use("/customer", customerRoutes);
  app.use("/leads", leadRoutes);
};