const costCenterService = require("../services/cost-center.service");

/**
 * CREATE COST CENTER
 */
exports.createCostCenter = async (req, res) => {
  try {
    const { builder_id, company_id, users_id } = req.user;
    const costCenter = await costCenterService.createCostCenter(
      req.body,
      builder_id,
      company_id,
      users_id
    );

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: "Cost center created successfully",
      data: costCenter,
    });
  } catch (error) {
    console.error("Error creating cost center:", error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message || "Internal server error",
      data: null,
    });
  }
};

/**
 * GET ALL COST CENTERS
 */
exports.getCostCenters = async (req, res) => {
  try {
    const { builder_id, company_id } = req.user;
    const costCenters = await costCenterService.getCostCenters(
      builder_id,
      company_id
    );

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Cost centers retrieved successfully",
      data: costCenters,
    });
  } catch (error) {
    console.error("Error getting cost centers:", error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message || "Internal server error",
      data: null,
    });
  }
};

/**
 * GET COST CENTER BY ID
 */
exports.getCostCenterById = async (req, res) => {
  try {
    const { builder_id, company_id } = req.user;
    const { cost_center_id } = req.params;

    const costCenter = await costCenterService.getCostCenterById(
      cost_center_id,
      builder_id,
      company_id
    );

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Cost center retrieved successfully",
      data: costCenter,
    });
  } catch (error) {
    console.error("Error getting cost center:", error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message || "Internal server error",
      data: null,
    });
  }
};

/**
 * UPDATE COST CENTER
 */
exports.updateCostCenter = async (req, res) => {
  try {
    const { builder_id, company_id, users_id } = req.user;
    const { cost_center_id } = req.params;

    const costCenter = await costCenterService.updateCostCenter(
      cost_center_id,
      req.body,
      builder_id,
      company_id,
      users_id
    );

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Cost center updated successfully",
      data: costCenter,
    });
  } catch (error) {
    console.error("Error updating cost center:", error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message || "Internal server error",
      data: null,
    });
  }
};

/**
 * DELETE COST CENTER
 */
exports.deleteCostCenter = async (req, res) => {
  try {
    const { builder_id, company_id } = req.user;
    const { cost_center_id } = req.params;

    await costCenterService.deleteCostCenter(
      cost_center_id,
      builder_id,
      company_id
    );

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Cost center deleted successfully",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting cost center:", error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message || "Internal server error",
      data: null,
    });
  }
};

/**
 * TOGGLE COST CENTER STATUS
 */
exports.toggleCostCenterStatus = async (req, res) => {
  try {
    const { builder_id, company_id, users_id } = req.user;
    const { cost_center_id } = req.params;

    const costCenter = await costCenterService.toggleCostCenterStatus(
      cost_center_id,
      builder_id,
      company_id,
      users_id
    );

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: `Cost center status ${
        costCenter.status ? "activated" : "deactivated"
      } successfully`,
      data: costCenter,
    });
  } catch (error) {
    console.error("Error toggling cost center status:", error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message || "Internal server error",
      data: null,
    });
  }
};
