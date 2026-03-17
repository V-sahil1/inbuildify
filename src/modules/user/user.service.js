import userRepo from "./user.repository.js";
import addressRepo from "../../repositories/address.repository.js";
import builderRepo from "../../repositories/builder.repository.js";
import tokenRepo from "../../repositories/token.repository.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";
import { generateStrongPassword, validatePasswordPolicy } from "../../utils/password.util.js";
import { sendPasswordEmail, sendLoginIdEmail } from "../../service/email.service.js";
import { encrypt } from "../../utils/crypto.util.js";

/* ----------------------------------------
      GET ALL USERS FOR CURRENT BUILDER
  ---------------------------------------- */
export async function getUsers(currentUser, query) {
  const builderId = currentUser.builder_id;
  console.log(query);
  const { search = "", role = "", role_id = "", is_active } = query;
  console.log("🚀 ~ getUsers ~ is_active:", is_active);
  console.log("🚀 ~ getUsers ~ role_id:", role_id);
  console.log("🚀 ~ getUsers ~ role:", role);
  console.log("🚀 ~ getUsers ~ search:", search);

  return await userRepo.getAllUsers({
    builderId,
    search,
    role,
    role_id,
    is_active,
  });
}

/* ----------------------------------------
      GET OWN PROFILE
  ---------------------------------------- */
export async function getProfile(userId) {
  const profile = await userRepo.getProfile(userId);
  if (!profile) {
    throw { status: 404, message: "User not found." };
  }
  return profile;
}

/* ----------------------------------------
      GET BASIC USER
  ---------------------------------------- */
export async function getBasicUser(userId) {
  const user = await userRepo.getBasicUser(userId);
  return user;
}

/* ----------------------------------------
        CREATE USER (ADMIN UI)
  ---------------------------------------- */
export async function createUser(currentUser, body, files) {
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
    password_auto_generated,
    manual_password,
    next_login_password_change,
    email_login_credentials,
    address,
  } = body;

  /* --------------------------
        VALIDATIONS
    --------------------------- */

  if (login_id && !/^[A-Za-z0-9._@-]+$/.test(login_id)) {
    throw {
      status: 400,
      message:
        "Invalid login ID. Only alphanumeric, dot, underscore, hyphen, and @ allowed.",
    };
  }

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

  let finalPassword;

  if (
    password_auto_generated === false ||
    password_auto_generated === "false"
  ) {
    // Manual password
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
       ADDRESS CREATE OR USE COMPANY ADDRESS
    --------------------------- */

  let addressId = null;

  if (use_company_address === "true" || use_company_address === true) {
    const companyAddress = await builderRepo.getCompanyAddress(
      currentUser.builder_id,
    );
    if (companyAddress) {
      if (
        !companyAddress.address_line1 ||
        companyAddress.address_line1.trim() === ""
      ) {
        throw new Error(
          "Company address line 1 is required. Please update company address before creating user with company address.",
        );
      }

      const newAddress = {
        address_line1: companyAddress.address_line1,
        address_line2: companyAddress.address_line2,
        city: companyAddress.city,
        zip_code: companyAddress.zip_code,
        country_id: companyAddress.country_id,
        state_id: companyAddress.state_id,
      };
      addressId = await addressRepo.createOrUpdateAddress(null, newAddress);
    }
  } else if (address) {
    addressId = await addressRepo.createOrUpdateAddress(null, address);
  }

  /* --------------------------
          CREATE USER RECORD
    --------------------------- */

  try {
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
      builder_id: currentUser.builder_id,
      is_verified: true,
      password_auto_generated:
        password_auto_generated === "true" || password_auto_generated === true,
    });

    const userId = user.usersId || user.user_id;

    /* --------------------------
          PHOTO + SIGNATURE
    --------------------------- */

    if (files.photo) {
      const file = files.photo;
      if (file.location) {
        await userRepo.updatePhoto(userId, file.location);
      }
    }

    if (files.signature) {
      const file = files.signature;
      if (file.location) {
        await userRepo.updateSignature(userId, file.location);
      }
    }

    const createdUser = await userRepo.getAllUsers({
      builderId: currentUser.builder_id,
      search: email,
      role: "",
      role_id: "",
    });

    /* --------------------------
           EMAIL LOGIN CREDENTIALS
      --------------------------- */

    const isAutoGenerated =
      (password_auto_generated === true ||
        password_auto_generated === "true") &&
      finalPassword;

    const shouldSendEmail =
      isAutoGenerated || email_login_credentials === "true";

    if (shouldSendEmail) {
      try {
        await sendPasswordEmail(email, login_id, finalPassword);
      } catch (error) {}
    }

    const newUser = createdUser.find(
      (user) => user.email === email.toLowerCase(),
    );

    if (newUser) {
      if (password_auto_generated !== undefined) {
        newUser.password_auto_generated =
          password_auto_generated === "true" ||
          password_auto_generated === true;
      }

      if (
        password_auto_generated === true ||
        password_auto_generated === "true"
      ) {
        newUser.email_login_credentials = true;
      } else if (email_login_credentials !== undefined) {
        newUser.email_login_credentials = email_login_credentials === "true";
      }
    }

    return newUser || createdUser[0];
  } catch (error) {
    throw error;
  }
}

/* ----------------------------------------
            UPDATE USER
  ---------------------------------------- */
export async function updateUser(currentUser, userId, body, files) {
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
  let addressId = targetUser.addressId;

  if (body.use_company_address === "true") {
    const companyAddress = await builderRepo.getCompanyAddress(
      targetUser.builderId,
    );
    if (companyAddress && addressId) {
      const companyAddressDetails = {
        address_line1: companyAddress.address_line1,
        address_line2: companyAddress.address_line2,
        city: companyAddress.city,
        zip_code: companyAddress.zip_code,
        country_id: companyAddress.country_id,
        state_id: companyAddress.state_id,
      };
      addressId = await addressRepo.createOrUpdateAddress(
        addressId,
        companyAddressDetails,
      );
    } else {
      addressId = companyAddress?.address_id || null;
    }
  } else if (body.address && addressId) {
    const companyAddress = await builderRepo.getCompanyAddress(
      targetUser.builderId,
    );

    if (companyAddress && companyAddress.address_id === addressId) {
      addressId = await addressRepo.createOrUpdateAddress(null, body.address);
    } else {
      addressId = await addressRepo.createOrUpdateAddress(
        addressId,
        body.address,
      );
    }
  } else if (body.address && !addressId) {
    throw {
      status: 400,
      message:
        "User has no existing address. Cannot update non-existent address.",
    };
  }

  /* --------------------------
            PASSWORD HANDLING
    --------------------------- */

  if (body.password_auto_generated !== undefined) {
    // If password is auto-generated, validate that manual fields are not provided
    if (
      body.password_auto_generated === true ||
      body.password_auto_generated === "true"
    ) {
      if (body.manual_password) {
        throw {
          status: 400,
          message:
            "Manual password cannot be provided when password is auto-generated.",
        };
      }
      if (body.email_login_credentials !== undefined) {
        throw {
          status: 400,
          message:
            "Email login credentials cannot be set when password is auto-generated.",
        };
      }
      if (body.next_login_password_change !== undefined) {
        throw {
          status: 400,
          message:
            "Next login password change cannot be set when password is auto-generated.",
        };
      }
    }

    let newPassword;
    let encryptedPassword;

    if (
      body.password_auto_generated === false ||
      body.password_auto_generated === "false"
    ) {
      // Manual password required
      if (!body.manual_password) {
        throw {
          status: 400,
          message:
            "Manual password is required when password_auto_generated is false.",
        };
      }
      if (!validatePasswordPolicy(body.manual_password)) {
        throw {
          status: 400,
          message:
            "Password must be minimum 8 characters with uppercase, lowercase, and number.",
        };
      }
      newPassword = body.manual_password;
    } else {
      // Auto-generate password
      newPassword = generateStrongPassword();
    }

    encryptedPassword = encrypt(newPassword);

    // Update password in database
    await userRepo.updatePassword(
      userId,
      encryptedPassword,
      body.next_login_password_change === "true",
    );

    // Send email if password is auto-generated or email credentials requested
    if (
      body.password_auto_generated === true ||
      body.password_auto_generated === "true"
    ) {
      await sendPasswordEmail(
        targetUser.email,
        targetUser.loginId || targetUser.email,
        newPassword,
      );
    } else if (body.email_login_credentials === "true") {
      await sendPasswordEmail(
        targetUser.email,
        targetUser.loginId || targetUser.email,
        newPassword,
      );
    }
  } else if (body.next_login_password_change !== undefined) {
    // Handle next_login_password_change without password change
    await userRepo.updateNextLoginPasswordChange(
      userId,
      body.next_login_password_change === "true",
    );
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

  // Remove password-related fields since they're handled separately
  delete updateData.address;
  delete updateData.password_auto_generated;
  delete updateData.manual_password;
  delete updateData.next_login_password_change;
  delete updateData.email_login_credentials;

  await userRepo.updateUser(userId, updateData);

  /* --------------------------
         SINGLE BUILDER MANAGEMENT
    --------------------------- */
  if (body.builder_id) {
    const existingBuilder = await userRepo.getUserBuilder(userId);
    if (existingBuilder && existingBuilder.builder_id !== body.builder_id) {
      throw {
        status: 400,
        message:
          "User already has a builder assigned. Each user can only have one builder.",
      };
    }

    if (!existingBuilder) {
      await userRepo.setUserBuilder(userId, body.builder_id);
    }
  }

  /* --------------------------
        PHOTO & SIGNATURE
    --------------------------- */

  if (files.photo) {
    if (targetUser.photo) {
      await deleteFromS3(targetUser.photo);
    }
    await userRepo.updatePhoto(userId, files.photo.location);
  }

  if (files.signature) {
    if (targetUser.signature) {
      await deleteFromS3(targetUser.signature);
    }
    await userRepo.updateSignature(userId, files.signature.location);
  }

  // Return the updated user profile with address object
  return await userRepo.getProfile(userId);
}

/* ----------------------------------------
            SOFT DELETE USER
  ---------------------------------------- */
export async function deleteUser(currentUser, userId) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot delete root user." };
  }

  await userRepo.softDeleteUser(userId);

  return { userId };
}

/* ----------------------------------------
            RESET PASSWORD
  ---------------------------------------- */
export async function resetPassword(currentUser, userId, body) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot reset root user password." };
  }

  const {
    password_auto_generated,
    manual_password,
    next_login_password_change,
    email_password,
    email_login_credentials,
  } = body;

  // If password is auto-generated, validate that manual fields are not provided
  if (password_auto_generated === true || password_auto_generated === "true") {
    if (manual_password) {
      throw {
        status: 400,
        message:
          "Manual password cannot be provided when password is auto-generated.",
      };
    }
    if (email_password !== undefined) {
      throw {
        status: 400,
        message:
          "Email password cannot be set when password is auto-generated.",
      };
    }
    if (next_login_password_change !== undefined) {
      throw {
        status: 400,
        message:
          "Next login password change cannot be set when password is auto-generated.",
      };
    }
    if (email_login_credentials !== undefined) {
      throw {
        status: 400,
        message:
          "Email login credentials cannot be set when password is auto-generated.",
      };
    }
  }

  let newPassword;

  if (
    password_auto_generated === false ||
    password_auto_generated === "false"
  ) {
    if (!manual_password) {
      throw { status: 400, message: "Manual password missing." };
    }
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

  // Determine next_login_password_change value
  let nextLoginPasswordChange = false;
  if (
    password_auto_generated === false ||
    password_auto_generated === "false"
  ) {
    nextLoginPasswordChange = next_login_password_change === "true";
  }
  // For auto-generated passwords, it's always false

  await userRepo.updatePassword(userId, encrypted, nextLoginPasswordChange);

  // Auto-send email when password is auto-generated
  if (password_auto_generated === true || password_auto_generated === "true") {
    await sendPasswordEmail(
      user.email,
      user.loginId || user.email,
      newPassword,
    );
  } else if (
    email_login_credentials === "true" ||
    email_password === true ||
    email_login_credentials === true
  ) {
    await sendPasswordEmail(
      user.email,
      user.loginId || user.email,
      newPassword,
    );
  }

  return { userId };
}

/* ----------------------------------------
            CHANGE LOGIN ID
  ---------------------------------------- */
export async function changeLoginId(currentUser, userId, body) {
  const { new_login_id, email_login_id } = body;

  if (!/^[A-Za-z0-9._@-]+$/.test(new_login_id)) {
    throw {
      status: 400,
      message:
        "Invalid login ID. Only A–Z, a–z, 0–9, dot, hyphen, underscore, @ allowed.",
    };
  }

  const user = await userRepo.getBasicUser(userId);
  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot change root login ID." };
  }

  const exists = await userRepo.findByLoginId(new_login_id);
  if (exists && exists.user_id !== userId) {
    throw { status: 400, message: "Login ID already exists." };
  }

  await userRepo.updateLoginId(userId, new_login_id);

  if (email_login_id === "true" || email_login_id === true) {
    await sendLoginIdEmail(user.email, new_login_id);
  }

  return { usersId: userId, loginId: new_login_id };
}
/* ----------------------------------------
            ACTIVE / INACTIVE
  ---------------------------------------- */
export async function toggleActive(currentUser, userId) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot modify root user." };
  }

  const newValue = !user.isActive;

  await userRepo.updateActiveStatus(userId, newValue);

  return { usersId: userId, is_active: newValue };
}
/* ----------------------------------------
            LOCK / UNLOCK USER
  ---------------------------------------- */
export async function toggleLock(currentUser, userId) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot lock root user." };
  }

  const newValue = !user.isLocked;

  await userRepo.updateLockStatus(userId, newValue);

  if (newValue === true) {
    await tokenRepo.invalidateUserSessions(userId);
  }

  return { usersId: userId, is_locked: newValue };
}

/* ----------------------------------------
            PHOTO UPDATE
  ---------------------------------------- */
export async function updatePhoto(currentUser, userId, file) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot modify root user." };
  }

  if (user.photo) {
    await deleteFromS3(user.photo);
  }

  await userRepo.updatePhoto(userId, file.location);

  return { userId, photo: file.location };
}

/* ----------------------------------------
            SIGNATURE UPDATE
  ---------------------------------------- */
export async function updateSignature(currentUser, userId, file) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot modify root user." };
  }

  if (user.signature) {
    await deleteFromS3(user.signature);
  }

  await userRepo.updateSignature(userId, file.location);

  return { userId, signature: file.location };
}

/* ----------------------------------------
            DELETE PHOTO
  ---------------------------------------- */
export async function deletePhoto(currentUser, userId) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (!user.photo) {
    throw { status: 400, message: "No photo exists." };
  }

  await deleteFromS3(user.photo);
  await userRepo.updatePhoto(userId, null);

  return { userId };
}

/* ----------------------------------------
            DELETE SIGNATURE
  ---------------------------------------- */
export async function deleteSignature(currentUser, userId) {
  const user = await userRepo.getBasicUser(userId);

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (!user.signature) {
    throw { status: 400, message: "No signature exists." };
  }

  await deleteFromS3(user.signature);
  await userRepo.updateSignature(userId, null);

  return { userId };
}

export default {
  getUsers,
  getProfile,
  getBasicUser,
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
