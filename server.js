const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { errorResponse } = require("./src/helper/response.js");
const swaggerUi = require('swagger-ui-express');
const generateSwaggerSpec = require("./src/config/swagger");
dotenv.config();  

const app = express();
app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json());

const PORT = process.env.PORT || 5000;

require("./src/routes/index")(app);

const swaggerSpec = generateSwaggerSpec(app);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("*", (req, res) => {
  return errorResponse(
    res,
    404,
    "Please check endPoint, not any api of this route!",
  );
});

app.listen(PORT, (err, res) => {
  if (!err) {
    console.log(`server running on PORT ${PORT}...`);
  }
});
