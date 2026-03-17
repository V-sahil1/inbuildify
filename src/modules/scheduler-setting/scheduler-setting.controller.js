import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import getPool from "../../config/database.js";

export async function createSchedulerSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    let { receiver_of_replies } = req.body;

    receiver_of_replies = receiver_of_replies || [];

    const duplicateQuery = `
      SELECT scheduler_settings_id
      FROM scheduler_settings
      WHERE (builder_id IS NOT NULL AND builder_id = $1)
         OR (company_id IS NOT NULL AND company_id = $2)
    `;
    const duplicateResult = await client.query(duplicateQuery, [
      builderId,
      companyId,
    ]);

    if (duplicateResult.rows.length > 0) {
      return errorResponse(
        res,
        400,
        "Scheduler settings already exist for this builder/company.",
      );
    }

    if (receiver_of_replies.length > 0) {
      for (const uId of receiver_of_replies) {
        const checkUser = await client.query(
          "SELECT users_id FROM users WHERE users_id = $1 AND is_deleted = false",
          [uId],
        );
        if (checkUser.rows.length === 0) {
          return errorResponse(
            res,
            400,
            `Receiver of replies user ${uId} is invalid.`,
          );
        }
      }
    }

    const insertQuery = `
      INSERT INTO scheduler_settings (
        company_id,
        builder_id,
        receiver_of_replies,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3::uuid[], $4, $4)
      RETURNING *;
    `;

    const insertValues = [companyId, builderId, receiver_of_replies, userId];

    const result = await client.query(insertQuery, insertValues);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Scheduler settings created successfully.",
    );
  } catch (error) {
    console.error("Error creating scheduler settings:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
}

export async function updateSchedulerSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    let { receiver_of_replies } = req.body;
    receiver_of_replies = receiver_of_replies || undefined;

    const checkQuery = `
      SELECT *
      FROM scheduler_settings
      WHERE (builder_id = $1 OR company_id = $2)
      LIMIT 1
    `;
    const checkResult = await client.query(checkQuery, [builderId, companyId]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Scheduler settings not found or you are not authorized to update it.",
      );
    }

    const existing = checkResult.rows[0];

    if (!receiver_of_replies) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update.",
      );
    }

    if (receiver_of_replies) {
      for (const uId of receiver_of_replies) {
        const userCheck = await client.query(
          "SELECT users_id FROM users WHERE users_id = $1 AND is_deleted = false",
          [uId],
        );
        if (userCheck.rows.length === 0) {
          return errorResponse(
            res,
            400,
            `Receiver of replies user ${uId} is invalid.`,
          );
        }
      }
    }

    const finalReceiverOfReplies =
      receiver_of_replies ?? existing.receiver_of_replies;

    const updateQuery = `
      UPDATE scheduler_settings
      SET
        receiver_of_replies = $1::uuid[],
        updated_by = $2,
        updated_at = NOW()
      WHERE scheduler_settings_id = $3
      RETURNING receiver_of_replies;
    `;

    const updateValues = [
      finalReceiverOfReplies,
      userId,
      existing.scheduler_settings_id,
    ];

    const result = await client.query(updateQuery, updateValues);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Scheduler settings updated successfully.",
    );
  } catch (error) {
    console.error("Error updating scheduler settings:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
}

export async function getSchedulerSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    if (!company_id && !builder_id) {
      return errorResponse(
        res,
        400,
        "Invalid user context. Missing company or builder ID.",
      );
    }

    let result = await client.query(
      `
      SELECT receiver_of_replies
      FROM scheduler_settings
      WHERE company_id = $1 AND builder_id = $2
      LIMIT 1
      `,
      [company_id, builder_id],
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO scheduler_settings (
          company_id,
          builder_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $3)
        RETURNING receiver_of_replies
        `,
        [company_id, builder_id, user_id],
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Scheduler settings fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching scheduler settings:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
