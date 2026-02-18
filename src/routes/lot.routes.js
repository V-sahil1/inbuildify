const express = require("express");
const router = express.Router();
const {
  createLot,
  getAllLots,
  getLotById,
  updateLot,
  deleteLot,
} = require("../controllers/lot.controller");
const {
  createLotSchema,
  updateLotSchema,
  getLotByIdSchema,
  deleteLotSchema,
  getAllLotsSchema,
} = require("../validations/lot.validation");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createLotSchema, REQUEST_SOURCE.BODY),
  createLot,
);

router.get(
  "/",
  validateRequest(getAllLotsSchema, REQUEST_SOURCE.QUERY),
  getAllLots,
);

router.get(
  "/:lot_id",
  validateRequest(getLotByIdSchema, REQUEST_SOURCE.PARAMS),
  getLotById,
);

router.put(
  "/:lot_id",
  validateRequest(getLotByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateLotSchema, REQUEST_SOURCE.BODY),
  updateLot,
);

router.delete(
  "/:lot_id",
  validateRequest(deleteLotSchema, REQUEST_SOURCE.PARAMS),
  deleteLot,
);

module.exports = router;
