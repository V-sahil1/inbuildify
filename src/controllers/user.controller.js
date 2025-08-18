const { successResponse, errorResponse } = require("../helper/response");
const getPool = require("../config/database");
const {
  generateOtp,
  checkRequiredFields,
  checkValidEmail,
  encrypt,
  decrypt,
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/common");
const sendEmail = require("../helper/sendMail.js");

exports.createUser = async (req, res) => {
  const requiredFields = ["name", "email", "password"];

  if (!req.body || Object.keys(req.body).length === 0) {
    return errorResponse(res, 400, "Invalid request");
  }

  if (!checkRequiredFields(Object.keys(req.body), requiredFields)) {
    return errorResponse(res, 400, "Invalid request body");
  }

  const { name, email, password } = req.body;
  const lowerCaseEmail = email.toLowerCase();

  if (!checkValidEmail(lowerCaseEmail)) {
    return errorResponse(res, 400, "Invalid email");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `SELECT u.is_verified, u.expires_at, b.email FROM users u JOIN builder b ON u.builder_id = b.builder_id WHERE LOWER(b.email) = $1;`;
    const result = await client.query(query, [lowerCaseEmail]);

    if (result.rowCount > 0) {
      const { is_verified } = result.rows[0];

      if (is_verified) {
        console.log("🚀 ~ is_verified:", is_verified);
        return errorResponse(res, 400, "User already exists.");
      }

      const otp = generateOtp();
      const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const subject = "OTP for Email Verification";
      const verificationLink = `${process.env.FRONTED_BASE_URL}/verify-email?email=${lowerCaseEmail}`;
      const text = `Your new OTP for email verification is: ${otp}\n\nPlease verify your email by clicking the following link: ${verificationLink}`;

      const emailVerify = await sendEmail(lowerCaseEmail, subject, text);

      if (emailVerify) {
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
        console.log("🚀 ~ emailVerify:", emailVerify);
        return errorResponse(res, 400, "Failed to send OTP email.");
      }
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const subject = "OTP for Email Verification";
    const verificationLink = `${process.env.FRONTED_BASE_URL}/verify-email?email=${lowerCaseEmail}`;
    const text = `Your OTP for email verification is: ${otp}\n\nPlease verify your email by clicking the following link: ${verificationLink}`;

    const emailVerify = await sendEmail(lowerCaseEmail, subject, text);

    if (emailVerify) {
      const builderResult = await client.query(
        `INSERT INTO builder (name, email) VALUES ($1, $2) RETURNING *;`,
        [name, lowerCaseEmail]
      );
      const builderId = builderResult.rows[0].builder_id;

      await client.query(
        `INSERT INTO users (account_roles, builder_id, name, email, password, root_user, otp, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          ["administrator"],
          builderId,
          name,
          lowerCaseEmail,
          encrypt(password),
          true,
          otp,
          expiresAt,
        ]
      );

      return successResponse(
        res,
        {
          message: "User registered successfully.",
          link: `/verify-email?email=${lowerCaseEmail}`,
        },
        "User registered successfully."
      );
    } else {
      console.log("🚀 ~ emailVerify:", emailVerify);
      return errorResponse(res, 400, "Failed to send email.");
    }
  } catch (error) {
    console.error({ error });
    return errorResponse(res, 400, "Failed to create user.");
  } finally {
    client.release();
  }
};

exports.loginUser = async (req, res) => {
  const requiredFields = ["email", "password"];
  const requestBody = req.body || {};

  // Validate the request body
  if (!requestBody || Object.keys(requestBody).length === 0) {
    return errorResponse(res, 400, "Invalid request");
  }

  if (!checkRequiredFields(Object.keys(requestBody), requiredFields)) {
    return errorResponse(
      res,
      400,
      `Invalid request body, requireFields: ${requiredFields.join(", ")}`
    );
  }

  const { email, password } = requestBody;
  const lowerCaseEmail = email.toLowerCase();

  const pool = getPool();
  const client = await pool.connect();

  try {
    const userQuery = `SELECT users_id, password, is_verified, otp, expires_at FROM users WHERE LOWER(email) = $1;`;
    const userResult = await client.query(userQuery, [lowerCaseEmail]);

    if (userResult.rows.length === 0) {
      return errorResponse(res, 400, "Invalid email or password");
    }

    const user = userResult.rows[0];
    console.log("🚀 ~ user.controller.js:157 ~ user:", user);

    // Validate the password
    const isPasswordValid = decrypt(user?.password);
    if (isPasswordValid !== password) {
      return errorResponse(res, 400, "Invalid Credentials for password");
    }

    if (!user.is_verified) {
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const subject = "OTP for Email Verification";
      const verificationLink = `${process.env.FRONTED_BASE_URL}/verify-email`;
      const text = `Your OTP for email verification is: ${otp}\n\nPlease verify your email by clicking the following link: ${verificationLink}?email=${lowerCaseEmail}`;

      const emailVerify = await sendEmail(lowerCaseEmail, subject, text);

      if (emailVerify) {
        await client.query(
          `UPDATE users SET otp = $1, expires_at = $2 WHERE LOWER(email) = $3;`,
          [otp, expiresAt, lowerCaseEmail]
        );
        return successResponse(
          res,
          { link: `/verify-email?email=${email}` },
          "A new OTP has been sent to your email. Please verify your email before logging in."
        );
      } else {
        return errorResponse(res, 500, "Failed to send OTP email.");
      }
    }
    const accessToken = generateAccessToken(user.users_id);
    const refreshToken = generateRefreshToken(user.users_id);

    const tokenQuery = `INSERT INTO users_token (user_id, access_token, refresh_token) VALUES ($1, $2, $3);`;
    await client.query(tokenQuery, [user.users_id, accessToken, refreshToken]);

    return successResponse(
      res,
      {
        accessToken,
        refreshToken,
      },
      "Login successful."
    );
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