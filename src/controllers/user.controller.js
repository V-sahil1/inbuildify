const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const sendEmail = require("../helper/sendMail");
const {
  encrypt,
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/common");
const crypto = require("crypto");

exports.getUsersByBuilderId = async (req, res) => {
  const builderId = req.user.builder_id;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const query = `
        SELECT users_id, builder_id, name, email, is_verified, role::TEXT[], created_at, updated_at FROM users 
        WHERE builder_id = $1 AND is_deleted = false;
      `;
    const result = await client.query(query, [builderId]);

    const userData = result.rows.map((user) => ({
      usersId: user.users_id,
      builderId: user.builder_id,
      name: user.name,
      email: user.email,
      isVerified: user.is_verified,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }));
    return successResponse(res, userData, "Users fetched successfully.");
  } catch (error) {
    console.error("Get users error:", error);
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
    const userQuery = `SELECT u.name, u.email, u.role::TEXT[], u.builder_id, u.users_id, u.is_verified, u.root_user, u.created_at, u.updated_at, b.name as builder_name, b.logo, b.slogan, b.firm_name, b.abn_number, b.license_number, b.phone_number FROM users u LEFT JOIN builder b ON u.builder_id = b.builder_id WHERE u.users_id = $1;`;
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
        builderName: userData.builder_name,
        logo: userData.logo,
        slogan: userData.slogan,
        firmName: userData.firm_name,
        isVerified: userData.is_verified,
        abnNumber: userData.abn_number,
        licenseNumber: userData.license_number,
        phoneNumber: userData.phone_number,
        rootUser: userData.root_user,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at,
      },
      "User profile fetched successfully."
    );
  } catch (error) {
    console.error("Get profile error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getInvitedUser = async (req, res) => {
  const { user } = req;

  if (!user) {
    return errorResponse(res, 400, "Your information is missing.");
  }

  const { limit, offset } = req.query || {};
  const parsedLimit = parseInt(limit, 10) || 25;
  const parsedOffset = parseInt(offset, 10) || 0;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const userResult = await client.query(
      `SELECT * FROM invites WHERE builder_id = $1 LIMIT $2 OFFSET $3`,
      [user?.builder_id, parsedLimit, parsedOffset]
    );

    if (userResult?.rows?.length === 0) {
      return successResponse(res, [], "Invited Users get successfully.");
    }

    const totalResult = await client.query(
      `SELECT COUNT(*) FROM invites WHERE builder_id = $1`,
      [user?.builder_id]
    );

    const totalItems = parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / parsedLimit);
    const currentPage = Math.floor(parsedOffset / parsedLimit) + 1;

    return successResponse(
      res,
      {
        users: userResult?.rows?.map((user) => ({
          inviteId: user.invite_id,
          email: user.email,
          inviteToken: user.invite_token,
          builderId: user.builder_id,
          role: user.role,
          expiresAt: user.expires_at,
          invitedAt: user.invited_at,
        })),
        pagination: {
          totalItems,
          totalPages,
          currentPage,
          limit: parsedLimit,
        },
      },
      "Invited Users get successfully."
    );
  } catch (error) {
    console.error("Error updating user role:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.inviteUser = async (req, res) => {
  const roleEnum = [
    "super_admin",
    "admin",
    "project_owner",
    "service_provider",
    "client",
  ];
  const generateToken = () => crypto.randomBytes(20).toString("hex");
  const INVITE_EXPIRATION_MINUTES = 10;

  const { user } = req;

  const { email: inputEmail, role } = req.body;

  if (!inputEmail || !role) {
    console.log("🚀 ~ role (missing):", role);
    console.log("🚀 ~ inputEmail (email):", inputEmail);
    return errorResponse(res, 400, "Missing required fields.");
  }

  if (!roleEnum.includes(role)) {
    console.log("🚀 ~ add specified role:", role);
    return errorResponse(res, 400, "Please add specified role.");
  }

  const email = inputEmail.toLowerCase();
  const pool = getPool();
  const client = await pool.connect();

  try {
    const existingUserQuery = `SELECT * FROM users WHERE email = $1 AND is_deleted = $2`;
    const existingUserResult = await client.query(existingUserQuery, [
      email,
      false,
    ]);

    if (existingUserResult?.rows?.length > 0) {
      console.log("🚀 ~ existingUserResult:", existingUserResult);
      return errorResponse(res, 400, "User email is already exists.");
    }

    const recentInviteQuery = `
        SELECT * FROM invites 
        WHERE email = $1 
        AND builder_id = $2 
        ORDER BY invited_at DESC LIMIT 1
      `;
    const recentInviteResult = await client.query(recentInviteQuery, [
      email,
      user?.builder_id,
    ]);

    if (recentInviteResult?.rows?.length > 0) {
      const existingInvite = recentInviteResult.rows[0];
      const invitedAt = new Date(existingInvite.invited_at);
      const currentTime = new Date();
      const timeDifferenceInMinutes =
        (currentTime.getTime() - invitedAt.getTime()) / 60000;

      if (timeDifferenceInMinutes < INVITE_EXPIRATION_MINUTES) {
        console.log(
          "🚀 ~ INVITE_EXPIRATION_MINUTES:",
          INVITE_EXPIRATION_MINUTES
        );
        console.log("🚀 ~ timeDifferenceInMinutes:", timeDifferenceInMinutes);
        return errorResponse(
          res,
          400,
          "An invite was already sent. Please wait for 10 minutes before sending again."
        );
      }

      await sendVerificationEmail(
        email,
        null,
        existingInvite.invite_token
      );

      const updateInviteQuery = `
          UPDATE invites 
          SET invited_at = NOW() 
          WHERE invite_token = $1
        `;
      await client.query(updateInviteQuery, [existingInvite.invite_token]);

      return successResponse(res, null, "Invitation resent successfully.");
    }

    const inviteToken = generateToken();
    const insertInviteQuery = `INSERT INTO invites (email, invite_token, builder_id, role, expires_at) VALUES ($1, $2, $3, $4, NOW() + '1 days')`;
    await client.query(insertInviteQuery, [
      email,
      inviteToken,
      user?.builder_id,
      role,
    ]);

    await sendVerificationEmail(email, null, inviteToken);

    return successResponse(res, null, "Invitation sent successfully.");
  } catch (error) {
    console.error("Error inviting user:", error);
    return errorResponse(
      res,
      error?.statusCode || 500,
      error.message || "Internal server error"
    );
  } finally {
    client.release();
  }
};

exports.acceptInvite = async (req, res) => {
  const { name, password } = req.body;

  const queryParams = req?.query || {};
  const { token } = queryParams;

  if (!token || !name || !password) {
    console.log("🚀 ~ name:", name);
    return errorResponse(res, 400, "Missing required fields");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const inviteQuery = `SELECT * FROM invites WHERE invite_token = $1 AND expires_at > NOW()`;
    const inviteResult = await client.query(inviteQuery, [token]);

    if (inviteResult?.rows?.length === 0) {
      console.log(
        "🚀 ~ inviteResult (Invalid or expired invitation):",
        inviteResult
      );
      await client.query("ROLLBACK");
      return errorResponse(res, 401, "Invalid or expired invitation.");
    }

    const invite = inviteResult.rows[0];
    const hashedPassword = encrypt(password);

    const insertUserQuery = `INSERT INTO users (builder_id, name, email, password, role, root_user, is_verified, created_at) VALUES ($1, $2, $3, $4, ARRAY[$5]::users_role_enum[], FALSE, TRUE, NOW()) RETURNING users_id;`;
    const userResult = await client.query(insertUserQuery, [
      invite.builder_id,
      name,
      invite.email,
      hashedPassword,
      invite.role,
    ]);

    await client.query(`DELETE FROM invites WHERE invite_token = $1`, [token]);

    // Generate tokens
    const accessToken = generateAccessToken(userResult.rows[0].users_id);
    const refreshToken = generateRefreshToken(userResult.rows[0].users_id);

    // Store tokens
    const tokenQuery = `
        INSERT INTO users_token (user_id, access_token, refresh_token) 
        VALUES ($1, $2, $3);
      `;
    await client.query(tokenQuery, [
      userResult.rows[0].users_id,
      accessToken,
      refreshToken,
    ]);

    return successResponse(
      res,
      {
        accessToken,
        refreshToken,
        user: {
          id: userResult.rows[0].users_id,
          email: invite.email,
          roles: invite.role,
        },
      },
      "Login successful."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error accepting invitation:", error);
    return errorResponse(
      res,
      error?.statusCode || 500,
      error.message || "Internal server error"
    );
  } finally {
    client.release();
    await client.query("COMMIT");
  }
};

async function sendVerificationEmail(
  email,
  otp,
  inviteToken = null
) {
  let subject;
  let verificationLink;
  let text;
  try {
    if (inviteToken) {
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