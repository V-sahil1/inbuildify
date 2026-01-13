const contactRepository = require("../repositories/contact.repository");
const userRepository = require("../repositories/user.repository");
const addressRepository = require("../repositories/address.repository");
const tokenRepository = require("../repositories/token.repository");

const emailService = require("../service/email.service");
const {
  generateStrongPassword,
  validatePasswordPolicy,
} = require("../utils/password.util");

const { encrypt } = require("../utils/common");

/* ------------------------------------------------------------
      LIST CONTACTS
  ------------------------------------------------------------ */
async function getContacts(currentUser, query) {
  const builderId = currentUser.builder_id;

  const page = parseInt(query.page || 1);
  const limit = parseInt(query.limit || 25);
  const search = query.search || "";

  return await contactRepository.getContacts({
    builderId,
    page,
    limit,
    search,
  });
}

/* ------------------------------------------------------------
      GET ONE CONTACT
  ------------------------------------------------------------ */
async function getContactById(currentUser, contactId) {
  const contact = await contactRepository.getContactById(
    currentUser.builder_id,
    contactId
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

  // Extract fields
  const {
    name,
    email,
    phone,
    secondary_phone,
    remark,
    role_id,
    address: addressJson,
  } = body;

  // Check duplicate email in same builder
  const existing = await userRepository.findByEmail(email);
  if (existing && existing.builder_id === builderId) {
    const error = new Error("Email already exists.");
    error.status = 400;
    throw error;
  }

  // Parse address
  let addressObj = null;
  if (addressJson) {
    try {
      addressObj = JSON.parse(addressJson);
    } catch (err) {
      const error = new Error("Invalid address format.");
      error.status = 400;
      throw error;
    }
  }

  // Create address (optional)
  let addressId = null;
  if (addressObj) {
    addressId = await addressRepository.createOrUpdateAddress(null, addressObj);
  }

  // Create contact in users table
  const created = await contactRepository.createContact({
    name,
    email,
    phone,
    secondary_phone,
    remark,
    builder_id: builderId,
    address_id: addressId,
    role_id,
    has_login: false, // CONTACT only
    password: null,
    login_id: null,
  });

  return created;
}

/* ------------------------------------------------------------
      UPDATE CONTACT
  ------------------------------------------------------------ */
async function updateContact(currentUser, contactId, body) {
  const builderId = currentUser.builder_id;

  const existing = await contactRepository.getContactById(builderId, contactId);

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
    role_id,
    address: addressJson,
  } = body;

  let updateData = {
    name,
    email,
    phone,
    secondary_phone,
    remark,
    role_id,
  };

  // Handle email update → check duplicates
  if (email && email.toLowerCase() !== existing.email.toLowerCase()) {
    const duplicate = await userRepository.findByEmail(email);
    if (duplicate && duplicate.user_id !== contactId) {
      const error = new Error("Email already exists.");
      error.status = 400;
      throw error;
    }
  }

  // Address update
  if (addressJson) {
    let addressObj;
    try {
      addressObj = JSON.parse(addressJson);
    } catch (err) {
      const error = new Error("Invalid address format.");
      error.status = 400;
      throw error;
    }

    const addressId = await addressRepository.createOrUpdateAddress(
      existing.address_id,
      addressObj
    );

    updateData.address_id = addressId;
  }

  await contactRepository.updateContact(contactId, updateData);
  return { contactId };
}

/* ------------------------------------------------------------
      DELETE CONTACT (soft delete)
  ------------------------------------------------------------ */
async function deleteContact(currentUser, contactId) {
  const builderId = currentUser.builder_id;

  const contact = await contactRepository.getContactById(builderId, contactId);

  if (!contact) {
    const error = new Error("Contact not found.");
    error.status = 404;
    throw error;
  }

  await contactRepository.softDeleteContact(contactId);
  return { contactId };
}

/* ------------------------------------------------------------
      CONVERT CONTACT → USER
  ------------------------------------------------------------ */
async function convertContactToUser(currentUser, contactId, body) {
  const { role_id } = body;

  const builderId = currentUser.builder_id;

  const contact = await contactRepository.getContactById(builderId, contactId);

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

  // Check login ID uniqueness
  const loginCheck = await userRepository.findByLoginId(loginId);
  if (loginCheck && loginCheck.user_id !== contactId) {
    const error = new Error("This email is already used as a login ID.");
    error.status = 400;
    throw error;
  }

  // Generate password
  const password = generateStrongPassword(12);
  if (!validatePasswordPolicy(password)) {
    const error = new Error("Generated password failed security policy.");
    error.status = 500;
    throw error;
  }

  const encryptedPwd = encrypt(password);

  // Update user to become a full system user
  await contactRepository.updateContact(contactId, {
    role_id,
    has_login: true,
    login_id: loginId,
    password: encryptedPwd,
    is_active: true,
    is_locked: false,
  });

  // Invalidate any previous tokens (just in case)
  await tokenRepository.invalidateUserSessions(contactId);

  // Send email
  await emailService.sendPasswordEmail(contact.email, loginId, password);

  return {
    user_id: contactId,
    login_id: loginId,
  };
}

module.exports = {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  convertContactToUser,
};
