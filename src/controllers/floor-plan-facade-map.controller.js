const floorPlanFacadeMapService = require("../services/floor-plan-facade-map.service");
const { successResponse, errorResponse } = require("../helper/response");

/* ---------------------------
   CREATE FLOOR PLAN FACADE MAP
---------------------------- */
module.exports.createFloorPlanFacadeMap = async (req, res) => {
  try {
    const data = await floorPlanFacadeMapService.createFloorPlanFacadeMap(
      req.user,
      req.body,
    );

    return successResponse(
      res,
      data,
      "Floor plan facade mapping created successfully",
    );
  } catch (error) {
    console.error("Error in createFloorPlanFacadeMap:", error);
    return errorResponse(
      res,
      error.status || 500,
      error.message || "Internal server error",
    );
  }
};

/* ---------------------------
   GET ALL FLOOR PLAN FACADE MAPS
---------------------------- */
module.exports.getFloorPlanFacadeMaps = async (req, res) => {
  try {
    const data = await floorPlanFacadeMapService.getFloorPlanFacadeMaps(
      req.user,
      req.query,
    );

    return successResponse(
      res,
      data,
      "Floor plan facade mappings retrieved successfully",
    );
  } catch (error) {
    console.error("Error in getFloorPlanFacadeMaps:", error);
    return errorResponse(
      res,
      error.status || 500,
      error.message || "Internal server error",
    );
  }
};

/* ---------------------------
   DELETE FLOOR PLAN FACADE MAP
---------------------------- */
module.exports.deleteFloorPlanFacadeMap = async (req, res) => {
  try {
    const { id } = req.params;

    await floorPlanFacadeMapService.deleteFloorPlanFacadeMap(req.user, id);

    return successResponse(
      res,
      null,
      "Floor plan facade mapping deleted successfully",
    );
  } catch (error) {
    console.error("Error in deleteFloorPlanFacadeMap:", error);
    return errorResponse(
      res,
      error.status || 500,
      error.message || "Internal server error",
    );
  }
};
