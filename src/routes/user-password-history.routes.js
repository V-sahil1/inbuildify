const express = require("express");
const router = express.Router();

const {
  createUserPasswordHistory,
  getUserPasswordHistory,
  deleteUserPasswordHistory,
  getUserPasswordHistoryById,
  deleteUserPasswordHistoryByUserId,
} = require("../controllers/user-password-history.controller");
const {
  createUserPasswordHistorySchema,
  getAllUserPasswordHistorySchema,
  deleteUserPasswordHistorySchema,
  getUserPasswordHistoryByIdSchema,
  deleteUserPasswordHistoryByUserIdSchema,
} = require("../validations/user-password-history.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

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
