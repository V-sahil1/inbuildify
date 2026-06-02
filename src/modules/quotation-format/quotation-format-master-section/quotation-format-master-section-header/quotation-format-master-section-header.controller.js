import quotationFormatMasterSectionHeaderService from "./quotation-format-master-section-header.service.js";

// ============================================================
//        MASTER SECTION HEADER CONTROLLERS
// ============================================================

export async function createMasterSectionHeader(req, res) {
  try {
    const currentUser = req.user;
    const payload = req.body;
    const { master_section_id } = req.params
    const result = await quotationFormatMasterSectionHeaderService.createMasterSectionHeader(currentUser, master_section_id, payload);
    res.status(201).json({
      success: true,
      message: "Master section header created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error creating master section header:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to create master section header",
    });
  }
}

export async function getMasterSectionHeaders(req, res) {
  try {
    const currentUser = req.user;
    const filters = req.query;
    const result = await quotationFormatMasterSectionHeaderService.getMasterSectionHeaders(currentUser, filters);
    res.status(200).json({
      success: true,
      message: "Master section headers retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error getting master section headers:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve master section headers",
    });
  }
}

export async function getMasterSectionHeaderById(req, res) {
  try {
    const currentUser = req.user;
    const { header_id } = req.params;
    console.log("🚀 ~ getMasterSectionHeaderById ~ header_id:", header_id)
    const result = await quotationFormatMasterSectionHeaderService.getMasterSectionHeaderById(currentUser, header_id);
    res.status(200).json({
      success: true,
      message: "Master section header retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error getting master section header:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve master section header",
    });
  }
}

export async function updateMasterSectionHeader(req, res) {
  try {
    const currentUser = req.user;
    const { header_id } = req.params;
    const payload = req.body;
    const result = await quotationFormatMasterSectionHeaderService.updateMasterSectionHeader(currentUser, header_id, payload);
    res.status(200).json({
      success: true,
      message: "Master section header updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error updating master section header:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update master section header",
    });
  }
}

export async function deleteMasterSectionHeader(req, res) {
  try {
    const currentUser = req.user;
    const { header_id } = req.params;
    await quotationFormatMasterSectionHeaderService.deleteMasterSectionHeader(currentUser, header_id);
    res.status(200).json({
      success: true,
      message: "Master section header deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting master section header:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to delete master section header",
    });
  }
}

export default {
  // Master Section Header
  createMasterSectionHeader,
  getMasterSectionHeaders,
  getMasterSectionHeaderById,
  updateMasterSectionHeader,
  deleteMasterSectionHeader,
};
