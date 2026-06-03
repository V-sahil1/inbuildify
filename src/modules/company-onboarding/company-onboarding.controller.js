import { successResponse, errorResponse } from "../../helper/response.js";
import companyOnboardingService from "./company-onboarding.service.js";

export async function companySignUp(req, res) {
  try {
    const data = await companyOnboardingService.companySignUp(req.body);
    const message = data.isVerified
      ? "Company registered. You can proceed to complete onboarding."
      : "Company registered. Verify your email with the OTP we just sent, then complete onboarding.";
    return successResponse(res, data, message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
}

export async function completeCompanyOnboarding(req, res) {
  try {
    const { id } = req.params;
    const requesterCompanyId = req.user?.company_id || null;
    const data = await companyOnboardingService.completeCompanyOnboarding(
      id,
      req.body,
      requesterCompanyId,
    );
    return successResponse(res, data, "Company onboarding completed successfully.");
  } catch (err) {
    return errorResponse(res, err.statusCode || err.status || 500, err.message);
  }
}

export default {
  companySignUp,
  completeCompanyOnboarding,
};
