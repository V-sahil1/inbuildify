import express from "express";

const router = express.Router();
import { createAddress } from "./address.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import { createAddressSchema } from "./address.validation";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createAddressSchema, REQUEST_SOURCE.BODY),
  createAddress,
);

export default router;
