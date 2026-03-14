const getPool = require("../../config/database");
const { errorResponse, successResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createConstructionEtsRechargeApproval = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { role_id, amount } = req.body;
    const { user_id, company_id, builder_id } = req.user;

    if (!role_id || amount === undefined) {
      return errorResponse(
        res,
        400,
        "Missing required fields: role_id, amount",
      );
    }

    if (amount <= 0) {
      return errorResponse(res, 400, "Amount must be greater than 0");
    }

    const etsRechargeResult = await client.query(
      `SELECT construction_ets_recharge_id FROM construction_ets_recharge 
       WHERE (company_id = $1 AND company_id IS NOT NULL) 
          OR (builder_id = $2 AND builder_id IS NOT NULL)
       LIMIT 1`,
      [company_id, builder_id],
    );

    if (etsRechargeResult.rowCount === 0) {
      return errorResponse(
        res,
        400,
        "No construction ETS recharge record found for this user. Please create a construction ETS recharge record first.",
      );
    }

    const construction_ets_recharge_id =
      etsRechargeResult.rows[0].construction_ets_recharge_id;

    const roleCheck = await client.query(
      `SELECT role_id FROM role WHERE role_id = $1`,
      [role_id],
    );

    if (roleCheck.rowCount === 0) {
      return errorResponse(res, 400, "Invalid role_id");
    }

    const duplicateRoleCheck = await client.query(
      `
  SELECT 1
  FROM construction_ets_recharge_approval
  WHERE construction_ets_recharge_id = $1
    AND role_id = $2
  `,
      [construction_ets_recharge_id, role_id],
    );

    if (duplicateRoleCheck.rowCount > 0) {
      return errorResponse(
        res,
        400,
        "This role has already been added for approval. Duplicate role is not allowed.",
      );
    }

    const insertResult = await client.query(
      `
      INSERT INTO construction_ets_recharge_approval (
        construction_ets_recharge_id,
        role_id,
        amount,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $4)
      RETURNING 
        construction_ets_recharge_approval_id,
        construction_ets_recharge_id,
        role_id,
        (SELECT name FROM role WHERE role_id = construction_ets_recharge_approval.role_id) AS role_name,
        amount,
        created_by,
        updated_by,
        created_at,
        updated_at
      `,
      [construction_ets_recharge_id, role_id, amount, user_id],
    );

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Construction ETS recharge approval created successfully.",
    );
  } catch (error) {
    console.error("Create Construction ETS Recharge Approval Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getAllConstructionEtsRechargeApprovals = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_ets_recharge_id, role_id } = req.query;

    let whereClause = "";
    let values = [];

    if (construction_ets_recharge_id) {
      whereClause += `WHERE cera.construction_ets_recharge_id = $1`;
      values.push(construction_ets_recharge_id);
    }

    if (role_id) {
      if (whereClause) {
        whereClause += ` AND cera.role_id = $${values.length + 1}`;
      } else {
        whereClause += `WHERE cera.role_id = $1`;
      }
      values.push(role_id);
    }

    if (!whereClause) {
      whereClause = "WHERE 1=1";
    }

    const dataQuery = `
      SELECT
        cera.construction_ets_recharge_approval_id,
        cera.construction_ets_recharge_id,
        cera.role_id,
        r.name AS role_name,
        cera.amount,
        cera.created_at,
        cera.updated_at,
        u.name AS created_by_name
      FROM construction_ets_recharge_approval cera
      LEFT JOIN role r ON r.role_id = cera.role_id
      LEFT JOIN users u ON u.users_id = cera.created_by
      ${whereClause}
      ORDER BY cera.created_at DESC;
    `;

    const dataResult = await client.query(dataQuery, values);

    return successResponse(
      res,
      keysToCamelCase(dataResult.rows),
      "Construction ETS recharge approvals fetched successfully.",
    );
  } catch (error) {
    console.error("Get All Construction ETS Recharge Approvals Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getConstructionEtsRechargeApprovalById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_ets_recharge_approval_id } = req.params;

    if (!construction_ets_recharge_approval_id) {
      return errorResponse(
        res,
        400,
        "construction_ets_recharge_approval_id is required.",
      );
    }

    const query = `
      SELECT
        cera.construction_ets_recharge_approval_id,
        cera.construction_ets_recharge_id,
        cera.role_id,
        r.name AS role_name,
        cera.amount,
        cera.created_at,
        cera.updated_at,
        u.name AS created_by_name
      FROM construction_ets_recharge_approval cera
      LEFT JOIN role r ON r.role_id = cera.role_id
      LEFT JOIN users u ON u.users_id = cera.created_by
      WHERE cera.construction_ets_recharge_approval_id = $1;
    `;

    const result = await client.query(query, [
      construction_ets_recharge_approval_id,
    ]);

    if (result.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Construction ETS recharge approval not found.",
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Construction ETS recharge approval fetched successfully.",
    );
  } catch (error) {
    console.error("Get Construction ETS Recharge Approval By ID Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.updateConstructionEtsRechargeApproval = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_ets_recharge_approval_id } = req.params;
    const { role_id, amount } = req.body;
    const { user_id } = req.user;

    if (!construction_ets_recharge_approval_id) {
      return errorResponse(
        res,
        400,
        "construction_ets_recharge_approval_id is required.",
      );
    }

    if (!role_id && amount === undefined) {
      return errorResponse(
        res,
        400,
        "At least one field (role_id or amount) is required for update.",
      );
    }

    const existingResult = await client.query(
      `SELECT construction_ets_recharge_approval_id FROM construction_ets_recharge_approval WHERE construction_ets_recharge_approval_id = $1`,
      [construction_ets_recharge_approval_id],
    );

    if (existingResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Construction ETS recharge approval not found.",
      );
    }

    const currentApprovalResult = await client.query(
      `
  SELECT construction_ets_recharge_id, role_id
  FROM construction_ets_recharge_approval
  WHERE construction_ets_recharge_approval_id = $1
  `,
      [construction_ets_recharge_approval_id],
    );

    const { construction_ets_recharge_id } = currentApprovalResult.rows[0];

    if (role_id) {
      const duplicateRoleCheck = await client.query(
        `
    SELECT 1
    FROM construction_ets_recharge_approval
    WHERE construction_ets_recharge_id = $1
      AND role_id = $2
      AND construction_ets_recharge_approval_id <> $3
    `,
        [
          construction_ets_recharge_id,
          role_id,
          construction_ets_recharge_approval_id,
        ],
      );

      if (duplicateRoleCheck.rowCount > 0) {
        return errorResponse(
          res,
          400,
          "This role has already been added for approval. Duplicate role is not allowed.",
        );
      }
    }

    const updateFields = [];
    const updateValues = [];
    let idx = 1;

    if (role_id) {
      updateFields.push(`role_id = $${idx++}`);
      updateValues.push(role_id);
    }

    if (amount !== undefined) {
      if (amount <= 0) {
        return errorResponse(res, 400, "Amount must be greater than 0");
      }
      updateFields.push(`amount = $${idx++}`);
      updateValues.push(amount);
    }

    updateFields.push(`updated_by = $${idx++}`);
    updateValues.push(user_id);
    updateFields.push(`updated_at = NOW()`);

    await client.query(
      `UPDATE construction_ets_recharge_approval SET ${updateFields.join(
        ", ",
      )} WHERE construction_ets_recharge_approval_id = $${idx}`,
      [...updateValues, construction_ets_recharge_approval_id],
    );

    const responseQuery = `
      SELECT
        cera.construction_ets_recharge_approval_id,
        cera.construction_ets_recharge_id,
        cera.role_id,
        r.name AS role_name,
        cera.amount,
        cera.created_at,
        cera.updated_at,
        u.name AS created_by_name
      FROM construction_ets_recharge_approval cera
      LEFT JOIN role r ON r.role_id = cera.role_id
      LEFT JOIN users u ON u.users_id = cera.created_by
      WHERE cera.construction_ets_recharge_approval_id = $1;
    `;

    const responseResult = await client.query(responseQuery, [
      construction_ets_recharge_approval_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction ETS recharge approval updated successfully.",
    );
  } catch (error) {
    console.error("Update Construction ETS Recharge Approval Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.deleteConstructionEtsRechargeApproval = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_ets_recharge_approval_id } = req.params;

    if (!construction_ets_recharge_approval_id) {
      return errorResponse(
        res,
        400,
        "construction_ets_recharge_approval_id is required.",
      );
    }

    const checkResult = await client.query(
      `SELECT construction_ets_recharge_approval_id FROM construction_ets_recharge_approval WHERE construction_ets_recharge_approval_id = $1`,
      [construction_ets_recharge_approval_id],
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Construction ETS recharge approval not found.",
      );
    }

    await client.query(
      `DELETE FROM construction_ets_recharge_approval WHERE construction_ets_recharge_approval_id = $1`,
      [construction_ets_recharge_approval_id],
    );

    return successResponse(
      res,
      {},
      "Construction ETS recharge approval deleted successfully.",
    );
  } catch (error) {
    console.error("Delete Construction ETS Recharge Approval Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};
