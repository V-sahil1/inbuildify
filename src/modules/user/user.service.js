import db from "../../config/database/models/postgre-models/index.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";
import { generateStrongPassword, validatePasswordPolicy } from "../../utils/password.util.js";
import { sendPasswordEmail, sendLoginIdEmail } from "../../helper/sendEmail.js";
import { encrypt } from "../../utils/crypto.util.js";
import { keysToCamelCase } from "../../utils/common.js";
import { Sequelize } from "sequelize";

const { Op } = Sequelize;

/* ----------------------------------------
      GET ALL USERS FOR CURRENT BUILDER
  ---------------------------------------- */
export async function getUsers(currentUser, query) {
  const { Users, Role, Address, State, Country } = db;
  const builderId = currentUser.builder_id;
  const { search = "", role = "", role_id = "", is_active } = query;

  const where = {
    is_deleted: false,
    builder_id: builderId,
  };

  if (is_active !== undefined) {
    where.is_active = is_active === "true" || is_active === true;
  }

  if (role_id) {
    where.role_id = role_id;
  }

  if (search) {
    const searchFilter = `%${search}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: searchFilter } },
      { email: { [Op.iLike]: searchFilter } },
      { login_id: { [Op.iLike]: searchFilter } },
      { phone: { [Op.iLike]: searchFilter } },
    ];
  }

  const roleInclude = {
    model: Role,
    as: "role",
    attributes: ["name"],
    required: false,
  };

  if (role) {
    roleInclude.where = { name: role };
    roleInclude.required = true;
  }

  const users = await Users.findAll({
    where,
    include: [
      roleInclude,
      {
        model: Users,
        as: "reportingToUser",
        attributes: ["name"],
        required: false,
      },
      {
        model: Address,
        as: "address",
        include: [
          { model: State, as: "state", attributes: ["name"], required: false },
          { model: Country, as: "country", attributes: ["name"], required: false },
        ],
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
  });

  return users.map((user) => {
    const plainUser = user.get({ plain: true });

    // Transform address to match original JSON structure
    const transformedAddress = {
      addressId: plainUser.address?.address_id || null,
      addressLine1: plainUser.address?.address_line1 || null,
      addressLine2: plainUser.address?.address_line2 || null,
      city: plainUser.address?.city || null,
      stateId: plainUser.address?.state_id || null,
      countryId: plainUser.address?.country_id || null,
      zipCode: plainUser.address?.zip_code || null,
      stateName: plainUser.address?.state?.name || null,
      countryName: plainUser.address?.country?.name || null,
    };

    const transformedUser = keysToCamelCase(plainUser);

    const result = {
      ...transformedUser,
      roleName: plainUser.role?.name || null,
      reportingToName: plainUser.reportingToUser?.name || null,
      address: transformedAddress,
    };

    delete result.role;
    delete result.reportingToUser;

    return result;
  });
}

/* ----------------------------------------
      GET OWN PROFILE
  ---------------------------------------- */
export async function getProfile(userId) {
  const { Users, Address, Builder, Company } = db;
  const user = await Users.findOne({
    where: { users_id: userId, is_deleted: false },
    include: [
      {
        model: Builder,
        as: "builder",
        required: false,
        include: [
          {
            model: Company,
            as: "company",
            required: false,
          },
        ],
      },
      {
        model: Address,
        as: "address",
        required: false,
      },
    ],
  });

  if (!user) {
    throw { status: 404, message: "User not found." };
  }

  const plainUser = user.get({ plain: true });
  const result = keysToCamelCase(plainUser);

  // Extract builder's company
  const companyObj = plainUser.builder?.company ? plainUser.builder.company : null;

  // Onboarding is finished if company exists and has address_id set
  const isOnboardingFinished = !!(
    companyObj &&
    companyObj.address_id
  );

  result.isOnboardingFinished = isOnboardingFinished;

  if (plainUser.builder) {
    result.builderName = plainUser.builder.name;
    result.builderLogo = plainUser.builder.logo;
    result.companyId = plainUser.builder.company_id || null;

    result.builder = {
      name: plainUser.builder.name,
      logo: plainUser.builder.logo || null,
      companyId: plainUser.builder.company_id || null,
      company: companyObj ? {
        companyId: companyObj.company_id,
        name: companyObj.name,
        isOnboardingFinished: isOnboardingFinished,
      } : null,
    };
  } else {
    result.builderName = null;
    result.builderLogo = null;
    result.companyId = null;
    result.builder = null;
  }

  if (companyObj) {
    result.companyName = companyObj.name;
    result.company = {
      companyId: companyObj.company_id,
      name: companyObj.name,
      isOnboardingFinished: isOnboardingFinished,
    };
  } else {
    result.companyName = null;
    result.company = null;
  }

  return result;
}

/* ----------------------------------------
      GET BASIC USER
  ---------------------------------------- */
export async function getBasicUser(userId) {
  const { Users } = db;
  const user = await Users.findOne({
    where: { users_id: userId, is_deleted: false },
    attributes: [
      "users_id",
      "builder_id",
      "email",
      "login_id",
      "root_user",
      "is_active",
      "is_locked",
      "photo",
      "signature",
      "address_id",
    ],
  });
  return user ? keysToCamelCase(user.get({ plain: true })) : null;
}

/* ----------------------------------------
        CREATE USER (ADMIN UI)
  ---------------------------------------- */
export async function createUser(currentUser, body, files) {
  const { Users, Address, Company } = db;
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

  const t = await db.sequelize.transaction();

  try {
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

    const emailExists = await Users.findOne({
      where: { email: { [Op.iLike]: email.toLowerCase() } },
      transaction: t,
    });

    if (emailExists) {
      if (emailExists.is_deleted) {
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
      const loginExists = await Users.findOne({
        where: { login_id },
        transaction: t,
      });
      if (loginExists) {
        if (loginExists.is_deleted) {
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
      finalPassword = generateStrongPassword();
    }

    const encryptedPassword = finalPassword ? encrypt(finalPassword) : null;

    /* --------------------------
         ADDRESS CREATE OR USE COMPANY ADDRESS
      --------------------------- */

    let addressId = null;

    if (use_company_address === "true" || use_company_address === true) {
      const company = await Company.findOne({
        where: { builder_id: currentUser.builder_id },
        include: [{ model: Address, as: "address" }],
        transaction: t,
      });

      const companyAddress = company?.address;

      if (companyAddress) {
        if (
          !companyAddress.address_line1 ||
          companyAddress.address_line1.trim() === ""
        ) {
          throw new Error(
            "Company address line 1 is required. Please update company address before creating user with company address.",
          );
        }

        const newAddress = await Address.create({
          address_line1: companyAddress.address_line1,
          address_line2: companyAddress.address_line2,
          city: companyAddress.city,
          zip_code: companyAddress.zip_code,
          country_id: companyAddress.country_id,
          state_id: companyAddress.state_id,
        }, { transaction: t });
        addressId = newAddress.address_id;
      }
    } else if (address) {
      const newAddress = await Address.create({
        address_line1: address.address_line1,
        address_line2: address.address_line2,
        city: address.city,
        zip_code: address.zip_code,
        country_id: address.country_id,
        state_id: address.state_id,
      }, { transaction: t });
      addressId = newAddress.address_id;
    }

    /* --------------------------
            CREATE USER RECORD
      --------------------------- */

    const user = await Users.create({
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
      use_company_address: use_company_address === "true" || use_company_address === true,
      root_user: false,
      has_login: true,
      next_login_password_change: next_login_password_change === "true" || next_login_password_change === true,
      builder_id: currentUser.builder_id,
      is_verified: true,
      password_auto_generated:
        password_auto_generated === "true" || password_auto_generated === true,
    }, { transaction: t });

    const userId = user.users_id;

    /* --------------------------
          PHOTO + SIGNATURE
    --------------------------- */

    if (files.photo && files.photo.location) {
      await user.update({ photo: files.photo.location }, { transaction: t });
    }

    if (files.signature && files.signature.location) {
      await user.update({ signature: files.signature.location }, { transaction: t });
    }

    await t.commit();

    /* --------------------------
           EMAIL LOGIN CREDENTIALS
      --------------------------- */

    const isAutoGenerated =
      (password_auto_generated === true ||
        password_auto_generated === "true") &&
      finalPassword;

    const shouldSendEmail =
      isAutoGenerated || email_login_credentials === "true" || email_login_credentials === true;

    if (shouldSendEmail) {
      try {
        await sendPasswordEmail(email, login_id || email, finalPassword);
      } catch (error) {
        console.error("Error sending password email:", error);
      }
    }

    // Return the new user using the existing getUsers logic to maintain structure
    const updatedUsersList = await getUsers(currentUser, { search: email });
    const newUser = updatedUsersList.find(
      (u) => u.email === email.toLowerCase(),
    );

    return newUser || updatedUsersList[0];
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

/* ----------------------------------------
            UPDATE USER
  ---------------------------------------- */
export async function updateUser(currentUser, userId, body, files) {
  const { Users, Address, Company, Sequelize } = db;
  const t = await db.sequelize.transaction();

  try {
    /* --------------------------
          ROOT USER PROTECTION
      --------------------------- */
    const user = await Users.findOne({
      where: { users_id: userId, is_deleted: false },
      transaction: t,
    });

    if (!user) {
      throw { status: 404, message: "User not found." };
    }

    if (user.root_user) {
      throw { status: 403, message: "Root user cannot be modified." };
    }

    const targetUser = keysToCamelCase(user.get({ plain: true }));

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

      const exists = await Users.findOne({
        where: { login_id: body.login_id, users_id: { [Op.ne]: userId } },
        transaction: t,
      });
      if (exists) {
        throw { status: 400, message: "Login ID already exists." };
      }
    }

    /* --------------------------
           EMAIL CHANGE VALIDATION
      --------------------------- */
    if (body.email) {
      const emailExists = await Users.findOne({
        where: { email: { [Op.iLike]: body.email.toLowerCase() }, users_id: { [Op.ne]: userId } },
        transaction: t,
      });
      if (emailExists) {
        throw { status: 400, message: "Email already exists." };
      }
    }

    /* --------------------------
              ADDRESS HANDLING
      --------------------------- */
    let addressId = targetUser.addressId;

    if (body.use_company_address === "true" || body.use_company_address === true) {
      const company = await Company.findOne({
        where: { builder_id: targetUser.builderId },
        include: [{ model: Address, as: "address" }],
        transaction: t,
      });
      const companyAddress = company?.address;

      if (companyAddress && addressId) {
        await Address.update({
          address_line1: companyAddress.address_line1,
          address_line2: companyAddress.address_line2,
          city: companyAddress.city,
          zip_code: companyAddress.zip_code,
          country_id: companyAddress.country_id,
          state_id: companyAddress.state_id,
        }, { where: { address_id: addressId }, transaction: t });
      } else {
        addressId = companyAddress?.address_id || null;
      }
    } else if (body.address && addressId) {
      const company = await Company.findOne({
        where: { builder_id: targetUser.builderId },
        transaction: t,
      });

      if (company && company.address_id === addressId) {
        // Create new address if current is shared company address
        const newAddress = await Address.create({
          address_line1: body.address.address_line1,
          address_line2: body.address.address_line2,
          city: body.address.city,
          zip_code: body.address.zip_code,
          country_id: body.address.country_id,
          state_id: body.address.state_id,
        }, { transaction: t });
        addressId = newAddress.address_id;
      } else {
        // Update existing private address
        const updatePayload = {};
        const fields = ["address_line1", "address_line2", "city", "zip_code", "country_id", "state_id"];
        fields.forEach(f => {
          if (body.address[f] !== undefined) {
            updatePayload[f] = body.address[f];
          }
        });

        if (Object.keys(updatePayload).length > 0) {
          await Address.update(updatePayload, {
            where: { address_id: addressId },
            transaction: t,
          });
        }
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
      }

      let newPassword;
      if (
        body.password_auto_generated === false ||
        body.password_auto_generated === "false"
      ) {
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
        newPassword = generateStrongPassword();
      }

      const encryptedPassword = encrypt(newPassword);

      await user.update({
        password: encryptedPassword,
        next_login_password_change: body.next_login_password_change === "true" || body.next_login_password_change === true,
      }, { transaction: t });

      if (
        body.password_auto_generated === true ||
        body.password_auto_generated === "true" ||
        body.email_login_credentials === "true" ||
        body.email_login_credentials === true
      ) {
        await sendPasswordEmail(
          targetUser.email,
          targetUser.loginId || targetUser.email,
          newPassword,
        );
      }
    } else if (body.next_login_password_change !== undefined) {
      await user.update({
        next_login_password_change: body.next_login_password_change === "true" || body.next_login_password_change === true,
      }, { transaction: t });
    }

    /* --------------------------
              UPDATE USER
      --------------------------- */

    const updateData = {
      ...body,
      email: body.email?.toLowerCase(),
      address_id: addressId,
      use_company_address: body.use_company_address === "true" || body.use_company_address === true,
    };

    // Remove fields handled separately
    delete updateData.address;
    delete updateData.password_auto_generated;
    delete updateData.manual_password;
    delete updateData.next_login_password_change;
    delete updateData.email_login_credentials;

    // Use Sequelize update on instance
    await user.update(updateData, { transaction: t });

    /* --------------------------
           BUILDER MANAGEMENT
      --------------------------- */
    if (body.builder_id) {
      if (user.builder_id && user.builder_id !== body.builder_id) {
        throw {
          status: 400,
          message:
            "User already has a builder assigned. Each user can only have one builder.",
        };
      }
      if (!user.builder_id) {
        await user.update({ builder_id: body.builder_id }, { transaction: t });
      }
    }

    /* --------------------------
          PHOTO & SIGNATURE
      --------------------------- */

    if (files.photo) {
      if (targetUser.photo) {
        await deleteFromS3(targetUser.photo);
      }
      await user.update({ photo: files.photo.location }, { transaction: t });
    }

    if (files.signature) {
      if (targetUser.signature) {
        await deleteFromS3(targetUser.signature);
      }
      await user.update({ signature: files.signature.location }, { transaction: t });
    }

    await t.commit();

    return await getProfile(userId);
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

/* ----------------------------------------
            SOFT DELETE USER
  ---------------------------------------- */
export async function deleteUser(currentUser, userId) {
  const { Users } = db;
  const user = await Users.findOne({ where: { users_id: userId, is_deleted: false } });

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot delete root user." };
  }

  await user.update({ is_deleted: true });

  return { userId };
}

/* ----------------------------------------
            RESET PASSWORD
  ---------------------------------------- */
export async function resetPassword(currentUser, userId, body) {
  const { Users } = db;
  const user = await Users.findOne({ where: { users_id: userId, is_deleted: false } });

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

  if (password_auto_generated === true || password_auto_generated === "true") {
    if (manual_password) {
      throw {
        status: 400,
        message: "Manual password cannot be provided when password is auto-generated.",
      };
    }
  }

  let newPassword;
  if (password_auto_generated === false || password_auto_generated === "false") {
    if (!manual_password) {
      throw { status: 400, message: "Manual password missing." };
    }
    if (!validatePasswordPolicy(manual_password)) {
      throw {
        status: 400,
        message: "Password must be minimum 8 characters with uppercase, lowercase, and number.",
      };
    }
    newPassword = manual_password;
  } else {
    newPassword = generateStrongPassword();
  }

  const encrypted = encrypt(newPassword);

  let nextLoginPasswordChange = false;
  if (password_auto_generated === false || password_auto_generated === "false") {
    nextLoginPasswordChange = next_login_password_change === "true" || next_login_password_change === true;
  }

  await user.update({
    password: encrypted,
    next_login_password_change: nextLoginPasswordChange,
  });

  if (
    password_auto_generated === true ||
    password_auto_generated === "true" ||
    email_login_credentials === "true" ||
    email_password === true ||
    email_login_credentials === true
  ) {
    await sendPasswordEmail(user.email, user.login_id || user.email, newPassword);
  }

  return { userId };
}

/* ----------------------------------------
            CHANGE LOGIN ID
  ---------------------------------------- */
export async function changeLoginId(currentUser, userId, body) {
  const { Users } = db;
  const { new_login_id, email_login_id } = body;

  if (!/^[A-Za-z0-9._@-]+$/.test(new_login_id)) {
    throw {
      status: 400,
      message: "Invalid login ID. Only A–Z, a–z, 0–9, dot, hyphen, underscore, @ allowed.",
    };
  }

  const user = await Users.findOne({ where: { users_id: userId, is_deleted: false } });
  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot change root login ID." };
  }

  const exists = await Users.findOne({ where: { login_id: new_login_id, users_id: { [Op.ne]: userId } } });
  if (exists) {
    throw { status: 400, message: "Login ID already exists." };
  }

  await user.update({ login_id: new_login_id });

  if (email_login_id === "true" || email_login_id === true) {
    await sendLoginIdEmail(user.email, new_login_id);
  }

  return { usersId: userId, loginId: new_login_id };
}
/* ----------------------------------------
            ACTIVE / INACTIVE
  ---------------------------------------- */
export async function toggleActive(currentUser, userId) {
  const { Users } = db;
  const user = await Users.findOne({ where: { users_id: userId, is_deleted: false } });

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot modify root user." };
  }

  const newValue = !user.is_active;
  await user.update({ is_active: newValue });

  return { usersId: userId, is_active: newValue };
}
/* ----------------------------------------
            LOCK / UNLOCK USER
  ---------------------------------------- */
export async function toggleLock(currentUser, userId) {
  const { Users, UsersToken } = db;
  const user = await Users.findOne({ where: { users_id: userId, is_deleted: false } });

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot lock root user." };
  }

  const newValue = !user.is_locked;
  await user.update({ is_locked: newValue });

  if (newValue === true) {
    await UsersToken.destroy({ where: { user_id: userId } });
  }

  return { usersId: userId, is_locked: newValue };
}

/* ----------------------------------------
            PHOTO UPDATE
  ---------------------------------------- */
export async function updatePhoto(currentUser, userId, file) {
  const { Users } = db;
  const user = await Users.findOne({ where: { users_id: userId, is_deleted: false } });

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot modify root user." };
  }

  if (user.photo) {
    await deleteFromS3(user.photo);
  }

  await user.update({ photo: file.location });

  return { userId, photo: file.location };
}

export async function updateSignature(currentUser, userId, file) {
  const { Users } = db;
  const user = await Users.findOne({ where: { users_id: userId, is_deleted: false } });

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (user.root_user) {
    throw { status: 403, message: "Cannot modify root user." };
  }

  if (user.signature) {
    await deleteFromS3(user.signature);
  }

  await user.update({ signature: file.location });

  return { userId, signature: file.location };
}

/* ----------------------------------------
            DELETE PHOTO
  ---------------------------------------- */
export async function deletePhoto(currentUser, userId) {
  const { Users } = db;
  const user = await Users.findOne({ where: { users_id: userId, is_deleted: false } });

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (!user.photo) {
    throw { status: 400, message: "No photo exists." };
  }

  await deleteFromS3(user.photo);
  await user.update({ photo: null });

  return { userId };
}

export async function deleteSignature(currentUser, userId) {
  const { Users } = db;
  const user = await Users.findOne({ where: { users_id: userId, is_deleted: false } });

  if (!user) {
    throw { status: 404, message: "User not found." };
  }
  if (!user.signature) {
    throw { status: 400, message: "No signature exists." };
  }

  await deleteFromS3(user.signature);
  await user.update({ signature: null });

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
