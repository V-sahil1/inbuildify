const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createProperty = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const {
      lead_id,
      country,
      address1,
      address2,
      city_suburb,
      state_region,
      zip_postal_code,
      estate_name,
      title_status,
      title_date,
      compaction_report,
      land_type,
      width_m,
      depth_m,
      total_size_m2,
      site_fall_mm,
      land_fill_mm,
      bush_fire,
      corner_block,
    } = req.body;

    const leadCheck = await client.query(
      `SELECT 1 FROM leads WHERE lead_id = $1 AND builder_id = $2`,
      [lead_id, builderId]
    );

    if (leadCheck.rowCount === 0) {
      return errorResponse(res, 400, "Invalid lead id.");
    }

    const existing = await client.query(
      `SELECT property_id FROM property WHERE builder_id = $1 AND lead_id = $2`,
      [builderId, lead_id]
    );
    
    let result;
    if (existing.rowCount > 0) {
      result = await client.query(
        `UPDATE property SET
          country=$3, address1=$4, address2=$5, city_suburb=$6,
          state_region=$7, zip_postal_code=$8, estate_name=$9,
          title_status=$10, title_date=$11, compaction_report=$12,
          land_type=$13, width_m=$14, depth_m=$15,
          total_size_m2=$16, site_fall_mm=$17, land_fill_mm=$18,
          bush_fire=$19, corner_block=$20, updated_at=CURRENT_TIMESTAMP
        WHERE builder_id=$1 AND lead_id=$2
        RETURNING *`,
        [
          builderId,
          lead_id,
          country,
          address1,
          address2,
          city_suburb,
          state_region,
          zip_postal_code,
          estate_name,
          title_status,
          title_date,
          compaction_report,
          land_type,
          width_m,
          depth_m,
          total_size_m2,
          site_fall_mm,
          land_fill_mm,
          bush_fire,
          corner_block,
        ]
      );
    } else {
      result = await client.query(
        `INSERT INTO property (
          builder_id, lead_id, country, address1, address2, city_suburb,
          state_region, zip_postal_code, estate_name, title_status,
          title_date, compaction_report, land_type, width_m, depth_m,
          total_size_m2, site_fall_mm, land_fill_mm, bush_fire, corner_block,
          created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        )
        RETURNING *`,
        [
          builderId,
          lead_id,
          country,
          address1,
          address2,
          city_suburb,
          state_region,
          zip_postal_code,
          estate_name,
          title_status,
          title_date,
          compaction_report,
          land_type,
          width_m,
          depth_m,
          total_size_m2,
          site_fall_mm,
          land_fill_mm,
          bush_fire,
          corner_block,
        ]
      );
    }    

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Property created/updated successfully"
    );
  } catch (error) {
    console.error("Error creating property:", error);
    return errorResponse(res, error?.status || 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getPropertyByLeadId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { lead_id } = req.params;

    const query = `
      SELECT * FROM property 
      WHERE builder_id = $1 AND lead_id = $2
    `;
    const result = await client.query(query, [builderId, lead_id]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Property not found for this lead");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Property fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching property:", error);
    return errorResponse(res, error?.status || 400, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
