const express = require("express");
const router = express.Router();
const {
  createMasterFacade,
  getMasterFacades,
  getMasterFacadeById,
  updateMasterFacade,
  deleteMasterFacade,
} = require("../controllers/master-facade.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createUpload, handleMulterError } = require("../utils/s3Upload");
const {
  createMasterFacadeSchema,
  getMasterFacadeByIdSchema,
  getMasterFacadesSchema,
  updateMasterFacadeParamsSchema,
  updateMasterFacadeSchema,
  deleteMasterFacadeSchema,
} = require("../validations/master-facade.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("facade");

router.post(
  "/",
  upload.single("image"),
  handleMulterError,
  validateRequest(createMasterFacadeSchema, REQUEST_SOURCE.FORM_DATA),
  createMasterFacade
);

router.get(
  "/",
  validateRequest(getMasterFacadesSchema, REQUEST_SOURCE.QUERY),
  getMasterFacades
);

router.get(
  "/:id",
  validateRequest(getMasterFacadeByIdSchema, REQUEST_SOURCE.PARAMS),
  getMasterFacadeById
);

router.put(
  "/:facade_id",
  upload.single("image"),
  handleMulterError,
  validateRequest(updateMasterFacadeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMasterFacadeSchema, REQUEST_SOURCE.FORM_DATA),
  updateMasterFacade
);

router.delete(
  "/:facade_id",
  validateRequest(deleteMasterFacadeSchema, REQUEST_SOURCE.PARAMS),
  deleteMasterFacade
);

module.exports = router;
