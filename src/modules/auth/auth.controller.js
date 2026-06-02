import AuthService from "./auth.service.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { env } from "../../config/env.config.js";

export async function registerRoot(req, res) {
  try {
    const data = await AuthService.registerRoot(req.body);
    return successResponse(res, data, "Root user registered. OTP sent.");
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
}

export async function verifyEmail(req, res) {
  try {
    await AuthService.verifyEmail(req.body);
    return successResponse(res, null, "Email verified successfully.");
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
}

export async function resendOtp(req, res) {
  try {
    const data = await AuthService.resendOtp(req.body.email);
    return successResponse(res, data, "OTP resent successfully.");
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
}

export async function login(req, res) {
  try {
    const data = await AuthService.login(req.body);
    return successResponse(res, data, "Login successful.");
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
}

export async function forgotPassword(req, res) {
  try {
    await AuthService.forgotPassword(req.body.email);
    return successResponse(res, null, "Password reset email sent.");
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
}

export async function resetPassword(req, res) {
  try {
    await AuthService.resetPassword(req.body);
    return successResponse(res, null, "Password reset successfully.");
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
}

export async function refreshToken(req, res) {
  try {
    const data = await AuthService.refreshToken(req.body.refreshToken);
    return successResponse(res, data, "Access token refreshed.");
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
}

export async function logout(req, res) {
  try {
    await AuthService.logout(req.user);
    return successResponse(res, null, "Logged out successfully.");
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
}

export async function googleCallback(req, res) {
  try {
    if (!req.user) {
      return res.redirect(
        `${env.EMAIL.FRONTEND_BASE_URL}/auth/google-failure?error=Authentication%20failed`,
      );
    }

    const tokens = await AuthService.handleGoogleCallback(req.user);

    const params = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });

    return res.redirect(`${env.EMAIL.FRONTEND_BASE_URL}/auth/sign-in?${params.toString()}`);
  } catch (err) {
    return res.redirect(
      `${env.EMAIL.FRONTEND_BASE_URL}/auth/google-failure?error=${encodeURIComponent(err.message || "Internal server error")}`,
    );
  }
}

export default {
  registerRoot,
  verifyEmail,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  googleCallback,
};
