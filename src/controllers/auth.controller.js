const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const sendEmail = require("../helper/sendMail");
const {
  generateOtp,
  encrypt,
  decrypt,
  generateAccessToken,
  generateRefreshToken,
  checkRequiredFields,
} = require("../utils/common");

exports.registerUser = async (req, res) => {
  const { name, email, password, role = "super_admin" } = req.body;
  const lowerCaseEmail = email.toLowerCase();

  const pool = getPool();
  const client = await pool.connect();

  try {
    const existingUserQuery = `
      SELECT u.is_verified, u.expires_at, b.email 
      FROM users u 
      JOIN builder b ON u.builder_id = b.builder_id 
      WHERE LOWER(b.email) = $1;
    `;
    const existingUserResult = await client.query(existingUserQuery, [
      lowerCaseEmail,
    ]);

    if (existingUserResult.rowCount > 0) {
      const { is_verified } = existingUserResult.rows[0];

      if (is_verified) {
        return errorResponse(res, 409, "User already exists and is verified.");
      }

      const otp = generateOtp();
      const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const emailSent = await sendVerificationEmail(lowerCaseEmail, otp);

      if (emailSent) {
        await client.query(
          `UPDATE users SET otp = $1, expires_at = $2 WHERE LOWER(email) = $3;`,
          [otp, newExpiresAt, lowerCaseEmail]
        );

        return successResponse(
          res,
          {
            message: "A new OTP has been sent to your email.",
            link: `/verify-email?email=${lowerCaseEmail}`,
          },
          "OTP sent successfully."
        );
      } else {
        return errorResponse(res, 500, "Failed to send OTP email.");
      }
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    console.log("otp", otp);

    const emailSent = await sendVerificationEmail(lowerCaseEmail, otp);
    console.log("emailsend:", emailSent);

    if (!emailSent) {
      return errorResponse(res, 500, "Failed to send verification email.");
    }

    await client.query("BEGIN");

    try {
      const builderResult = await client.query(
        `INSERT INTO builder (name, email) VALUES ($1, $2) RETURNING builder_id;`,
        [name, lowerCaseEmail]
      );
      const builderId = builderResult.rows[0].builder_id;

      await client.query(
        `INSERT INTO users (
          role, builder_id, name, email, password, 
          root_user, otp, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          ["super_admin"],
          builderId,
          name,
          lowerCaseEmail,
          encrypt(password),
          role === "admin",
          otp,
          expiresAt,
        ]
      );

      await client.query("COMMIT");

      return successResponse(res, null, "User created successfully.");
    } catch (insertError) {
      await client.query("ROLLBACK");
      throw insertError;
    }
  } catch (error) {
    console.error({ error });
    return errorResponse(res, 400, error.message || "Failed to create user.");
  } finally {
    client.release();
  }
};

exports.loginUser = async (req, res) => {
  // Data is already validated by Joi middleware
  const { email, password } = req.body;
  const lowerCaseEmail = email.toLowerCase();

  const pool = getPool();
  const client = await pool.connect();

  try {
    const userQuery = `
      SELECT users_id, password, is_verified, otp, expires_at, role
      FROM users 
      WHERE LOWER(email) = $1;
    `;
    const userResult = await client.query(userQuery, [lowerCaseEmail]);

    if (userResult.rows.length === 0) {
      return errorResponse(res, 401, "Invalid email or password.");
    }

    const user = userResult.rows[0];

    // Validate password
    const decryptedPassword = decrypt(user.password);
    if (decryptedPassword !== password) {
      return errorResponse(res, 401, "Invalid email or password.");
    }

    // Check if user is verified
    if (!user.is_verified) {
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const emailSent = await sendVerificationEmail(lowerCaseEmail, otp);

      if (emailSent) {
        await client.query(
          `UPDATE users SET otp = $1, expires_at = $2 WHERE LOWER(email) = $3;`,
          [otp, expiresAt, lowerCaseEmail]
        );

        return errorResponse(
          res,
          400,
          "Please verify your email before logging in. A new OTP has been sent.",
          `/verify-email?email=${lowerCaseEmail}`
        );
      } else {
        return errorResponse(res, 500, "Failed to send OTP email.");
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.users_id);
    const refreshToken = generateRefreshToken(user.users_id);

    // Store tokens
    const tokenQuery = `
      INSERT INTO users_token (user_id, access_token, refresh_token) 
      VALUES ($1, $2, $3);
    `;
    await client.query(tokenQuery, [user.users_id, accessToken, refreshToken]);

    return successResponse(
      res,
      {
        accessToken,
        refreshToken,
        user: {
          id: user.users_id,
          email: lowerCaseEmail,
          roles: user.role,
        },
      },
      "Login successful."
    );
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.forgotPassword = async (req, res) => {
  const requiredFields = ["email"];
  const requestBody = req.body || {};

  if (!requestBody || Object.keys(requestBody).length === 0) {
    return errorResponse(res, 400, "Invalid request");
  }

  if (!checkRequiredFields(Object.keys(requestBody), requiredFields)) {
    return errorResponse(res, 400, "Invalid request body");
  }

  const { email } = requestBody;
  const lowerCaseEmail = email.toLowerCase();

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `SELECT u.users_id FROM users u WHERE LOWER(u.email) = $1 AND u.is_deleted = FALSE;`;
    const result = await client.query(query, [lowerCaseEmail]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "User not found or inactive.");
    }

    const resetPasswordToken = uuidv4();
    const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const resetLink = `${process.env.FRONTED_BASE_URL}/auth/reset-password?token=${resetPasswordToken}&email=${lowerCaseEmail}`;
    const emailSent = await sendVerificationEmail(
      lowerCaseEmail,
      null,
      resetPasswordToken
    );

    if (emailSent) {
      await client.query(
        `UPDATE users SET reset_password_token = $1, reset_token_expires_at = $2 WHERE LOWER(email) = $3;`,
        [resetPasswordToken, resetTokenExpiresAt, lowerCaseEmail]
      );
      return successResponse(
        res,
        { link: resetLink },
        "Password reset email sent."
      );
    } else {
      return errorResponse(res, 400, "Failed to send reset email.");
    }
  } catch (error) {
    console.error({ error });
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.resetPassword = async (req, res) => {
  const requestBody = req?.body || {};

  if (!requestBody || Object.keys(requestBody).length === 0) {
    return errorResponse(res, 400, "Invalid request");
  }

  const { email, resetPasswordToken, password } = requestBody;

  if (!email) {
    return errorResponse(res, 400, "Email is required.");
  }

  if (!resetPasswordToken) {
    return errorResponse(res, 400, "Reset password token is required.");
  }

  if (!password) {
    return errorResponse(res, 400, "Password is required.");
  }

  const lowerCaseEmail = email.toLowerCase();
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
        SELECT u.reset_token_expires_at, u.users_id
        FROM users u 
        WHERE LOWER(u.email) = $1 
        AND u.reset_password_token = $2 
        AND u.is_deleted = FALSE;
      `;
    const result = await client.query(query, [
      lowerCaseEmail,
      resetPasswordToken,
    ]);

    if (result.rowCount === 0) {
      return errorResponse(
        res,
        400,
        "Invalid or expired token, or email does not exist."
      );
    }

    const { reset_token_expires_at: resetTokenExpiresAt, users_id } =
      result.rows[0];

    if (new Date() > resetTokenExpiresAt) {
      return errorResponse(
        res,
        400,
        "Token has expired. Please request a new password reset."
      );
    }

    const encryptedPassword = encrypt(password);

    await client.query(
      `UPDATE users SET password = $1, reset_password_token = NULL, reset_token_expires_at = NULL WHERE users_id = $2;`,
      [encryptedPassword, users_id]
    );

    return successResponse(
      res,
      null,
      "Password reset successfully. You can now log in with your new password."
    );
  } catch (error) {
    console.error({ error });
    return errorResponse(
      res,
      500,
      "An error occurred while resetting password."
    );
  } finally {
    client.release();
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body || {};

  if (!refreshToken) {
    return errorResponse(res, 400, "Refresh token is missing.");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return errorResponse(res, 401, "Invalid or expired refresh token.");
    }

    const query = `SELECT * FROM users_token WHERE user_id = $1 AND refresh_token = $2;`;
    const result = await client.query(query, [decoded?.userId, refreshToken]);

    if (result.rowCount === 0) {
      return errorResponse(res, 401, "Invalid or expired refresh token.");
    }

    const newAccessToken = generateAccessToken(decoded?.userId);
    await client.query(
      `UPDATE users_token SET access_token = $1 WHERE user_id = $2 AND refresh_token = $3;`,
      [newAccessToken, decoded?.userId, refreshToken]
    );

    return successResponse(
      res,
      { accessToken: newAccessToken },
      "Refresh token updated successfully."
    );
  } catch (error) {
    console.error({ error });
    return errorResponse(
      res,
      error.statusCode || 500,
      error.message || "Internal Server Error"
    );
  } finally {
    if (client) {
      client.release();
    }
  }
};

exports.logoutUser = async (req, res) => {
  const { user } = req;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `DELETE FROM users_token WHERE user_id = $1 AND access_token = $2;`;
    const result = await client.query(query, [
      user?.user_id,
      user?.access_token,
    ]);

    if (result.rowCount === 0) {
      return errorResponse(res, 401, "Invalid or expired refresh token");
    }

    return successResponse(res, null, "User logged out successfully");
  } catch (error) {
    console.error({ error });
    return errorResponse(res, 500, "Internal server error");
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Helper function to send verification email
async function sendVerificationEmail(
  email,
  otp,
  resetPasswordToken = null,
  inviteToken = null
) {
  let subject;
  let verificationLink;
  let text;
  try {
    if (resetPasswordToken) {
      subject = "CRMSimplify - Password Reset Request";
      verificationLink = `${process.env.FRONTED_BASE_URL}/auth/reset-password?token=${resetPasswordToken}&email=${email}`;
      text = `You requested a password reset. Use the following link to reset your password:\n\n${verificationLink}\n\nThis link will expire in 10 minutes.`;
    } else if (inviteToken) {
      subject = "Invitation to Join";
      verificationLink = `You have been invited to join. Please click the following link to accept the invitation: ${process.env.FRONTED_BASE_URL}/auth/accept-invite?token=${inviteToken}&email=${email}`;
      text = `You have been invited to join. Please click the following link to accept the invitation:\n\n${verificationLink}\n\nThis link will expire in 10 minutes.`;
    } else {
      subject = "OTP for Email Verification";
      verificationLink = `${process.env.FRONTED_BASE_URL}/auth/verify-email?email=${email}`;
      text = `Your OTP for email verification is: ${otp}\n\nPlease verify your email by clicking the following link: ${verificationLink}`;
    }

    return await sendEmail(email, subject, text);
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
}
