import crypto from "crypto";
import { env } from "../../config/env.config.js";
import jwt from "jsonwebtoken";

import getPool from "../../config/database.js";
import sendEmail from "../../service/sendMail.service.js";
import { upsertCompany } from "../company/company.service.js";
import { seedBuilderDefaults } from "../../seeder/seed-builder-defaults.js";
import { generateOtp, generateAccessToken, generateRefreshToken, decrypt as base64Decrypt } from "../../utils/common.js";
import { encrypt, decrypt } from "../../utils/crypto.util.js";
import db from "../../config/database/models/postgre-models/index.js";
import { Users } from "../../config/database/models/postgre-models/users.model.js";
import { Builder } from "../../config/database/models/postgre-models/builder.model.js";

// REGISTER ROOT USER
export async function registerRoot({ name, email, password, role_id }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const lowerEmail = email.toLowerCase();

    // Check if root already exists
    const rootCheck = await client.query(
      "SELECT users_id FROM users WHERE LOWER(email) = $1",
      [lowerEmail],
    );

    if (rootCheck.rowCount > 0) {
      throw { statusCode: 409, message: "User already exists." };
    }

    const roleCheck = await client.query(
      "SELECT role_id FROM role WHERE role_id = $1",
      [role_id],
    );

    if (roleCheck.rowCount === 0) {
      throw { statusCode: 400, message: "Invalid role." };
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await client.query("BEGIN");

    // Create builder
    const builderRes = await client.query(
      "INSERT INTO builder (name, email) VALUES ($1, $2) RETURNING builder_id",
      [name, lowerEmail],
    );
    const builder_id = builderRes.rows[0].builder_id;
    const builderRess = await Builder.create({
      name: name,
      email: lowerEmail,
    });
    const builderr_id = builderRess.builder_id;
    // console.log("🚀 ~ registerRoot ~ builderssssssssssssssssssssssssssssssssssr_id:", builderr_id)

    // Create root user
    const userRes = await client.query(
      `INSERT INTO users (
            builder_id, name, email, role_id, 
            password, otp, expires_at, root_user
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING users_id`,
      [
        builder_id,
        name,
        lowerEmail,
        role_id,
        encrypt(password),
        otp,
        expiresAt,
        true,
      ],
    );
    // console.log("🚀 ~ registerRoot ~ userRes:", userRes);
    // console.log(db.Users);
    // console.log("🚀 ~ registerRoot ~ builder_id:", builder_id);
    // console.log("🚀 ~ registerRoot ~ name:", name)
    // console.log("🚀 ~ registerRoot ~ lowerEmail:", lowerEmail)
    // console.log("🚀 ~ registerRoot ~ role_id:", role_id)
    // console.log("🚀 ~ registerRoot ~ encrypt:", encrypt)
    // console.log("🚀 ~ registerRoot ~ otp:", otp)
    // console.log("🚀 ~ registerRoot ~ expiresAt:", expiresAt)

    await Users.create({
      builder_id: builderr_id,
      name: name,
      email: lowerEmail,
      role_id: role_id,
      password: encrypt(password),
      otp: otp,
      expires_at: expiresAt,
      root_user: true,
    });

    const users_id = userRes.rows[0].users_id;

    // Create default company for the new user
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
    //create and update api
    const companyResult = await upsertCompany(builder_id, defaultCompanyPayload, client);
    const company_id = companyResult?.companyId || null;

    // Seed all default settings for the new builder
    await seedBuilderDefaults({
      company_id,
      builder_id,
      created_by: users_id,
      client,
    });

    // Send OTP Email using helper function
    await sendVerificationEmail(lowerEmail, otp);
    // console.log("bhwdsnksdjx")

    await client.query("COMMIT");
    return { email: lowerEmail };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// VERIFY EMAIL
export async function verifyEmail({ email, otp }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const lowerEmail = email.toLowerCase();

    const userRes = await client.query(
      `SELECT users_id, otp, expires_at, is_verified
         FROM users WHERE LOWER(email) = $1`,
      [lowerEmail],
    );
    const userRess = await Users.findOne({
      attributes: ["users_id", "otp", "expires_at", "is_verified"],
      where: {
        email: lowerEmail,
      },
    });
    if (userRes.rowCount === 0) {
      throw { statusCode: 404, message: "User not found." };
    }

    const user = userRes.rows[0];

    if (user.is_verified) {
      throw { statusCode: 400, message: "Email already verified." };
    }

    if (user.otp !== otp) {
      throw { statusCode: 400, message: "Invalid OTP." };
    }

    if (new Date() > user.expires_at) {
      throw { statusCode: 400, message: "OTP expired." };
    }

    await client.query(
      `UPDATE users
         SET is_verified = true, otp = NULL, expires_at = NULL
         WHERE users_id = $1`,
      [user.users_id],
    );
    await Users.update(
      {
        is_verified: true,
        otp: null,
        expires_at: null,
      },
      {
        where: { users_id: userRess.users_id },
      }
    );
  } finally {
    client.release();
  }
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
  const pool = getPool();
  const client = await pool.connect();

  try {
    const lowerEmail = email.toLowerCase();

    const userRes = await client.query(
      `SELECT users_id, is_verified, otp_resend_count, last_otp_sent_at
         FROM users WHERE LOWER(email) = $1`,
      [lowerEmail],
    );

    if (userRes.rowCount === 0) {
      throw { statusCode: 404, message: "User not found." };
    }

    const user = userRes.rows[0];

    if (user.is_verified) {
      throw { statusCode: 400, message: "User already verified." };
    }

    // rate limit: 4 per hour
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
      resendCount = 0; // reset
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await sendVerificationEmail(lowerEmail, otp);

    await client.query(
      `UPDATE users
         SET otp = $1, expires_at = $2,
             otp_resend_count = $3, last_otp_sent_at = $4
         WHERE users_id = $5`,
      [otp, expiresAt, resendCount + 1, now, user.users_id],
    );

    return { otpResendCount: resendCount + 1 };
  } finally {
    client.release();
  }
}

// LOGIN
export async function login({ email, login_id, password }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    let userRes;
    if (email) {
      const lowerEmail = email.toLowerCase();
      userRes = await client.query(
        "SELECT * FROM users WHERE LOWER(email) = $1 AND is_deleted = FALSE",
        [lowerEmail],
      );
    } else if (login_id) {
      userRes = await client.query(
        "SELECT * FROM users WHERE login_id = $1 AND is_deleted = FALSE",
        [login_id],
      );
    } else {
      throw { statusCode: 400, message: "Email or login ID is required." };
    }

    if (userRes.rowCount === 0) {
      throw { statusCode: 401, message: "Invalid credentials." };
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      throw { statusCode: 403, message: "Account deactivated." };
    }

    if (user.is_locked) {
      throw { statusCode: 403, message: "Account locked." };
    }

    if (!user.is_verified) {
      throw { statusCode: 400, message: "Please verify your email first." };
    }

    let decryptedPassword;
    try {
      decryptedPassword = decrypt(user.password);
    } catch (decryptError) {
      // Try fallback for old Base64 encryption
      try {
        decryptedPassword = base64Decrypt(user.password);
      } catch (fallbackError) {
        console.error(
          "Fallback decryption also failed:",
          fallbackError.message,
        );
        throw { statusCode: 500, message: "Invalid password format." };
      }
    }
    //for wrong password incress failed_attempts count
    if (decryptedPassword !== password) {
      await client.query(
        "UPDATE users SET failed_attempts = failed_attempts + 1 WHERE users_id = $1",
        [user.users_id],
      );
      //set_locked as true for too many attempt
      if (user.failed_attempts + 1 >= 5) {
        await client.query(
          "UPDATE users SET is_locked = true WHERE users_id = $1",
          [user.users_id],
        );
      }

      throw { statusCode: 401, message: "Invalid email or password." };
    }

    // RESET FAILED ATTEMPTS
    await client.query(
      "UPDATE users SET failed_attempts = 0 WHERE users_id = $1",
      [user.users_id],
    );

    // CHECK IF USER NEEDS TO CHANGE PASSWORD
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

    await client.query(
      `INSERT INTO users_token (user_id, access_token, refresh_token)
         VALUES ($1, $2, $3)`,
      [user.users_id, accessToken, refreshToken],
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.users_id,
        email: user.email,
        role_id: user.role_id,
      },
    };
  } finally {
    client.release();
  }
}

// LOGOUT
export async function logout(user) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query(
      `DELETE FROM users_token
         WHERE user_id = $1 AND access_token = $2`,
      [user.user_id, user.access_token],
    );
  } finally {
    client.release();
  }
}

// FORGOT PASSWORD
export async function forgotPassword(email) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const lowerEmail = email.toLowerCase();

    const userRes = await client.query(
      "SELECT users_id FROM users WHERE LOWER(email) = $1",
      [lowerEmail],
    );

    if (userRes.rowCount === 0) {
      throw { statusCode: 404, message: "No user found." };
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await sendVerificationEmail(lowerEmail, null, token);

    await client.query(
      `UPDATE users
         SET reset_password_token = $1, reset_token_expires_at = $2
         WHERE LOWER(email) = $3`,
      [token, expiresAt, lowerEmail],
    );
  } finally {
    client.release();
  }
}

// RESET PASSWORD
export async function resetPassword({ email, resetPasswordToken, password }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const lowerEmail = email.toLowerCase();

    const resUser = await client.query(
      `SELECT users_id, reset_token_expires_at
         FROM users
         WHERE LOWER(email) = $1 AND reset_password_token = $2`,
      [lowerEmail, resetPasswordToken],
    );

    if (resUser.rowCount === 0) {
      throw { statusCode: 400, message: "Invalid reset token." };
    }

    const user = resUser.rows[0];

    if (new Date() > user.reset_token_expires_at) {
      throw { statusCode: 400, message: "Reset token expired." };
    }

    await client.query(
      `UPDATE users
         SET password = $1,
             reset_password_token = NULL,
             reset_token_expires_at = NULL,
             next_login_password_change = false
         WHERE users_id = $2`,
      [encrypt(password), user.users_id],
    );
  } finally {
    client.release();
  }
}

// REFRESH TOKEN
export async function refreshToken(refreshToken) {
  let decoded;

  try {
    decoded = jwt.verify(refreshToken, env.JWT.JWT_REFRESH_SECRET);
  } catch (err) {
    throw { statusCode: 401, message: "Invalid refresh token." };
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkToken = await client.query(
      `SELECT * FROM users_token
         WHERE user_id = $1 AND refresh_token = $2`,
      [decoded.userId, refreshToken],
    );

    if (checkToken.rowCount === 0) {
      throw { statusCode: 401, message: "Token expired or invalid." };
    }

    const newAccessToken = generateAccessToken(decoded.userId);

    await client.query(
      `UPDATE users_token SET access_token = $1
         WHERE user_id = $2 AND refresh_token = $3`,
      [newAccessToken, decoded.userId, refreshToken],
    );

    return { accessToken: newAccessToken };
  } finally {
    client.release();
  }
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
};
