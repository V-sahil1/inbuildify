const authRoutes = require("./auth.routes");
const builderRoutes = require("./builder.routes");
const contractorRoutes = require("./contractor.routes");

module.exports = function (app) {
  app.use("/auth", authRoutes);
  app.use("/builder", builderRoutes);
  app.use("/contractor",contractorRoutes);
};
