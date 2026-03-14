const express = require("express");
const router = express.Router();

const { createLotPackageGroupSchema, updateLotPackageGroupSchema, getLotPackageGroupByIdSchema, deleteLotPackageGroupSchema, getAllLotPackageGroupsSchema } = require("./lot-package-group.validation.js");
const { createLotPackageGroup, updateLotPackageGroup, getLotPackageGroupById, deleteLotPackageGroup, getAllLotPackageGroups } = require("./lot-package-group.controller.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);


router.get("/", validateRequest(getAllLotPackageGroupsSchema, REQUEST_SOURCE.QUERY), getAllLotPackageGroups);
router.get("/:lot_package_group_id", validateRequest(getLotPackageGroupByIdSchema, REQUEST_SOURCE.PARAMS), getLotPackageGroupById);
router.post("/", validateRequest(createLotPackageGroupSchema, REQUEST_SOURCE.BODY), createLotPackageGroup);
router.put("/:lot_package_group_id", validateRequest(getLotPackageGroupByIdSchema, REQUEST_SOURCE.PARAMS), validateRequest(updateLotPackageGroupSchema, REQUEST_SOURCE.BODY), updateLotPackageGroup);
router.delete("/:lot_package_group_id", validateRequest(deleteLotPackageGroupSchema, REQUEST_SOURCE.PARAMS), deleteLotPackageGroup);

module.exports = router;