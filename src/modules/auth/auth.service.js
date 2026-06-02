import crypto from "crypto";
import { env } from "../../config/env.config.js";
import jwt from "jsonwebtoken";

import sendEmail from "../../service/sendMail.service.js";
import { upsertCompanyService } from "../company/company.service.js";
import { seedBuilderDefaults } from "../../seeder/seed-builder-defaults.js";
import { generateOtp, generateAccessToken, generateRefreshToken, decrypt as base64Decrypt } from "../../utils/common.js";
import { encrypt, decrypt } from "../../utils/crypto.util.js";
import db from "../../config/database/models/postgre-models/index.js";
import { Op } from "sequelize";

// REGISTER ROOT USER
export async function registerRoot({ name, email, password, role_id }) {
  const lowerEmail = email.toLowerCase();
  const { Users, Builder, Role, sequelize } = db;
  // Check if root already exists
  const existingUser = await Users.findOne({
    where: {
      email: sequelize.where(
        sequelize.fn("LOWER", sequelize.col("email")),
        lowerEmail,
      ),
    },
  });
  if (existingUser) {
    throw { statusCode: 409, message: "User already exists." };
  }

  // Check if role exists
  const roleExists = await Role.findByPk(role_id);
  if (!roleExists) {
    throw { statusCode: 400, message: "Invalid role." };
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const result = await sequelize.transaction(async (t) => {
    // Create builder
    const builder = await Builder.create(
      { name, email: lowerEmail },
      { transaction: t },
    );
    const builder_id = builder.builder_id;

    // Create root user
    const user = await Users.create(
      {
        builder_id,
        name,
        email: lowerEmail,
        role_id,
        password: encrypt(password),
        otp,
        expires_at: sequelize.literal("NOW() + INTERVAL '10 minutes'"),
        root_user: true,
      },
      { transaction: t },
    );
    const users_id = user.users_id;

    // Create default company for the new builder
    const defaultCompanyPayload = {
      name: `${name}'s Company`,
      abn_number: null,
      timezone_id: null,
      address: null,
      bank_name: null,
      account_name: null,
      account_number: null,
      account_bsb: null,
      email_signature_logo: null,
      company_logo: null,
    };

    // upsertCompanyService now accepts a Sequelize transaction — pass t
    const companyResult = await upsertCompanyService(builder_id, defaultCompanyPayload, t);
    const company_id = companyResult?.companyId || null;

    // Seed all default settings
    await seedBuilderDefaults({
      company_id,
      builder_id,
      created_by: users_id,
      transaction: t, // Use the Sequelize transaction
    });

    return { email: lowerEmail };
  });

  // Send OTP email OUTSIDE transaction (side effect, non-rollbackable)
  await sendVerificationEmail(lowerEmail, otp);

  return result;
}
// VERIFY EMAIL
export async function verifyEmail({ email, otp }) {
  const lowerEmail = email.toLowerCase();
  const { Users, sequelize } = db;

  const user = await db.Users.findOne({
    attributes: ["users_id", "otp", "expires_at", "is_verified"],
    where: {
      [Op.and]: [
        sequelize.where(
          sequelize.fn("LOWER", sequelize.col("email")),
          lowerEmail,
        ),
      ],
    },
  });
  console.log("🚀 ~ verifyEmail ~ user:", user)

  if (!user) {
    throw { statusCode: 404, message: "User not found." };
  }

  if (user.is_verified) {
    throw { statusCode: 400, message: "Email already verified." };
  }

  if (user.otp !== otp) {
    throw { statusCode: 400, message: "Invalid OTP." };
  }
  // 10 minutes
  // Let JS Date handle the comparison — both are
 

  if (new Date() > new Date(user.expires_at)) {
    throw { statusCode: 400, message: "OTP expired." };
  }

  await Users.update(
    { is_verified: true, otp: null, expires_at: null },
    { where: { users_id: user.users_id } },
  );
}
// Helper function to send verification email
async function sendVerificationEmail(
  email,
  otp,
  resetPasswordToken = null,
  inviteToken = null,
) {
  let subject;
  let verificationLink;
  let text;
  try {
    if (resetPasswordToken) {
      subject = "CRMSimplify - Password Reset Request";
      verificationLink = `${env.EMAIL.FRONTEND_BASE_URL}/auth/reset-password?token=${resetPasswordToken}&email=${email}`;
      text = `You requested a password reset. Use the following link to reset your password:\n\n${verificationLink}\n\nThis link will expire in 10 minutes.`;
    } else if (inviteToken) {
      subject = "Invitation to Join";
      verificationLink = `You have been invited to join. Please click the following link to accept the invitation: ${env.EMAIL.FRONTEND_BASE_URL}/auth/accept-invite?token=${inviteToken}&email=${email}`;
      text = `You have been invited to join. Please click the following link to accept the invitation:\n\n${verificationLink}\n\nThis link will expire in 10 minutes.`;
    } else {
      subject = "OTP for Email Verification";
      verificationLink = `${env.EMAIL.FRONTEND_BASE_URL}/auth/verify-email?email=${email}`;
      text = `Your OTP for email verification is: ${otp}\n\nPlease verify your email by clicking the following link: ${verificationLink}`;
    }

    return await sendEmail(email, subject, text);
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
}

// RESEND OTP
export async function resendOtp(email) {
  const lowerEmail = email.toLowerCase();
  const { Users, sequelize } = db;

  const user = await Users.findOne({
    attributes: ["users_id", "otp_resend_count", "last_otp_sent_at", "is_verified"],
    where: sequelize.where(
      sequelize.fn("LOWER", sequelize.col("email")),
      lowerEmail,
    ),
  });

  if (!user) {
    throw { statusCode: 404, message: "User not found." };
  }

  if (user.is_verified) {
    throw { statusCode: 400, message: "User already verified." };
  }

  // Rate limit: 4 per hour
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);

  let resendCount = user.otp_resend_count || 0;
  const lastSent = user.last_otp_sent_at;

  if (lastSent && new Date(lastSent) > oneHourAgo) {
    if (resendCount >= 4) {
      throw {
        statusCode: 429,
        message: "OTP resend limit reached. Please try again after 1 hour.",
      };
    }
  } else {
    resendCount = 0; // reset count if outside 1-hour window
  }

  const otp = generateOtp();

  await sendVerificationEmail(lowerEmail, otp);

  await Users.update(
    {
      otp,
      expires_at: sequelize.literal("NOW() + INTERVAL '10 minutes'"), // timezone-safe
      otp_resend_count: resendCount + 1,
      last_otp_sent_at: now,
    },
    {
      where: { users_id: user.users_id },
    },
  );

  return { otpResendCount: resendCount + 1 };
}

// LOGIN
export async function login({ email, login_id, password }) {
  const { Users, UsersToken, sequelize } = db;

  // Build where clause based on email or login_id
  let whereClause;
  if (email) {
    const lowerEmail = email.toLowerCase();
    whereClause = sequelize.where(
      sequelize.fn("LOWER", sequelize.col("email")),
      lowerEmail,
    );
  } else if (login_id) {
    whereClause = { login_id };
  } else {
    throw { statusCode: 400, message: "Email or login ID is required." };
  }

  const user = await Users.findOne({
    where: {
      [Op.and]: [whereClause, { is_deleted: false }],
    },
  });

  if (!user) {
    throw { statusCode: 401, message: "Invalid credentials." };
  }

  if (!user.is_active) {
    throw { statusCode: 403, message: "Account deactivated." };
  }

  if (user.is_locked) {
    throw { statusCode: 403, message: "Account locked." };
  }

  if (!user.is_verified) {
    throw { statusCode: 400, message: "Please verify your email first." };
  }

  // Decrypt password with fallback
  let decryptedPassword;
  try {
    decryptedPassword = decrypt(user.password);
  } catch (decryptError) {
    try {
      decryptedPassword = base64Decrypt(user.password);
    } catch (fallbackError) {
      console.error("Fallback decryption also failed:", fallbackError.message);
      throw { statusCode: 500, message: "Invalid password format." };
    }
  }

  // Wrong password — increment failed_attempts
  if (decryptedPassword !== password) {
    const newFailedAttempts = (user.failed_attempts || 0) + 1;

    await Users.update(
      {
        failed_attempts: newFailedAttempts,
        // Lock account if 5 or more failed attempts
        ...(newFailedAttempts >= 5 && { is_locked: true }),
      },
      { where: { users_id: user.users_id } },
    );

    throw { statusCode: 401, message: "Invalid email or password." };
  }

  // Reset failed attempts on successful password match
  await Users.update(
    { failed_attempts: 0 },
    { where: { users_id: user.users_id } },
  );

  // Force password change if required
  if (user.next_login_password_change) {
    return {
      requirePasswordChange: true,
      message: "You must change your password before continuing.",
      user: {
        id: user.users_id,
        email: user.email,
        role_id: user.role_id,
      },
    };
  }

  const accessToken = generateAccessToken(user.users_id);
  const refreshToken = generateRefreshToken(user.users_id);

  await UsersToken.create({
    user_id: user.users_id,
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.users_id,
      email: user.email,
      role_id: user.role_id,
    },
  };
}

// LOGOUT
export async function logout(user) {
  const { UsersToken } = db;

  if (!user || !user.access_token) {
    return;
  }

  await UsersToken.destroy({
    where: {
      user_id: user.user_id,
      access_token: user.access_token,
    },
  });
}

// FORGOT PASSWORD

//forget
export async function forgotPassword(email) {
  const { Users, sequelize } = db;

  const lowerEmail = email.toLowerCase();

  const user = await Users.findOne({
    attributes: ["users_id"],
    where: sequelize.where(
      sequelize.fn("LOWER", sequelize.col("email")),
      lowerEmail,
    ),
  });

  if (!user) {
    throw { statusCode: 404, message: "No user found." };
  }

  const token = crypto.randomUUID();

  // Save to DB first, then send email
  await Users.update(
    {
      reset_password_token: token,
      reset_token_expires_at: sequelize.literal("NOW() + INTERVAL '10 minutes'"),
    },
    {
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.col("email")),
        lowerEmail,
      ),
    },
  );

  await sendVerificationEmail(lowerEmail, null, token);
}
// RESET PASSWORD
export async function resetPassword({ email, resetPasswordToken, password }) {
  const { Users, sequelize } = db;

  const lowerEmail = email.toLowerCase();

  const user = await Users.findOne({
    attributes: ["users_id", "reset_token_expires_at"],
    where: {
      [Op.and]: [
        sequelize.where(
          sequelize.fn("LOWER", sequelize.col("email")),
          lowerEmail,
        ),
        { reset_password_token: resetPasswordToken },
      ],
    },
  });

  if (!user) {
    throw { statusCode: 400, message: "Invalid reset token." };
  }

  // Timezone-safe comparison
  if (new Date() > new Date(user.reset_token_expires_at)) {
    throw { statusCode: 400, message: "Reset token expired." };
  }

  await Users.update(
    {
      password: encrypt(password),
      reset_password_token: null,
      reset_token_expires_at: null,
      next_login_password_change: false,
    },
    { where: { users_id: user.users_id } },
  );
}
export async function refreshToken(refreshToken) {
  const { UsersToken } = db;

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT.JWT_REFRESH_SECRET);
  } catch (err) {
    throw { statusCode: 401, message: "Invalid refresh token." };
  }

  const token = await UsersToken.findOne({
    where: {
      user_id: decoded.userId,
      refresh_token: refreshToken,
    },
  });

  if (!token) {
    throw { statusCode: 401, message: "Token expired or invalid." };
  }

  const newAccessToken = generateAccessToken(decoded.userId);

  await UsersToken.update(
    { access_token: newAccessToken },
    {
      where: {
        user_id: decoded.userId,
        refresh_token: refreshToken,
      },
    },
  );

  return { accessToken: newAccessToken };
}

export async function validateTokenAndUser(token, userId) {
  const { Users, UsersToken } = db;

  try {
    const user = await Users.findOne({
      where: {
        users_id: userId,
        is_verified: true,
      },
      include: [
        {
          model: UsersToken,
          as: "tokens",
          where: { access_token: token },
          required: true,
        },
      ],
    });

    return user ? user.get({ plain: true }) : null;
  } catch (error) {
    console.error("AuthService.validateTokenAndUser error:", error);
    throw error;
  }
}

export async function getCompanyByBuilderId(builderId) {
  const { Company } = db;

  try {
    const company = await Company.findOne({
      where: { builder_id: builderId },
      attributes: ["company_id"],
    });

    return company ? company.get({ plain: true }) : null;
  } catch (error) {
    console.error("AuthService.getCompanyByBuilderId error:", error);
    throw error;
  }
}

export async function autoRegisterGoogleUser(profile, email) {
  const { Users, Builder, Role, sequelize } = db;
  
  // Find default Builder role
  const CompanyRole = await Role.findOne({
    where: { name: "Company Administrator" },
  });
  if (!CompanyRole) {
    throw { statusCode: 500, message: "Default Builder role not found in the database." };
  }
  const role_id = CompanyRole.role_id;

  const result = await sequelize.transaction(async (t) => {
    const displayName = profile.displayName || email.split("@")[0];
    // Create builder
    const builder = await Builder.create(
      { name: `${displayName}'s Company`, email },
      { transaction: t }
    );
    const builder_id = builder.builder_id;

    // Create root user via Google
    const user = await Users.create(
      {
        builder_id,
        name: displayName,
        email: email,
        role_id,
        password: null, // No local password
        is_verified: true, // Google email is already verified
        root_user: true,
        auth_provider: "google",
      },
      { transaction: t }
    );

    // Create default company
    const defaultCompanyPayload = {
      name: `${displayName}'s Company`,
      abn_number: null,
      timezone_id: null,
      address: null,
      bank_name: null,
      account_name: null,
      account_number: null,
      account_bsb: null,
      email_signature_logo: null,
      company_logo: null,
    };

    const companyResult = await upsertCompanyService(builder_id, defaultCompanyPayload, t);
    const company_id = companyResult?.companyId || null;

    // Seed all default settings
    await seedBuilderDefaults({
      company_id,
      builder_id,
      created_by: user.users_id,
      transaction: t,
    });

    return user;
  });

  return result;
}

export async function handleGoogleCallback(user) {
  const { UsersToken } = db;

  const accessToken = generateAccessToken(user.users_id);
  const refreshToken = generateRefreshToken(user.users_id);

  await UsersToken.create({
    user_id: user.users_id,
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return {
    accessToken,
    refreshToken,
  };
}

export default {
  login,
  registerRoot,
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendOtp,
  refreshToken,
  logout,
  validateTokenAndUser,
  getCompanyByBuilderId,
  handleGoogleCallback,
  autoRegisterGoogleUser,
};
