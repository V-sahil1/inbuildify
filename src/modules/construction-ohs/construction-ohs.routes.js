const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const {
  getOhsSettings,
  upsertOhsSettings,
  getOhsList,
  createOhsListItem,
  updateOhsListItem,
  deleteOhsListItem,
} = require("./construction-ohs.controller.js");

const {
  upsertSettingsSchema,
  createListItemSchema,
  updateListItemSchema,
  getListItemChema,
} = require("./construction-ohs.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

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
  upsertOhsSettings
);

/* -------------------------
   LIST (Categories / Items)
-------------------------- */

router.get(
  "/list",
  validateRequest(getListItemChema, REQUEST_SOURCE.QUERY),
  getOhsList
);

router.post(
  "/list",
  validateRequest(createListItemSchema, REQUEST_SOURCE.BODY),
  createOhsListItem
);

router.put(
  "/list/:id",
  validateRequest(updateListItemSchema, REQUEST_SOURCE.BODY),
  updateOhsListItem
);

router.delete("/list/:id", deleteOhsListItem);

module.exports = router;
