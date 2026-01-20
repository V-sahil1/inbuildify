const express = require("express");
const router = express.Router();
const {
  getAllDwellingTypes,
  createDwellingType,
  updateDwellingType,
  deleteDwellingType,
  updateDwellingTypeActive,
} = require("../controllers/dwelling-type.controller.js");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createDwellingTypeSchema,
  updateDwellingTypeSchema,
  deleteDwellingTypeSchema,
  updateDwellingTypeParamsScehma,
  updateDwellingTypeActiveSchema,
} = require("../validations/dwelling-type.validation.js");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.get("/", getAllDwellingTypes);
router.post(
  "/",
  validateRequest(createDwellingTypeSchema, REQUEST_SOURCE.BODY),
  createDwellingType,
);
router.put(
  "/:dwelling_type_id",
  validateRequest(updateDwellingTypeSchema.params, REQUEST_SOURCE.PARAMS),
  validateRequest(updateDwellingTypeSchema.body, REQUEST_SOURCE.BODY),
  updateDwellingType,
);
router.delete(
  "/:dwelling_type_id",
  validateRequest(deleteDwellingTypeSchema.params, REQUEST_SOURCE.PARAMS),
  deleteDwellingType,
);
router.put(
  "/is-active/:dwelling_type_id",
  validateRequest(updateDwellingTypeParamsScehma, REQUEST_SOURCE.PARAMS),
  validateRequest(updateDwellingTypeActiveSchema, REQUEST_SOURCE.BODY),
  updateDwellingTypeActive,
);

module.exports = router;
