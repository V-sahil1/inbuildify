const express = require("express");
const router = express.Router();
const {
  getAllDwellingTypes,
  createDwellingType,
  updateDwellingType,
  deleteDwellingType
} = require("../controllers/dwelling-type.controller.js");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  getAllDwellingTypesSchema,
  createDwellingTypeSchema,
  updateDwellingTypeSchema,
  deleteDwellingTypeSchema
} = require("../validations/dwelling-type.validation.js");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", validateRequest(getAllDwellingTypesSchema, REQUEST_SOURCE.QUERY), getAllDwellingTypes);
router.post("/", validateRequest(createDwellingTypeSchema, REQUEST_SOURCE.BODY), createDwellingType);
router.put("/:dwelling_type_id", validateRequest(updateDwellingTypeSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(updateDwellingTypeSchema.body, REQUEST_SOURCE.BODY), updateDwellingType);
router.delete("/:dwelling_type_id", validateRequest(deleteDwellingTypeSchema.params, REQUEST_SOURCE.PARAMS), deleteDwellingType);


module.exports = router;
