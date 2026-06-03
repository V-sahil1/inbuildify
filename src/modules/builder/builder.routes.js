import express from "express";

const router = express.Router();
import { upsertBuilder, getMyBuilderProfile, getAllBuilders } from "./builder.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import parseFormDataJson from "../../middleware/parseFormDataJson.js";
import { createUpload, handleMulterError } from "../../utils/s3Upload.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";
import { upsertBuilderSchema } from "./builder.validation.js";

router.use(authMiddleware);
router.use(roleMiddleware);
const upload = createUpload("builder-logo");
//not currently use this api
router.get("/all", getAllBuilders);

router.get("/", getMyBuilderProfile);

// upsertBuilder create-or-updates the caller's builder profile. The frontend
// uses POST to create and PUT to update, so both verbs map to the same
// upsert handler and middleware chain.
const upsertBuilderChain = [
  upload.single("logo"),
  handleMulterError,
  parseFormDataJson,
  camelToSnakeMiddleware,
  validateRequest(upsertBuilderSchema, REQUEST_SOURCE.FORM_DATA),
  upsertBuilder,
];

router.post("/", ...upsertBuilderChain);
router.put("/", ...upsertBuilderChain);

export default router;