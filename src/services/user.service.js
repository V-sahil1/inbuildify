const userRepo = require("../repositories/user.repository");
const addressRepo = require("../repositories/address.repository");
const builderRepo = require("../repositories/builder.repository");
const tokenRepo = require("../repositories/token.repository");

const { deleteFromS3 } = require("../utils/s3Upload");

const {
  generateStrongPassword,
  validatePasswordPolicy,
} = require("../utils/password.util");

const {
  sendPasswordEmail,
  sendLoginIdEmail,
} = require("../service/email.service");

const { encrypt } = require("../utils/crypto.util");

/* ----------------------------------------
      GET ALL USERS FOR CURRENT BUILDER
  ---------------------------------------- */
async function getUsers(currentUser, query) {
  const builderId = currentUser.builder_id;
  const { page = 1, limit = 25, search = "", role = "" } = query;

  return await userRepo.getUsers({
    builderId,
    page,
    limit,
    search,
    role,
  });
}

/* ----------------------------------------
      GET OWN PROFILE
  ---------------------------------------- */
async function getProfile(userId) {
  const profile = await userRepo.getProfile(userId);
  if (!profile) {
    throw { status: 404, message: "User not found." };
  }
  return profile;
}

/* ----------------------------------------
        CREATE USER (ADMIN UI)
  ---------------------------------------- */
async function createUser(currentUser, body, files) {
  const {
    name,
    email,
    login_id,
    role_id,
    phone,
    secondary_phone,
    initials,
    reporting_to,
    date_of_joining,
    date_of_birth,
    designation,
    remark,
    consultant_bio,
    use_company_address,
    password_option,
    manual_password,
    next_login_password_change,
    email_login_credentials,
    builder_id, // Single builder ID instead of builders array
    address, // JSON string if provided
  } = body;

  /* --------------------------
        VALIDATIONS
    --------------------------- */

  // Login ID validation
  if (login_id && !/^[A-Za-z0-9._@-]+$/.test(login_id)) {
    throw {
      status: 400,
      message:
        "Invalid login ID. Only alphanumeric, dot, underscore, hyphen, and @ allowed.",
    };
  }

  // Unique email
  const emailExists = await userRepo.findByEmail(email.toLowerCase());
  if (emailExists) {
    if (emailExists.isDeleted) {
      throw {
        status: 400,
        message:
          "Email already exists for a deleted user. Please contact admin to restore the account or use a different email.",
      };
    } else {
      throw { status: 400, message: "Email already exists." };
    }
  }

  // Unique login ID
  if (login_id) {
    const loginExists = await userRepo.findByLoginId(login_id);
    if (loginExists) {
      if (loginExists.isDeleted) {
        throw {
          status: 400,
          message:
            "Login ID already exists for a deleted user. Please contact admin to restore the account or use a different login ID.",
        };
      } else {
        throw { status: 400, message: "Login ID already exists." };
      }
    }
  }

  /* --------------------------
       PASSWORD GENERATION
    --------------------------- */

  let finalPassword;

  if (password_option === "manual") {
    if (!manual_password) {
      throw { status: 400, message: "Manual password is required." };
    }
    if (!validatePasswordPolicy(manual_password)) {
      throw {
        status: 400,
        message:
          "Password must be minimum 8 characters with uppercase, lowercase, and number.",
      };
    }
    finalPassword = manual_password;
  } else {
    // Auto-generate
    finalPassword = generateStrongPassword();
  }

  const encryptedPassword = finalPassword ? encrypt(finalPassword) : null;

  /* --------------------------
       ADDRESS CREATE OR USE BUILDER
    --------------------------- */

  let addressId = null;

  if (use_company_address === "true") {
    const builderAddress = await builderRepo.getBuilderAddress(
      currentUser.builder_id,
    );
    addressId = builderAddress || null;
  } else if (address) {
    const parsedAddress =
      typeof address === "string" ? JSON.parse(address) : address;
    addressId = await addressRepo.createOrUpdateAddress(null, parsedAddress);
  }

  /* --------------------------
          CREATE USER RECORD
    --------------------------- */

  const user = await userRepo.createUser({
    name,
    email: email.toLowerCase(),
    login_id: login_id || null,
    password: encryptedPassword,
    role_id,
    phone,
    secondary_phone,
    initials,
    reporting_to,
    date_of_joining,
    date_of_birth,
    designation,
    remark,
    consultant_bio,
    address_id: addressId,
    use_company_address: use_company_address === "true",
    root_user: false,
    has_login: true,
    next_login_password_change: next_login_password_change === "true",
    builder_id: builder_id || null,
  });

  const userId = user.user_id;

  /* --------------------------
        PHOTO + SIGNATURE
    --------------------------- */

  if (files.photo) {
    const file = files.photo;
    const url = file.location;
    await userRepo.updatePhoto(userId, url);
  }

  if (files.signature) {
    const file = files.signature;
    const url = file.location;
    await userRepo.updateSignature(userId, url);
  }

  /* --------------------------
         EMAIL LOGIN CREDENTIALS
    --------------------------- */

  // Send email if auto password was generated or if email credentials flag is explicitly set
  const isAutoGenerated = password_option !== "manual" && finalPassword;

  if (isAutoGenerated || email_login_credentials === "true") {
    try {
      await sendPasswordEmail(email, login_id, finalPassword);
    } catch (error) {
      console.error("Failed to send password email:", error);
      // Don't throw error to prevent user creation failure
    }
  }

  return {
    userId,
    email,
    login_id,
    role_id,
  };
}

/* ----------------------------------------
            UPDATE USER
  ---------------------------------------- */
async function updateUser(currentUser, userId, body, files) {
  /* --------------------------
        ROOT USER PROTECTION
    --------------------------- */
  const targetUser = await userRepo.getBasicUser(userId);

  if (!targetUser) {
    throw { status: 404, message: "User not found." };
  }

  if (targetUser.root_user) {
    throw { status: 403, message: "Root user cannot be modified." };
  }

  /* --------------------------
        LOGIN ID VALIDATION
    --------------------------- */
  if (body.login_id) {
    if (!/^[A-Za-z0-9._@-]+$/.test(body.login_id)) {
      throw {
        status: 400,
        message:
          "Invalid login ID. Only alphanumeric, dot, underscore, hyphen, and @ allowed.",
      };
    }

    const exists = await userRepo.findByLoginId(body.login_id);
    if (exists && exists.user_id !== userId) {
      throw { status: 400, message: "Login ID already exists." };
    }
  }

  /* --------------------------
         EMAIL CHANGE VALIDATION
    --------------------------- */
  if (body.email) {
    const emailExists = await userRepo.findByEmail(body.email.toLowerCase());
    if (emailExists && emailExists.user_id !== userId) {
      throw { status: 400, message: "Email already exists." };
    }
  }

  /* --------------------------
            ADDRESS HANDLING
    --------------------------- */
  let addressId = targetUser.address_id;

  if (body.use_company_address === "true") {
    const builderAddress = await builderRepo.getBuilderAddress(
      targetUser.builder_id,
    );
    addressId = builderAddress;
  } else if (body.address) {
    const parsed =
      typeof body.address === "string"
        ? JSON.parse(body.address)
        : body.address;
    addressId = await addressRepo.createOrUpdateAddress(addressId, parsed);
  }

  /* --------------------------
            UPDATE USER
    --------------------------- */

  const updateData = {
    ...body,
    email: body.email?.toLowerCase(),
    address_id: addressId,
    use_company_address: body.use_company_address === "true",
  };

  await userRepo.updateUser(userId, updateData);

  /* --------------------------
         SINGLE BUILDER MANAGEMENT
    --------------------------- */
  if (body.builder_id) {
    // Check if user already has a builder assigned (and it's different)
    const existingBuilder = await userRepo.getUserBuilder(userId);
    if (existingBuilder && existingBuilder.builder_id !== body.builder_id) {
      throw {
        status: 400,
        message:
          "User already has a builder assigned. Each user can only have one builder.",
      };
    }

    if (!existingBuilder) {
      // Assign single builder to user
      await userRepo.setUserBuilder(userId, body.builder_id);
    }
  }

  /* --------------------------
        PHOTO & SIGNATURE
    --------------------------- */

  if (files.photo) {
    if (targetUser.photo) await deleteFromS3(targetUser.photo);
    await userRepo.updatePhoto(userId, files.photo.location);
  }

  if (files.signature) {
    if (targetUser.signature) await deleteFromS3(targetUser.signature);
    await userRepo.updateSignature(userId, files.signature.location);
  }

  return { userId };
}

/* ----------------------------------------
            SOFT DELETE USER
  ---------------------------------------- */
async function deleteUser(currentUser, userId) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) throw { status: 404, message: "User not found." };
  if (user.root_user)
    throw { status: 403, message: "Cannot delete root user." };

  await userRepo.softDeleteUser(userId);

  return { userId };
}

/* ----------------------------------------
            RESET PASSWORD
  ---------------------------------------- */
async function resetPassword(currentUser, userId, body) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) throw { status: 404, message: "User not found." };
  if (user.root_user)
    throw { status: 403, message: "Cannot reset root user password." };

  const {
    password_option,
    manual_password,
    next_login_password_change,
    email_password,
  } = body;

  let newPassword;

  if (password_option === "manual") {
    if (!manual_password)
      throw { status: 400, message: "Manual password missing." };
    if (!validatePasswordPolicy(manual_password)) {
      throw {
        status: 400,
        message:
          "Password must be minimum 8 characters with uppercase, lowercase, and number.",
      };
    }
    newPassword = manual_password;
  } else {
    newPassword = generateStrongPassword();
  }

  const encrypted = encrypt(newPassword);

  await userRepo.updatePassword(
    userId,
    encrypted,
    next_login_password_change === "true",
  );

  if (email_password === "true") {
    await sendPasswordEmail(user.email, user.login_id, newPassword);
  }

  return { userId };
}

/* ----------------------------------------
            CHANGE LOGIN ID
  ---------------------------------------- */
async function changeLoginId(currentUser, userId, body) {
  const { new_login_id, email_login_id } = body;

  if (!/^[A-Za-z0-9._@-]+$/.test(new_login_id)) {
    throw {
      status: 400,
      message:
        "Invalid login ID. Only A–Z, a–z, 0–9, dot, hyphen, underscore, @ allowed.",
    };
  }

  const user = await userRepo.getBasicUser(userId);
  if (!user) throw { status: 404, message: "User not found." };
  if (user.root_user)
    throw { status: 403, message: "Cannot change root login ID." };

  const exists = await userRepo.findByLoginId(new_login_id);
  if (exists && exists.user_id !== userId) {
    throw { status: 400, message: "Login ID already exists." };
  }

  await userRepo.updateLoginId(userId, new_login_id);

  if (email_login_id === "true") {
    await sendLoginIdEmail(user.email, new_login_id);
  }

  return { userId, new_login_id };
}

/* ----------------------------------------
            ACTIVE / INACTIVE
  ---------------------------------------- */
async function toggleActive(currentUser, userId) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) throw { status: 404, message: "User not found." };
  if (user.root_user)
    throw { status: 403, message: "Cannot modify root user." };

  const newValue = !user.is_active;

  await userRepo.updateActiveStatus(userId, newValue);

  return { userId, is_active: newValue };
}

/* ----------------------------------------
            LOCK / UNLOCK USER
  ---------------------------------------- */
async function toggleLock(currentUser, userId) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) throw { status: 404, message: "User not found." };
  if (user.root_user) throw { status: 403, message: "Cannot lock root user." };

  const newValue = !user.is_locked;

  await userRepo.updateLockStatus(userId, newValue);

  if (newValue === true) {
    await tokenRepo.invalidateUserSessions(userId);
  }

  return { userId, is_locked: newValue };
}

/* ----------------------------------------
            PHOTO UPDATE
  ---------------------------------------- */
async function updatePhoto(currentUser, userId, file) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) throw { status: 404, message: "User not found." };
  if (user.root_user)
    throw { status: 403, message: "Cannot modify root user." };

  if (user.photo) await deleteFromS3(user.photo);

  await userRepo.updatePhoto(userId, file.location);

  return { userId, photo: file.location };
}

/* ----------------------------------------
            SIGNATURE UPDATE
  ---------------------------------------- */
async function updateSignature(currentUser, userId, file) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) throw { status: 404, message: "User not found." };
  if (user.root_user)
    throw { status: 403, message: "Cannot modify root user." };

  if (user.signature) await deleteFromS3(user.signature);

  await userRepo.updateSignature(userId, file.location);

  return { userId, signature: file.location };
}

/* ----------------------------------------
            DELETE PHOTO
  ---------------------------------------- */
async function deletePhoto(currentUser, userId) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) throw { status: 404, message: "User not found." };
  if (!user.photo) throw { status: 400, message: "No photo exists." };

  await deleteFromS3(user.photo);
  await userRepo.updatePhoto(userId, null);

  return { userId };
}

/* ----------------------------------------
            DELETE SIGNATURE
  ---------------------------------------- */
async function deleteSignature(currentUser, userId) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) throw { status: 404, message: "User not found." };
  if (!user.signature) throw { status: 400, message: "No signature exists." };

  await deleteFromS3(user.signature);
  await userRepo.updateSignature(userId, null);

  return { userId };
}

module.exports = {
  getUsers,
  getProfile,
  createUser,
  updateUser,
  resetPassword,
  changeLoginId,
  toggleActive,
  toggleLock,
  updatePhoto,
  updateSignature,
  deletePhoto,
  deleteSignature,
  deleteUser,
};
