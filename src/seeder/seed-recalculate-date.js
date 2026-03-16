/**
 * Seed default recalculate_date for a new builder
 */
async function seedRecalculateDate({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO recalculate_date (
      company_id, builder_id,
      recalculate_workflow_job_estimated_dates,
      recalculate_construction_job_estimated_dates,
      capture_reason_rebooking_and_rebooking_email,
      recalculate_confirmed_booking_dates,
      created_by, updated_by
    ) VALUES ($1, $2, false, false, false, false, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by],
  );
}

export default { seedRecalculateDate };
