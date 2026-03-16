import contactRepository from "./contact.repository";
import userRepository from "../user/user.repository";
import addressRepository from "../../repositories/address.repository";
import tokenRepository from "../../repositories/token.repository";
import emailService from "../../service/email.service";
import { generateStrongPassword, validatePasswordPolicy } from "../../utils/password.util";
import { encrypt } from "../../utils/common";
import getPool from "../../config/database";

/* ------------------------------------------------------------
      LIST CONTACTS
  ------------------------------------------------------------ */
async function getContacts(currentUser, query) {
  const builderId = currentUser.builder_id;

  const search = query.search || "";
  const is_active = query.is_active;

  return await contactRepository.getContacts({
    builderId,
    search,
    is_active,
  });
}

/* ------------------------------------------------------------
      GET ONE CONTACT
  ------------------------------------------------------------ */
async function getContactById(currentUser, contact_id) {
  const contact = await contactRepository.getContactById(
    currentUser.builder_id,
    contact_id,
  );

  if (!contact) {
    const error = new Error("Contact not found.");
    error.status = 404;
    throw error;
  }

  return contact;
}

/* ------------------------------------------------------------
      CREATE CONTACT
  ------------------------------------------------------------ */
async function createContact(currentUser, body) {
  const builderId = currentUser.builder_id;

  const {
    name,
    email,
    phone,
    secondary_phone,
    remark,
    role_id,
    address: addressJson,
  } = body;

  let finalRoleId = role_id;
  if (!finalRoleId) {
    const contactRoleResult = await getPool().query(
      "SELECT role_id FROM role WHERE LOWER(name) = 'contact' LIMIT 1",
    );

    if (contactRoleResult.rows.length === 0) {
      const error = new Error("Contact role not found in the system.");
      error.status = 500;
      throw error;
    }

    finalRoleId = contactRoleResult.rows[0].role_id;
  } else {
    const roleResult = await getPool().query(
      "SELECT role_id, name FROM role WHERE role_id = $1",
      [finalRoleId],
    );

    if (roleResult.rows.length === 0) {
      const error = new Error(
        "Invalid role ID or role does not belong to your account.",
      );
      error.status = 400;
      throw error;
    }

    const roleName = roleResult.rows[0].name.toLowerCase();
    if (roleName !== "contact") {
      const error = new Error(
        "Only Contact role is allowed for creating contacts.",
      );
      error.status = 400;
      throw error;
    }
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    if (existing.builder_id === builderId) {
      const error = new Error("Email already exists in your contacts.");
      error.status = 400;
      throw error;
    } else {
      const error = new Error("Email already exists in the system.");
      error.status = 400;
      throw error;
    }
  }

  let addressObj = null;
  if (addressJson) {
    addressObj = addressJson;
  }

  let addressId = null;
  if (addressObj) {
    addressId = await addressRepository.createOrUpdateAddress(null, addressObj);
  }

  const created = await contactRepository.createContact({
    name,
    email,
    phone,
    secondary_phone,
    remark,
    builder_id: builderId,
    address_id: addressId,
    role_id: finalRoleId,
    has_login: false, // CONTACT only
    password: null,
    login_id: null,
  });

  return created;
}

/* ------------------------------------------------------------
      UPDATE CONTACT
  ------------------------------------------------------------ */
async function updateContact(currentUser, contact_id, body) {
  const builderId = currentUser.builder_id;

  const existing = await contactRepository.getContactById(
    builderId,
    contact_id,
  );

  if (!existing) {
    const error = new Error("Contact not found.");
    error.status = 404;
    throw error;
  }

  const {
    name,
    email,
    phone,
    secondary_phone,
    remark,
    is_active,
    address: addressJson,
  } = body;

  // Remove role_id from updateData - users cannot update roles
  const updateData = {
    name,
    email,
    phone,
    secondary_phone,
    remark,
    is_active,
  };

  if (email && email.toLowerCase() !== existing.email.toLowerCase()) {
    const duplicate = await userRepository.findByEmail(email);
    if (duplicate && duplicate.user_id !== contact_id) {
      const error = new Error("Email already exists.");
      error.status = 400;
      throw error;
    }
  }

  if (addressJson && (existing.address_id || existing.addressId)) {
    const addressObj = addressJson;
    const existingAddressId = existing.address_id || existing.addressId;

    await addressRepository.createOrUpdateAddress(
      existingAddressId,
      addressObj,
    );
  } else if (addressJson && !(existing.address_id || existing.addressId)) {
    const addressObj = addressJson;
    const addressId = await addressRepository.createOrUpdateAddress(
      null,
      addressObj,
    );
    updateData.address_id = addressId;
  }

  await contactRepository.updateContact(contact_id, updateData);

  const updatedContact = await contactRepository.getContactById(
    builderId,
    contact_id,
  );
  return updatedContact;
}

/* ------------------------------------------------------------
      DELETE CONTACT (soft delete)
  ------------------------------------------------------------ */
async function deleteContact(currentUser, contact_id) {
  const builderId = currentUser.builder_id;

  const contact = await contactRepository.getContactById(builderId, contact_id);

  if (!contact) {
    const error = new Error("Contact not found.");
    error.status = 404;
    throw error;
  }

  await contactRepository.softDeleteContact(contact_id);
  return { contact_id };
}

/* ------------------------------------------------------------
      CONVERT CONTACT → USER
  ------------------------------------------------------------ */
async function convertContactToUser(currentUser, contact_id, body) {
  const { role_id } = body;

  const builderId = currentUser.builder_id;

  const contact = await contactRepository.getContactById(builderId, contact_id);

  if (!contact) {
    const error = new Error("Contact not found.");
    error.status = 404;
    throw error;
  }

  if (contact.has_login === true) {
    const error = new Error("This contact is already a system user.");
    error.status = 400;
    throw error;
  }

  // Generate login ID (use email)
  const loginId = contact.email.toLowerCase();

  const loginCheck = await userRepository.findByLoginId(loginId);
  if (loginCheck && loginCheck.user_id !== contact_id) {
    const error = new Error("This email is already used as a login ID.");
    error.status = 400;
    throw error;
  }

  const password = generateStrongPassword(12);
  if (!validatePasswordPolicy(password)) {
    const error = new Error("Generated password failed security policy.");
    error.status = 500;
    throw error;
  }

  const encryptedPwd = encrypt(password);

  // Update user to become a full system user
  await contactRepository.updateContact(contact_id, {
    role_id,
    has_login: true,
    login_id: loginId,
    password: encryptedPwd,
    is_active: true,
    is_locked: false,
    is_verified: true,
  });

  // Invalidate any previous tokens (just in case)
  await tokenRepository.invalidateUserSessions(contact_id);

  await emailService.sendPasswordEmail(contact.email, loginId, password);

  return {
    user_id: contact_id,
    login_id: loginId,
  };
}

export default {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  convertContactToUser,
};
