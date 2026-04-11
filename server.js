import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import { env } from "./src/config/env.config.js";
import { errorResponse } from "./src/helper/response.js";
import generateSwaggerSpec from "./src/config/swagger.js";
import routes from "./src/routes/index.js";

import { connectPostgre } from "./src/config/postgre.connect.js";
import { createBullBoard } from "@bull-board/api";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import { ExpressAdapter } from "@bull-board/express";
import notificationQueue from "./src/workers/notificationWorker.js";

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

const PORT = Number(env.PORT) || 5000;

routes(app);

// Setup Bull Board for queue monitoring
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullAdapter(notificationQueue)],
  serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

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

  console.log(`     
  ░██           ░████████              ░██░██        ░██ ░██    ░████            
                ░██    ░██                ░██        ░██       ░██               
  ░██░████████  ░██    ░██  ░██    ░██ ░██░██  ░████████ ░██░████████ ░██    ░██ 
  ░██░██    ░██ ░████████   ░██    ░██ ░██░██ ░██    ░██ ░██   ░██    ░██    ░██ 
  ░██░██    ░██ ░██     ░██ ░██    ░██ ░██░██ ░██    ░██ ░██   ░██    ░██    ░██ 
  ░██░██    ░██ ░██     ░██ ░██   ░███ ░██░██ ░██   ░███ ░██   ░██    ░██   ░███ 
  ░██░██    ░██ ░█████████   ░█████░██ ░██░██  ░█████░██ ░██   ░██     ░█████░██ 
                                                                            ░██ 
                                                                      ░███████                                                                                     
      `);
});
