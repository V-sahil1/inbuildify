const express = require("express");
const router = express.Router();
const {
  createMasterFacade,
  getMasterFacades,
  getMasterFacadeById,
  updateMasterFacade,
  deleteMasterFacade,
} = require("./master-facade.controller.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { createUpload, handleMulterError } = require("../../utils/s3Upload.js");
const {
  createMasterFacadeSchema,
  getMasterFacadeByIdSchema,
  getMasterFacadesSchema,
  updateMasterFacadeParamsSchema,
  updateMasterFacadeSchema,
  deleteMasterFacadeSchema,
} = require("./master-facade.validation.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("facade");

router.post(
  "/",
  upload.single("image"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createMasterFacadeSchema, REQUEST_SOURCE.FORM_DATA),
  createMasterFacade
);

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getMasterFacadesSchema, REQUEST_SOURCE.QUERY),
  getMasterFacades
);

router.get(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(getMasterFacadeByIdSchema, REQUEST_SOURCE.PARAMS),
  getMasterFacadeById
);

router.put(
  "/:facade_id",
  upload.single("image"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateMasterFacadeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMasterFacadeSchema, REQUEST_SOURCE.FORM_DATA),
  updateMasterFacade
);

router.delete(
  "/:facade_id",
  camelToSnakeMiddleware,
  validateRequest(deleteMasterFacadeSchema, REQUEST_SOURCE.PARAMS),
  deleteMasterFacade
);

module.exports = router;
