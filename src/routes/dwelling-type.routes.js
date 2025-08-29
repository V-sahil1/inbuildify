const express = require("express");
const router = express.Router();
const {
  getAllDwellingTypes
} = require("../controllers/dwelling-type.controller.js");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  getAllDwellingTypesSchema,
} = require("../validations/dwelling-type.validation.js");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", validateRequest(getAllDwellingTypesSchema, REQUEST_SOURCE.QUERY), getAllDwellingTypes);

module.exports = router;
