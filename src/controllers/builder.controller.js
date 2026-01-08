const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { upsertBuilder, getBuilderProfile, getAllBuilders } = require("../services/builder.service");

exports.upsertBuilder = async (req, res) => {
  try {
    const builderId = req.user.builder_id;
    const logoUrl = req.file?.location || null;

    const builder = await upsertBuilder(builderId, req.body, logoUrl);

    return successResponse(
      res,
      keysToCamelCase(builder),
      "Builder profile saved successfully"
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 400, err.message);
  }
};

exports.getMyBuilderProfile = async (req, res) => {
  try {
    const builderId = req.user?.builder_id;
    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const builder = await getBuilderProfile(builderId);

    if (!builder) {
      return errorResponse(res, 404, "Builder not found");
    }

    return successResponse(
      res,
      keysToCamelCase(builder),
      "Builder profile fetched successfully"
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, "Failed to fetch builder profile");
  }
};

exports.getAllBuilders = async (req, res) => {
  try {
    const builders = await getAllBuilders();

    return successResponse(
      res,
      keysToCamelCase(builders),
      "All builders fetched successfully"
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, "Failed to fetch builders");
  }
};
