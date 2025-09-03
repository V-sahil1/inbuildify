const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

exports.createBuilder = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const builder = await Builder.create({ name, email });
    successResponse(res, {
      statusCode: 201,
      message: "Builder created successfully",
      data: builder,
      requestId: req.requestId
    });
  } catch (err) {
    errorResponse(res, 500, err.message);
  }
};

exports.getBuilders = async (req, res, next) => {
  try {
    const builders = await Builder.findAll();
    successResponse(res, {
      statusCode: 200,
      message: "Builders fetched successfully",
      data: builders,
      requestId: req.requestId
    });
  } catch (err) {
    errorResponse(res, 500, err.message);
  }
};

exports.getBuilderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const builder = await Builder.findByPk(id);
    if (!builder) {
      return errorResponse(res, 404, "Builder not found");
    }
    successResponse(res, {
      statusCode: 200,
      message: "Builder fetched successfully",
      data: builder,
      requestId: req.requestId
    });
  } catch (err) {
    errorResponse(res, 500, err.message);
  }
};

exports.updateBuilder = async (req, res, next) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { builder_id } = req.user;
    const { name, phone, slogan, firm_name, abn_number, license_number } = req.body;
    const logo = req.file?.location || null;

    const builderQuery = `SELECT * FROM builder WHERE builder_id = $1;`;
    const builderResult = await client.query(builderQuery, [builder_id]);

    if (builderResult.rows.length === 0) {
      return errorResponse(res, 404, "Builder not found.");
    }

    const oldLogo = builderResult?.rows?.[0]?.logo;

    let updateFields = [];
    let values = [];
    let idx = 1;

    if (phone !== undefined) {
      updateFields.push(`phone_number = $${idx++}`);
      values.push(phone);
    }
    if (slogan !== undefined) {
      updateFields.push(`slogan = $${idx++}`);
      values.push(slogan);
    }
    if (firm_name !== undefined) {
      updateFields.push(`firm_name = $${idx++}`);
      values.push(firm_name);
    }
    if (abn_number !== undefined) {
      updateFields.push(`abn_number = $${idx++}`);
      values.push(abn_number);
    }
    if (license_number !== undefined) {
      updateFields.push(`license_number = $${idx++}`);
      values.push(license_number);
    }
    if (logo) {
      updateFields.push(`logo = $${idx++}`);
      values.push(logo);
    }

    if (updateFields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    values.push(builder_id);
    const updateQuery = `
      UPDATE builder 
      SET ${updateFields.join(", ")} 
      WHERE builder_id = $${idx} 
      RETURNING *;
    `;

    let updateResult = await client.query(updateQuery, values);

    if (updateResult.rows.length === 0) {
      return errorResponse(res, 500, "Failed to update builder.");
    }

    if (name !== undefined) {
      const userQuery = `UPDATE users SET name = $1 WHERE builder_id = $2 RETURNING name;`;
      const userResult = await client.query(userQuery, [name, builder_id]);
      updateResult.rows[0].name = userResult.rows[0].name;
    } else {
      const existsNameQuery = `SELECT name FROM users WHERE builder_id = $1;`;
      const existsNameResult = await client.query(existsNameQuery, [builder_id]);
      updateResult.rows[0].name = existsNameResult.rows[0].name;
    }

    if (logo && oldLogo && oldLogo !== logo) {
      await deleteFromS3(oldLogo);
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Builder updated successfully",
      data: keysToCamelCase(updateResult.rows[0])
    });
  } catch (err) {
    console.error("Update builder error:", err);
    errorResponse(res, err?.statusCode || 400, err?.message || "Failed to update builder.");
  } finally {
    client.release();
  }
};

exports.deleteBuilder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [affectedRows] = await Builder.destroy({ where: { id } });
    if (affectedRows === 0) {
      return errorResponse(res, 404, "Builder not found");
    }
    successResponse(res, {
      statusCode: 200,
      message: "Builder deleted successfully",
      data: null,
    });
  } catch (err) {
    errorResponse(res, err?.statusCode || 500, err?.message || "Failed to delete builder.");
  }
};
