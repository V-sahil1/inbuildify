const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createGeneralSetting = async (req, res) => {
  console.log("🚀 ~ req:", req.body);
  const pool = getPool();
  const client = await pool.connect();
  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;

  try {
    const {
      notification_referral_partner,
      pdf_password_protected,
      pdf_password,
      round_of_cost,
      negative_value_show,
      negative_value_color,
      show_reference_id_in_pdf,
      job_id_label,
    } = req.body;

    if (!builderId) {
      return errorResponse(res, 400, "Builder ID not found in user context.");
    }

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    await client.query("BEGIN");

    const existingSettings = await client.query(
      `
      SELECT id 
      FROM general_settings 
      WHERE company_id = $1 AND builder_id = $2;
      `,
      [companyId, builderId]
    );

    if (existingSettings.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "General settings already exist for this company and builder."
      );
    }

    let finalPassword = null;
    if (pdf_password_protected === true) {
      if (!pdf_password) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "PDF password is required when password protection is enabled."
        );
      }
      finalPassword = pdf_password;
    }

    const insertQuery = `
      INSERT INTO general_settings (
        company_id,
        builder_id,
        notification_referral_partner,
        pdf_password_protected,
        pdf_password,
        round_of_cost,
        negative_value_show,
        negative_value_color,
        show_reference_id_in_pdf,
        job_id_label
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      companyId,
      builderId,
      notification_referral_partner || false,
      pdf_password_protected || false,
      finalPassword,
      round_of_cost || false,
      negative_value_show || false,
      negative_value_color || null,
      show_reference_id_in_pdf || null,
      job_id_label || null,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "General settings created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating general settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateGeneralSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    const {
      notification_referral_partner,
      pdf_password_protected,
      pdf_password,
      round_of_cost,
      negative_value_show,
      negative_value_color,
      show_reference_id_in_pdf,
      job_id_label,
    } = req.body;

    if (
      notification_referral_partner === undefined &&
      pdf_password_protected === undefined &&
      pdf_password === undefined &&
      round_of_cost === undefined &&
      negative_value_show === undefined &&
      negative_value_color === undefined &&
      show_reference_id_in_pdf === undefined &&
      job_id_label === undefined
    ) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided for update."
      );
    }

    await client.query("BEGIN");

    // 🔹 Fetch builder's own record (ID REMOVED)
    const existing = await client.query(
      `
      SELECT pdf_password_protected
      FROM general_settings
      WHERE builder_id = $1
      `,
      [builderId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "General setting not found.");
    }

    const currentProtection = existing.rows[0].pdf_password_protected;

    const finalProtection =
      pdf_password_protected !== undefined
        ? pdf_password_protected
        : currentProtection;

    if (finalProtection === false && pdf_password !== undefined) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Cannot update or define PDF password when password protection is disabled."
      );
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (notification_referral_partner !== undefined) {
      fields.push(`notification_referral_partner = $${index++}`);
      values.push(notification_referral_partner);
    }

    if (pdf_password_protected !== undefined) {
      fields.push(`pdf_password_protected = $${index++}`);
      values.push(pdf_password_protected);
    }

    if (finalProtection === true && pdf_password !== undefined) {
      fields.push(`pdf_password = $${index++}`);
      values.push(pdf_password);
    }

    if (currentProtection === true && finalProtection === false) {
      fields.push(`pdf_password = NULL`);
    }

    if (round_of_cost !== undefined) {
      fields.push(`round_of_cost = $${index++}`);
      values.push(round_of_cost);
    }

    if (negative_value_show !== undefined) {
      fields.push(`negative_value_show = $${index++}`);
      values.push(negative_value_show);
    }

    if (negative_value_color !== undefined) {
      fields.push(`negative_value_color = $${index++}`);
      values.push(negative_value_color);
    }

    if (show_reference_id_in_pdf !== undefined) {
      fields.push(`show_reference_id_in_pdf = $${index++}`);
      values.push(show_reference_id_in_pdf);
    }

    if (job_id_label !== undefined) {
      fields.push(`job_id_label = $${index++}`);
      values.push(job_id_label);
    }

    fields.push(`company_id = $${index++}`);
    values.push(companyId);

    // 🔹 Update builder's own record (ID REMOVED)
    const updateQuery = `
      UPDATE general_settings
      SET ${fields.join(", ")}
      WHERE builder_id = $${index}
      RETURNING *;
    `;

    values.push(builderId);

    const result = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "General setting updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating general setting:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getUserGeneralSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id } = req.user;

    let result = await client.query(
      `SELECT * FROM general_settings
       WHERE company_id = $1 AND builder_id = $2
       LIMIT 1`,
      [company_id, builder_id]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `INSERT INTO general_settings (company_id, builder_id)
         VALUES ($1, $2)
         RETURNING *`,
        [company_id, builder_id]
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "General settings fetched"
    );
  } catch (error) {
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};
