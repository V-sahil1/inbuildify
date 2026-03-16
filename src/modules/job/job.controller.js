import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function convertOpportunityToJob(req, res) {
  const { opportunity_id } = req.params;
  const { out_come, quotation_version_id, job_note, send_email } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Check if opportunity exists and get the lead's reference number
    const oppQuery = `
      SELECT o.opportunity_id, o.status, o.outcome, l.reference_number
      FROM opportunity o
      JOIN leads l ON o.leads_id = l.leads_id
      WHERE o.opportunity_id = $1
    `;
    const oppResult = await client.query(oppQuery, [opportunity_id]);

    if (oppResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Opportunity not found");
    }

    const opportunity = oppResult.rows[0];

    // 2. Logic for out_come = "lost"
    if (out_come === "lost") {
      await client.query(
        "UPDATE opportunity SET status = 'closed', outcome = $1, opportunity_notes = COALESCE($2, opportunity_notes), updated_at = NOW() WHERE opportunity_id = $3",
        ["lost", job_note || null, opportunity_id],
      );
      await client.query("COMMIT");
      return successResponse(res, {}, "Opportunity marked as lost and closed.");
    }

    // 3. Logic for out_come = "won"
    if (out_come === "won") {
      // Check if job already exists for this opportunity
      const jobCheck = await client.query(
        "SELECT job_id FROM job WHERE opportunity_id = $1",
        [opportunity_id],
      );

      if (jobCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "A job already exists for this opportunity.",
        );
      }

      // Check if quotation version exists
      if (!quotation_version_id) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Quotation version ID is required when status is WON",
        );
      }

      const qvCheck = await client.query(
        "SELECT quotation_version_id, is_approve FROM quotation_version WHERE quotation_version_id = $1 AND is_approve = true",
        [quotation_version_id],
      );

      if (qvCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Quotation version not found or not approved");
      }

      // Update opportunity attributes
      await client.query(
        "UPDATE opportunity SET status = 'closed', outcome = $1, updated_at = NOW() WHERE opportunity_id = $2",
        ["won", opportunity_id],
      );

      // Create new job with opportunity's associated lead reference number
      const insertJobQuery = `
        INSERT INTO job (
          reference_number, 
          opportunity_id, 
          quotation_version_id, 
          job_note, 
          send_email
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const insertValues = [
        opportunity.reference_number,
        opportunity_id,
        quotation_version_id,
        job_note || null,
        send_email || false,
      ];

      const jobResult = await client.query(insertJobQuery, insertValues);

      await client.query("COMMIT");

      return successResponse(
        res,
        keysToCamelCase(jobResult.rows[0]),
        "Opportunity converted to job successfully.",
      );
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Convert opportunity to job error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}
