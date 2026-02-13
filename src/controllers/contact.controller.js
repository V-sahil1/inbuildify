const contactService = require("../services/contact.service");
const { successResponse, errorResponse } = require("../helper/response");

module.exports.getContacts = async (req, res) => {
  try {
    const data = await contactService.getContacts(req.user, req.query);
    return successResponse(res, data, "Contacts fetched successfully.");
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.getContactById = async (req, res) => {
  try {
    const contactId = req.params.contact_id;
    const data = await contactService.getContactById(req.user, contactId);
    return successResponse(res, data, "Contact fetched successfully.");
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.createContact = async (req, res) => {
  try {
    const data = await contactService.createContact(req.user, req.body);
    return successResponse(res, data, "Contact created successfully.");
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.updateContact = async (req, res) => {
  try {
    const contactId = req.params.contact_id;
    const data = await contactService.updateContact(
      req.user,
      contactId,
      req.body,
    );
    return successResponse(res, data, "Contact updated successfully.");
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.deleteContact = async (req, res) => {
  try {
    const contactId = req.params.contact_id;
    const data = await contactService.deleteContact(req.user, contactId);
    return successResponse(res, data, "Contact deleted successfully.");
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.convertContactToUser = async (req, res) => {
  try {
    const contactId = req.params.contact_id;
    const data = await contactService.convertContactToUser(
      req.user,
      contactId,
      req.body,
    );
    return successResponse(
      res,
      data,
      "Contact converted to user and credentials generated.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};
