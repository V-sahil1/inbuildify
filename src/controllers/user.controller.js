const { successResponse, errorResponse } = require("../helper/response");
const getPool = require("../config/database");
const {
  generateOtp,
  encrypt,
  decrypt,
  generateAccessToken,
  generateRefreshToken,
  keysToCamelCase,
} = require("../utils/common");
const sendEmail = require("../helper/sendMail");

exports.registerUser = async (req, res) => {
  // Data is already validated by Joi middleware, so we can trust it's clean
  const { name, email, password, role = 'user', phone } = req.body;
  const lowerCaseEmail = email.toLowerCase();

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Check if user already exists
    const existingUserQuery = `
      SELECT u.is_verified, u.expires_at, b.email 
      FROM users u 
      JOIN builder b ON u.builder_id = b.builder_id 
      WHERE LOWER(b.email) = $1;
    `;
    const existingUserResult = await client.query(existingUserQuery, [lowerCaseEmail]);

    if (existingUserResult.rowCount > 0) {
      const { is_verified } = existingUserResult.rows[0];

      if (is_verified) {
        return errorResponse(res, 409, "User already exists and is verified.");
      }

      // User exists but not verified, send new OTP
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

    // Create new user
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const emailSent = await sendVerificationEmail(lowerCaseEmail, otp);

    if (!emailSent) {
      return errorResponse(res, 500, "Failed to send verification email.");
    }

    await client.query('BEGIN');

    try {
      // Insert into builder table
      const builderResult = await client.query(
        `INSERT INTO builder (name, email, phone) VALUES ($1, $2, $3) RETURNING builder_id;`,
        [name, lowerCaseEmail, phone || null]
      );
      const builderId = builderResult.rows[0].builder_id;

      // Insert into users table
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
          role === 'admin',
          otp,
          expiresAt,
        ]
      );

      await client.query('COMMIT');

      return successResponse(
        res,
        {
          message: "User registered successfully. Please check your email for verification.",
          link: `/verify-email?email=${lowerCaseEmail}`,
        },
        "User registered successfully."
      );
    } catch (insertError) {
      await client.query('ROLLBACK');
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
        
        return successResponse(
          res,
          { link: `/verify-email?email=${lowerCaseEmail}` },
          "Please verify your email before logging in. A new OTP has been sent."
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
          roles: user.role
        }
      },
      "Login successful."
    );

  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getProfile = async (req, res) => {
  const userId = req.user.users_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const userQuery = `SELECT name, email, role::TEXT[], builder_id, users_id, is_verified, root_user, created_at, updated_at FROM users WHERE users_id = $1;`;
    const userResult = await client.query(userQuery, [userId]);

    if (userResult.rowCount === 0) {
      return errorResponse(res, 404, "User not found.");
    }

    const userData = userResult.rows[0];
    
    return successResponse(
      res,
      {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        builderId: userData.builder_id,
        isVerified: userData.is_verified,
        rootUser: userData.root_user,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at,
      },
      "User profile fetched successfully."
    );

  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.forgotPassword = async (req, res) => {
  const requiredFields = ["email"];

  if (!req.body || Object.keys(req.body).length === 0) {
    return errorResponse(res, 400, "Invalid request");
  }

  if (!checkRequiredFields(Object.keys(req.body), requiredFields)) {
    return errorResponse(
      res,
      400,
      `Invalid request body, requireFields: ${requiredFields.join(", ")}`
    );
  }

  const { email } = req.body;
  const lowerCaseEmail = email.toLowerCase();

  const pool = getPool();
  const client = await pool.connect();

  try {
    const userQuery = `SELECT users_id, password FROM users WHERE LOWER(email) = $1;`;
    const userResult = await client.query(userQuery, [lowerCaseEmail]);

    if (userResult.rowCount === 0) {
      return errorResponse(res, 404, "User not found.");
    }

    const user = userResult.rows[0];

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const subject = "OTP for Password Reset";
    const verificationLink = `${process.env.FRONTED_BASE_URL}/reset-password?email=${lowerCaseEmail}`;
    const text = `Your OTP for password reset is: ${otp}\n\nPlease reset your password by clicking the following link: ${verificationLink}`;

    const emailVerify = await sendEmail(lowerCaseEmail, subject, text);

    if (emailVerify) {
      await client.query(
        `UPDATE users SET otp = $1, expires_at = $2 WHERE LOWER(email) = $3;`,
        [otp, expiresAt, user?.email]
      );
      return successResponse(
        res,
        {
          message: "A new OTP has been sent to your email.",
          link: `/reset-password?email=${lowerCaseEmail}`,
        },
        "OTP sent successfully."
      );
    } else {
      console.log("🚀 ~ emailVerify:", emailVerify);
      return errorResponse(res, 400, "Failed to send OTP email.");
    }
  } catch (error) {
    console.error({ error });
    return errorResponse(
      res,
      error.statusCode || 500,
      error.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};

exports.verifyOtp = async (req, res) => {
  const requiredFields = ["email", "otp"];
  const requestBody = req?.body || {};

  if (!requestBody || Object.keys(requestBody).length === 0) {
    return errorResponse(res, 400, "Invalid request: Empty request body");
  }

  if (!checkRequiredFields(Object.keys(requestBody), requiredFields)) {
    return errorResponse(res, 400, `Invalid request body: ${requiredFields}`);
  }

  const { email, otp } = requestBody;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const userQuery = `SELECT users_id, otp, expires_at, is_verified FROM users WHERE email = $1;`;
    const userResult = await client.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return errorResponse(res, 400, "User not found.");
    }

    const user = userResult.rows[0];

    if (user.is_verified) {
      return errorResponse(res, 400, "User is already verified.");
    }

    const currentTime = new Date();
    const otpExpiryTime = new Date(user.expires_at);

    if (otp !== user.otp) {
      return errorResponse(res, 400, "Invalid or expired OTP.");
    }

    if (currentTime > otpExpiryTime) {
      return errorResponse(res, 400, "OTP has expired.");
    }

    await client.query(
      `UPDATE users SET is_verified = $1, otp = NULL, expires_at = NULL WHERE email = $2;`,
      [true, email]
    );

    const accessToken = generateAccessToken(user.users_id);
    const refreshToken = generateRefreshToken(user.users_id);

    await client.query(
      `INSERT INTO user_token (user_id, access_token, refresh_token) VALUES ($1, $2, $3);`,
      [user.users_id, accessToken, refreshToken]
    );

    return successResponse(
      res,
      {
        accessToken,
        refreshToken,
      },
      "User verified successfully."
    );
  } catch (error) {
    console.error({ error });
    return errorResponse(res, 500, "An error occurred while verifying OTP.");
  } finally {
    client.release();
  }
};

exports.resendOtp = async (req, res) => {
  const requiredFields = ["email"];
  const requestBody = req.body || {};

  if (!requestBody || Object.keys(requestBody).length === 0) {
    return errorResponse(res, 400, "Invalid request");
  }

  if (!checkRequiredFields(Object.keys(requestBody), requiredFields)) {
    return errorResponse(res, 400, `Invalid request body: ${requiredFields}`);
  }

  const { email } = requestBody;

  try {
    const pool = getPool();
    const client = await pool.connect();

    const userQuery = `SELECT users_id, otp, expires_at FROM users WHERE email = $1;`;
    const userResult = await client.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return errorResponse(res, 400, "User not found.");
    }

    const user = userResult.rows[0];
    const currentTime = new Date();
    const otpExpiryTime = new Date(user.expires_at);

    if (currentTime < otpExpiryTime) {
      return errorResponse(
        res,
        400,
        `Cannot resend OTP before the previous one expires. ${otpExpiryTime.toISOString()}`
      );
    }

    const newOtp = generateOtp();
    const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await client.query(
      `UPDATE users SET otp = $1, expires_at = $2 WHERE email = $3;`,
      [newOtp, newExpiresAt, email]
    );

    const subject = "Resend OTP for Email Verification";
    const text = `Your new OTP for email verification is: ${newOtp}`;

    const emailSent = await sendEmail(email, subject, text);

    if (emailSent) {
      return successResponse(
        res,
        {
          expiresAt: newExpiresAt.toISOString(),
        },
        "New OTP sent successfully."
      );
    } else {
      return errorResponse(res, 500, "Failed to send OTP email.");
    }
  } catch (error) {
    console.error({ error });
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

// Helper function to send verification email
async function sendVerificationEmail(email, otp) {
  try {
    const subject = "OTP for Email Verification";
    const verificationLink = `${process.env.FRONTED_BASE_URL}/verify-email?email=${email}`;
    const text = `Your OTP for email verification is: ${otp}\n\nPlease verify your email by clicking the following link: ${verificationLink}`;

    return await sendEmail(email, subject, text);
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}