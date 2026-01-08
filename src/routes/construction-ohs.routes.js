const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const handleMulterError = require("../utils/s3Upload").handleMulterError;

const {
  getOhsSettings,
  upsertOhsSettings,
  getOhsList,
  createOhsListItem,
  updateOhsListItem,
  deleteOhsListItem,
} = require("../controllers/construction-ohs.controller");

const {
  upsertSettingsSchema,
  createListItemSchema,
  updateListItemSchema,
} = require("../validations/construction-ohs.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

// auth
router.use(authMiddleware);
router.use(roleMiddleware);

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

router.get("/list", getOhsList);

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
