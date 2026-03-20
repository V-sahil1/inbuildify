import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import { env } from "./src/config/env.config.js";
import { errorResponse } from "./src/helper/response.js";
import generateSwaggerSpec from "./src/config/swagger.js";
import routes from "./src/routes/index.js";

import { connectPostgre } from "./src/config/database/postgre.connect.js";

connectPostgre()
  .then(() => console.log("database connected successfully"))
  .catch((error) => console.error("error to connect database", error));

const app = express();
app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json());

const PORT = Number(env.PORT.PORT) || 5000;

routes(app);

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
