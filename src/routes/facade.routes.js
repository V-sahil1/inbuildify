const express = require("express");
const router = express.Router();
const {
  createFacade,
  getFacades,
  getFacadeById,
  updateFacade,
  deleteFacade,
  getFacadeFilters
} = require("../controllers/facade.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createUpload, handleMulterError } = require("../utils/s3Upload");
const {
  createFacadeSchema,
  getFacadeByIdSchema,
  getFacadesSchema,
  updateFacadeParamsSchema,
  updateFacadeSchema,
  deleteFacadeSchema
} = require("../validations/facade.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("facade");

router.post(
  "/", 
  upload.single("image"),
  handleMulterError,
  validateRequest(createFacadeSchema, REQUEST_SOURCE.FORM_DATA), 
  createFacade
);

router.get("/", validateRequest(getFacadesSchema, REQUEST_SOURCE.QUERY), getFacades);

router.get("/filters", getFacadeFilters);

router.get(
  "/:id",
  validateRequest(getFacadeByIdSchema, REQUEST_SOURCE.PARAMS),
  getFacadeById
);

router.put(
  "/:facade_id",
  upload.single("image"),
  handleMulterError,
  validateRequest(updateFacadeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateFacadeSchema, REQUEST_SOURCE.FORM_DATA),
  updateFacade
);

router.delete(
  "/:facade_id",
  validateRequest(deleteFacadeSchema, REQUEST_SOURCE.PARAMS),
  deleteFacade
);

module.exports = router;