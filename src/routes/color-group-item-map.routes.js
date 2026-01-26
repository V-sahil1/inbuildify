const express = require("express");
const router = express.Router();

const {
  createColorGroupItemMap,
  getAllColorGroupItemMaps,
  deleteColorGroupItemMap,
} = require("../controllers/color-group-item-map.controller");
const {
  createColorGroupItemMapSchema,
  getAllColorGroupItemMapsSchema,
  deleteColorGroupItemMapSchema,
} = require("../validations/color-group-item-map.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const caseConverterMiddleware = require("../middleware/caseConverterMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(caseConverterMiddleware);

router.post(
  "/",
  validateRequest(createColorGroupItemMapSchema, REQUEST_SOURCE.BODY),
  createColorGroupItemMap,
);

router.get(
  "/",
  validateRequest(getAllColorGroupItemMapsSchema, REQUEST_SOURCE.QUERY),
  getAllColorGroupItemMaps,
);

router.delete(
  "/:id",
  validateRequest(deleteColorGroupItemMapSchema, REQUEST_SOURCE.PARAMS),
  deleteColorGroupItemMap,
);

module.exports = router;
