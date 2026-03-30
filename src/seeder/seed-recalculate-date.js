/**
 * Seed default recalculate_date for a new builder
 */
export async function seedRecalculateDate({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT recalculate_date_id FROM recalculate_date
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO recalculate_date (
        recalculate_date_id,
        company_id, 
        builder_id,
        recalculate_workflow_job_estimated_dates,
        recalculate_construction_job_estimated_dates,
        capture_reason_rebooking_and_rebooking_email,
        capture_text,
        recalculate_confirmed_booking_dates,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, FALSE, FALSE, NULL, FALSE, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedRecalculateDate };
