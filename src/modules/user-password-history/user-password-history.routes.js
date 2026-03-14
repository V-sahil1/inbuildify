const express = require("express");
const router = express.Router();

const {
  createUserPasswordHistory,
  getUserPasswordHistory,
  deleteUserPasswordHistory,
  getUserPasswordHistoryById,
  deleteUserPasswordHistoryByUserId,
} = require("./user-password-history.controller.js");
const {
  createUserPasswordHistorySchema,
  getAllUserPasswordHistorySchema,
  deleteUserPasswordHistorySchema,
  getUserPasswordHistoryByIdSchema,
  deleteUserPasswordHistoryByUserIdSchema,
} = require("./user-password-history.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createUserPasswordHistorySchema, REQUEST_SOURCE.BODY),
  createUserPasswordHistory
);

router.get(
  "/",
  validateRequest(getAllUserPasswordHistorySchema, REQUEST_SOURCE.QUERY),
  getUserPasswordHistory
);

router.delete(
  "/:id",
  validateRequest(deleteUserPasswordHistorySchema, REQUEST_SOURCE.PARAMS),
  deleteUserPasswordHistory
),
  router.get(
    "/:id",
    validateRequest(getUserPasswordHistoryByIdSchema, REQUEST_SOURCE.PARAMS),
    getUserPasswordHistoryById
  );

router.delete(
  "/user/:user_id",
  validateRequest(
    deleteUserPasswordHistoryByUserIdSchema,
    REQUEST_SOURCE.PARAMS
  ),
  deleteUserPasswordHistoryByUserId
);

module.exports = router;
