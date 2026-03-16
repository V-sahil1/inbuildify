import quotationFormatMasterSectionService from "./quotation-format-master-section.service";

// ============================================================
//        MASTER SECTION CONTROLLERS
// ============================================================

async function createMasterSection(req, res) {
  try {
    const currentUser = req.user;
    const payload = req.body;
    const result = await quotationFormatMasterSectionService.createMasterSection(currentUser, payload);
    res.status(201).json({
      success: true,
      message: "Master section created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error creating master section:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to create master section",
    });
  }
}

async function getMasterSections(req, res) {
  try {
    const currentUser = req.user;
    const filters = req.query;
    const result = await quotationFormatMasterSectionService.getMasterSections(currentUser, filters);
    res.status(200).json({
      success: true,
      message: "Master sections retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error getting master sections:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve master sections",
    });
  }
}

async function getMasterSectionById(req, res) {
  try {
    const currentUser = req.user;
    const { master_section_id } = req.params;
    const result = await quotationFormatMasterSectionService.getMasterSectionById(currentUser, master_section_id);
    res.status(200).json({
      success: true,
      message: "Master section retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error getting master section:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve master section",
    });
  }
}

async function updateMasterSection(req, res) {
  try {
    const currentUser = req.user;
    const { master_section_id } = req.params;
    const payload = req.body;
    const result = await quotationFormatMasterSectionService.updateMasterSection(currentUser, master_section_id, payload);
    res.status(200).json({
      success: true,
      message: "Master section updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error updating master section:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update master section",
    });
  }
}

async function deleteMasterSection(req, res) {
  try {
    const currentUser = req.user;
    const { master_section_id } = req.params;
    await quotationFormatMasterSectionService.deleteMasterSection(currentUser, master_section_id);
    res.status(200).json({
      success: true,
      message: "Master section deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting master section:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to delete master section",
    });
  }
}

// ============================================================
//        MASTER SECTION HEADER CONTROLLERS
// ============================================================

async function createMasterSectionHeader(req, res) {
  try {
    const currentUser = req.user;
    const payload = req.body;
    const result = await quotationFormatMasterSectionService.createMasterSectionHeader(currentUser, payload);
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

async function getMasterSectionHeaders(req, res) {
  try {
    const currentUser = req.user;
    const filters = req.query;
    const result = await quotationFormatMasterSectionService.getMasterSectionHeaders(currentUser, filters);
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

async function getMasterSectionHeaderById(req, res) {
  try {
    const currentUser = req.user;
    const { header_id } = req.params;
    const result = await quotationFormatMasterSectionService.getMasterSectionHeaderById(currentUser, header_id);
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

async function updateMasterSectionHeader(req, res) {
  try {
    const currentUser = req.user;
    const { header_id } = req.params;
    const payload = req.body;
    const result = await quotationFormatMasterSectionService.updateMasterSectionHeader(currentUser, header_id, payload);
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

async function deleteMasterSectionHeader(req, res) {
  try {
    const currentUser = req.user;
    const { header_id } = req.params;
    await quotationFormatMasterSectionService.deleteMasterSectionHeader(currentUser, header_id);
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

// ============================================================
//        MASTER SECTION ITEM CONTROLLERS
// ============================================================

async function createMasterSectionItem(req, res) {
  try {
    const currentUser = req.user;
    const payload = req.body;
    const result = await quotationFormatMasterSectionService.createMasterSectionItem(currentUser, payload);
    res.status(201).json({
      success: true,
      message: "Master section item created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error creating master section item:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to create master section item",
    });
  }
}

async function getMasterSectionItems(req, res) {
  try {
    const currentUser = req.user;
    const filters = req.query;
    const result = await quotationFormatMasterSectionService.getMasterSectionItems(currentUser, filters);
    res.status(200).json({
      success: true,
      message: "Master section items retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error getting master section items:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve master section items",
    });
  }
}

async function getMasterSectionItemById(req, res) {
  try {
    const currentUser = req.user;
    const { item_id } = req.params;
    const result = await quotationFormatMasterSectionService.getMasterSectionItemById(currentUser, item_id);
    res.status(200).json({
      success: true,
      message: "Master section item retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error getting master section item:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve master section item",
    });
  }
}

async function updateMasterSectionItem(req, res) {
  try {
    const currentUser = req.user;
    const { item_id } = req.params;
    const payload = req.body;
    const result = await quotationFormatMasterSectionService.updateMasterSectionItem(currentUser, item_id, payload);
    res.status(200).json({
      success: true,
      message: "Master section item updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error updating master section item:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update master section item",
    });
  }
}

async function deleteMasterSectionItem(req, res) {
  try {
    const currentUser = req.user;
    const { item_id } = req.params;
    await quotationFormatMasterSectionService.deleteMasterSectionItem(currentUser, item_id);
    res.status(200).json({
      success: true,
      message: "Master section item deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting master section item:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to delete master section item",
    });
  }
}

export default {
  // Master Section
  createMasterSection,
  getMasterSections,
  getMasterSectionById,
  updateMasterSection,
  deleteMasterSection,
  // Master Section Header
  createMasterSectionHeader,
  getMasterSectionHeaders,
  getMasterSectionHeaderById,
  updateMasterSectionHeader,
  deleteMasterSectionHeader,
  // Master Section Item
  createMasterSectionItem,
  getMasterSectionItems,
  getMasterSectionItemById,
  updateMasterSectionItem,
  deleteMasterSectionItem,
};
