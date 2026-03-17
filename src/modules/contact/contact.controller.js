import contactService from "./contact.service.js";
import { successResponse, errorResponse } from "../../helper/response.js";

export async function getContacts(req, res) {
  try {
    const data = await contactService.getContacts(req.user, req.query);
    return successResponse(res, data, "Contacts fetched successfully.");
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
}

export async function getContactById(req, res) {
  try {
    const contactId = req.params.contact_id;
    const data = await contactService.getContactById(req.user, contactId);
    return successResponse(res, data, "Contact fetched successfully.");
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
}

export async function createContact(req, res) {
  try {
    const data = await contactService.createContact(req.user, req.body);
    return successResponse(res, data, "Contact created successfully.");
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
}

export async function updateContact(req, res) {
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
}

export async function deleteContact(req, res) {
  try {
    const contactId = req.params.contact_id;
    const data = await contactService.deleteContact(req.user, contactId);
    return successResponse(res, data, "Contact deleted successfully.");
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
}

export async function convertContactToUser(req, res) {
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
}
