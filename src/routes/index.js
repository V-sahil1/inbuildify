const user = require("./user.routes");
const builder = require("./builder.routes.js");

module.exports = function (app) {
  app.use("/user", user);
  app.use("/builder", builder);
};
