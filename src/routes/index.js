const user = require("./user.routes");
const builder = require("./builder.routes.js");
const contractor = require("./contractor.routes.js");

module.exports = function (app) {
  app.use("/user", user);
  app.use("/builder", builder);
  app.use("/contractor",contractor);
};
