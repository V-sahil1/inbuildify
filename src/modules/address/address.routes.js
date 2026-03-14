const express = require("express");
const router = express.Router();
const { createAddress } = require("./address.controller");

const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const { createAddressSchema } = require("./address.validation");
const { REQUEST_SOURCE } = require("../../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createAddressSchema, REQUEST_SOURCE.BODY),
  createAddress
);

module.exports = router;
