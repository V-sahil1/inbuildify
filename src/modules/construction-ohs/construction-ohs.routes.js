import express from "express";

const router = express.Router();

import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import {
  getOhsSettings,
  upsertOhsSettings,
  getOhsList,
  createOhsListItem,
  updateOhsListItem,
  deleteOhsListItem,
} from "./construction-ohs.controller.js";
import {
  upsertSettingsSchema,
  createListItemSchema,
  updateListItemSchema,
  getListItemChema,
} from "./construction-ohs.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

// auth
router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

/* -------------------------
   SETTINGS (Signature + Audits)
-------------------------- */
router.get("/settings", getOhsSettings);

router.post(
  "/settings",
  validateRequest(upsertSettingsSchema, REQUEST_SOURCE.BODY),
  upsertOhsSettings,
);

/* -------------------------
   LIST (Categories / Items)
-------------------------- */

router.get(
  "/list",
  validateRequest(getListItemChema, REQUEST_SOURCE.QUERY),
  getOhsList,
);

router.post(
  "/list",
  validateRequest(createListItemSchema, REQUEST_SOURCE.BODY),
  createOhsListItem,
);

router.put(
  "/list/:id",
  validateRequest(updateListItemSchema, REQUEST_SOURCE.BODY),
  updateOhsListItem,
);

router.delete("/list/:id", deleteOhsListItem);

export default router;
