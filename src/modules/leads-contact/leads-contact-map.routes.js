const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const {
  createLeadContactMapSchema,
  getByLeadParamsSchema,
  deleteParamsSchema,
} = require("./leads-contact-map.validation.js");
const controller = require("./leads-Contact-map.controller.js");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createLeadContactMapSchema, REQUEST_SOURCE.BODY),
  controller.createLeadContactMap
);

router.get(
  "/:leads_id",
  validateRequest(getByLeadParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.getContactsByLeadId
);

router.delete(
  "/:id",
  validateRequest(deleteParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.deleteLeadContactMap
);

module.exports = router;
