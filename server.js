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
import quotationEmailQueue from "./src/workers/quotationEmailWorker.js";
import quoteApprovedEmailQueue from "./src/workers/quoteApprovedEmailWorker.js";
import pdfGenerationQueue from "./src/workers/pdfGenerationWorker.js";
import engineerEmailQueue from "./src/workers/engineerEmailWorker.js";

import passport from "passport";
import "./src/config/passport.config.js";
import { warmupBrowser } from "./src/modules/quotation/pdf.service.js";

// Removed top-level connectPostgre call. It's now moved to wrap app.listen.

const app = express();
app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));

const PORT = Number(env.PORT) || 5000;
app.use(passport.initialize());

routes(app);

// Setup Bull Board for queue monitoring
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [
    new BullAdapter(notificationQueue),
    new BullAdapter(quotationEmailQueue),
    new BullAdapter(quoteApprovedEmailQueue),
    new BullAdapter(pdfGenerationQueue),
    new BullAdapter(engineerEmailQueue),
  ],
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

connectPostgre()
  .then(() => {
    app.listen(PORT, (err, res) => {
      if (!err) {
        console.log(`server running on PORT ${PORT}...`);
        // Pre-warm Puppeteer so the first PDF request doesn't pay the cold
        // Chromium launch (the dominant first-hit cost behind the 504s).
        warmupBrowser();
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
  })
  .catch((error) => {
    console.error("Critical: Could not connect to database. Server not started.", error);
    process.exit(1);
  });

const cleanupAndExit = async (err) => {
  if (err) console.error("Unhandled error, shutting down:", err);
  console.log("Gracefully closing Redis connections before exit...");
  try {
    await Promise.all([
      notificationQueue.close(),
      quotationEmailQueue.close(),
      quoteApprovedEmailQueue.close(),
      pdfGenerationQueue.close(),
      engineerEmailQueue.close(),
    ]);
    console.log("Redis connections closed successfully.");
  } catch (error) {
    console.error("Error closing Redis connections:", error);
  }
  process.exit(err ? 1 : 0);
};

process.on('SIGINT', () => cleanupAndExit());
process.on('SIGTERM', () => cleanupAndExit());
process.on('SIGUSR2', () => cleanupAndExit());
process.on('uncaughtException', (err) => cleanupAndExit(err));
process.on('unhandledRejection', (reason) => cleanupAndExit(reason));
