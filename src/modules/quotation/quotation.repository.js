import getPool from "../../config/database.js";
import { keysToCamelCase } from "../../utils/common.js";


class QuotationRepository {
  constructor() {
    this.pool = getPool();
  }

  async getQuotationByLeadId(leadsId) {
    const client = await this.pool.connect();
    try {
      const query = "SELECT * FROM quotation WHERE leads_id = $1 LIMIT 1";
      const result = await client.query(query, [leadsId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getAllQuotationsByLeadId(leadsId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          q.*,
          (SELECT opportunity_id FROM opportunity WHERE leads_id = q.leads_id LIMIT 1) as opportunity_id,
          COALESCE(
            json_agg(
              json_build_object(
                'quotation_version_id', qv.quotation_version_id,
                'quotation_version_no', qv.quotation_version_no,
                'is_approve', qv.is_approve,
                'sketch_number', qv.sketch_number,
                'created_at', qv.created_at,
                'updated_at', qv.updated_at,
                'location_id', qv.location_id,
                'location_name', l.name,
                'range_id', qv.range_id,
                'range_name', r.name,
                'dwelling_type_id', qv.dwelling_type_id,
                'dwelling_type_name', dt.name,
                'floor_plan_id', qv.floor_plan_id,
                'floor_plan_name', fp.name,
                'facade_id', qv.facade_id,
                'facade_name', f.name,
                'package', (
                  SELECT json_build_object(
                    'package_id', p.package_id,
                    'name', p.name,
                    'cost', p.cost
                  )
                  FROM package p
                  WHERE p.package_id = qv.package_id LIMIT 1
                ),
                'total_package_cost', COALESCE(
                  (SELECT p.cost
                   FROM package p
                   WHERE p.package_id = qv.package_id), 0
                ),
                'updated_at', qv.updated_at,
                'structural_engineer', CASE WHEN qv.structure_engineer_id IS NOT NULL THEN
                  json_build_object(
                    'id', qv.structure_engineer_id,
                    'name', se.name,
                    'price', qv.structure_engineer_price,
                    'is_engineer_price_mismatch', CASE 
                      WHEN qv.structure_engineer_id IS NOT NULL AND se.price IS NOT NULL 
                           AND qv.structure_engineer_price::numeric != se.price::numeric THEN true 
                      ELSE false 
                    END
                  )
                ELSE NULL END,
                'quotation_version_items', (
                  SELECT COALESCE(json_agg(json_build_object(
                    'quotation_version_item_id', qvi.quotation_version_item_id,
                    'price_list_item_id', qvi.price_list_item_id,
                    'price_list_item_description', qvi.price_list_item_description,
                    'price_list_item_cost', qvi.price_list_item_cost,
                    'quantity', qvi.quantity,
                    'total_price', qvi.total_price,
                    'package_id', qvi.package_id,
                    'is_price_list_item_cost_mismatch', CASE 
                      WHEN qvi.price_list_item_id IS NOT NULL AND pli.cost IS NOT NULL 
                           AND qvi.price_list_item_cost::numeric != pli.cost::numeric THEN true 
                      ELSE false 
                    END,
                    'is_package_cost_mismatch', CASE 
                      WHEN qvi.package_id IS NOT NULL AND p.cost IS NOT NULL 
                           AND qvi.package_cost::numeric != p.cost::numeric THEN true 
                      ELSE false 
                    END
                  )), '[]'::json)
                  FROM quotation_version_items qvi
                  LEFT JOIN price_list_item pli ON qvi.price_list_item_id = pli.price_list_item_id
                  LEFT JOIN package p ON qvi.package_id = p.package_id
                  WHERE qvi.quotation_version_id = qv.quotation_version_id
                ),
                'package', (
                  SELECT json_build_object(
                    'package_id', qvi.package_id,
                    'name', qvi.package_name,
                    'cost', qvi.package_cost
                  )
                  FROM quotation_version_items qvi
                  WHERE qvi.quotation_version_id = qv.quotation_version_id 
                  AND qvi.package_id IS NOT NULL 
                  LIMIT 1
                ),
                'total_package_cost', COALESCE(
                  (SELECT DISTINCT package_cost 
                   FROM quotation_version_items 
                   WHERE quotation_version_id = qv.quotation_version_id 
                   AND package_id IS NOT NULL 
                   LIMIT 1), 0
                ),
                'total_pricelist_cost', COALESCE(
                  (SELECT SUM(total_price)
                   FROM quotation_version_items
                   WHERE quotation_version_id = qv.quotation_version_id
                   AND package_id IS NULL), 0
                ),
                'grand_total_cost', (
                  COALESCE(
                    (SELECT DISTINCT package_cost 
                     FROM quotation_version_items 
                     WHERE quotation_version_id = qv.quotation_version_id 
                     AND package_id IS NOT NULL 
                     LIMIT 1), 0
                  ) + COALESCE(
                    (SELECT SUM(total_price)
                     FROM quotation_version_items
                     WHERE quotation_version_id = qv.quotation_version_id
                     AND package_id IS NULL), 0
                  ) + COALESCE(qv.structure_engineer_price, 0)
                )
              ) ORDER BY qv.quotation_version_no DESC
            ) FILTER (WHERE qv.quotation_version_id IS NOT NULL),
            '[]'
          ) AS versions
        FROM quotation q
        LEFT JOIN quotation_version qv ON q.quotation_id = qv.quotation_id
        LEFT JOIN location l ON qv.location_id = l.location_id
        LEFT JOIN range r ON qv.range_id = r.range_id
        LEFT JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
        LEFT JOIN structure_engineer se ON qv.structure_engineer_id = se.structure_engineer_id
        LEFT JOIN floor_plan fp ON qv.floor_plan_id = fp.floor_plan_id
        LEFT JOIN facade f ON qv.facade_id = f.facade_id
        WHERE q.leads_id = $1
        GROUP BY q.quotation_id
        ORDER BY q.created_at DESC
      `;
      const result = await client.query(query, [leadsId]);
      return result.rows.map(row => ({
        ...keysToCamelCase(row),
        versions: row.versions.map(v => keysToCamelCase(v)),
      }));
    } finally {
      client.release();
    }
  }

  async getLatestQuotationVersionNo(quotationId) {
    const client = await this.pool.connect();
    try {
      const query = "SELECT MAX(quotation_version_no) as max_version FROM quotation_version WHERE quotation_id = $1";
      const result = await client.query(query, [quotationId]);
      return parseInt(result.rows[0].max_version || 0, 10);
    } finally {
      client.release();
    }
  }

  async getLatestQuotationVersionByLeadId(leadsId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT qv.* 
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        WHERE q.leads_id = $1
        ORDER BY q.created_at DESC, qv.quotation_version_no DESC
        LIMIT 1
      `;
      const result = await client.query(query, [leadsId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async createQuotation(quotationData) {
    const client = await this.pool.connect();
    try {
      const { leads_id, reference_number, created_by } = quotationData;

      const query = `
        INSERT INTO quotation (
          leads_id, reference_number, created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4
        ) RETURNING *
      `;

      const values = [leads_id, reference_number, created_by, created_by];

      const result = await client.query(query, values);
      return keysToCamelCase(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async createQuotationVersion(versionData) {
    const client = await this.pool.connect();
    try {
      const {
        quotation_id,
        quotation_version_no,
      } = versionData;

      const query = `
        INSERT INTO quotation_version (
          quotation_id, quotation_version_no
        ) VALUES (
          $1, $2
        ) RETURNING *
      `;

      const values = [
        quotation_id,
        quotation_version_no,
      ];

      const result = await client.query(query, values);
      return keysToCamelCase(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async duplicateVersion(sourceVersionId, newVersionNo) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Get original version data
      const getVersionQuery = "SELECT * FROM quotation_version WHERE quotation_version_id = $1";
      const versionResult = await client.query(getVersionQuery, [
        sourceVersionId,
      ]);

      if (versionResult.rowCount === 0) {
        throw new Error("Source quotation version not found");
      }

      const sourceVersion = versionResult.rows[0];

      // 2. Insert new version
      const insertVersionQuery = `
          INSERT INTO quotation_version (
              quotation_id, 
              quotation_version_no,
              location_id,
              range_id,
              dwelling_type_id,
              floor_plan_id,
              facade_id,
              is_approve,
              package_id,
              structure_engineer_id,
              structure_engineer_price,
              sketch_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, $9, $10, $11)
          RETURNING *
      `;

      const newVersionValues = [
        sourceVersion.quotation_id,
        newVersionNo,
        sourceVersion.location_id,
        sourceVersion.range_id,
        sourceVersion.dwelling_type_id,
        sourceVersion.floor_plan_id,
        sourceVersion.facade_id,
        sourceVersion.package_id,
        sourceVersion.structure_engineer_id || null,
        sourceVersion.structure_engineer_price || 0,
        sourceVersion.sketch_number || null,
      ];

      const newVersionResult = await client.query(
        insertVersionQuery,
        newVersionValues,
      );
      const newVersion = newVersionResult.rows[0];

      // 3. Copy Custom Sections
      const copyCustomSectionsQuery = `
          INSERT INTO quotation_version_custom_section (
              quotation_version_id, file_url, sort_order
          )
          SELECT $1, file_url, sort_order
          FROM quotation_version_custom_section
          WHERE quotation_version_id = $2
      `;
      await client.query(copyCustomSectionsQuery, [
        newVersion.quotation_version_id,
        sourceVersionId,
      ]);

      // 4. Copy Snapshot Items
      const copyItemsQuery = `
          INSERT INTO quotation_version_items (
              quotation_version_id, price_list_item_id, price_list_item_description,
              price_list_item_cost, quantity, total_price,
              package_id, package_name, package_cost, package_builder_cost,
              created_at, updated_at
          )
          SELECT $1, price_list_item_id, price_list_item_description,
                 price_list_item_cost, quantity, total_price,
                 package_id, package_name, package_cost, package_builder_cost,
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          FROM quotation_version_items
          WHERE quotation_version_id = $2
      `;
      await client.query(copyItemsQuery, [
        newVersion.quotation_version_id,
        sourceVersionId,
      ]);

      await client.query("COMMIT");
      return keysToCamelCase(newVersion);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getVersionsByQuotationId(quotationId, versionId = null) {
    const client = await this.pool.connect();
    try {
      const values = [quotationId];
      let query = `
        SELECT qv.quotation_version_id, qv.quotation_id,q.reference_number, qv.quotation_version_no,
          qv.is_approve, qv.sketch_number, qv.created_at, qv.updated_at,
          qv.location_id, l.name as location_name,
          qv.range_id, r.name as range_name,
          qv.dwelling_type_id, dt.name as dwelling_type_name,
          CASE WHEN qv.structure_engineer_id IS NOT NULL THEN
            json_build_object(
              'id', qv.structure_engineer_id,
              'name', se.name,
              'price', qv.structure_engineer_price,
              'is_engineer_price_mismatch', CASE 
                WHEN qv.structure_engineer_id IS NOT NULL AND se.price IS NOT NULL 
                     AND qv.structure_engineer_price::numeric != se.price::numeric THEN true 
                ELSE false 
              END
            )
          ELSE NULL END as structural_engineer,
          (
            SELECT json_build_object(
              'name', fp.name,
              'floor_plan_id', fp.floor_plan_id,
              'min_land_width', fp.min_land_width,
              'min_land_depth', fp.min_land_depth,
              'dwelling_area', fp.dwelling_area,
              'dwelling_type_id', fp.dwelling_type_id,
              'beds', fp.beds,
              'baths', fp.baths,
              'carpark', fp.carpark,
              'living', fp.living,
              'range_id', fp.range_id,
              'location_id', fp.location_id,
              'garage_area', fp.garage_area,
              'porch_area', fp.porch_area,
              'alfresco_area', fp.alfresco_area,
              'total_area', fp.total_area,
              'detailed_image', fp.detailed_image,
              'simple_image', fp.simple_image,
              'description', fp.description
            )
            FROM floor_plan fp WHERE fp.floor_plan_id = qv.floor_plan_id
          ) as floor_plan,
          (
            SELECT json_build_object(
              'name', f.name,
              'facade_id', f.facade_id,
              'location_id', f.location_id,
              'dwelling_type_id', f.dwelling_type_id,
              'range_id', f.range_id,
              'cost_type', f.cost_type,
              'cost', f.cost,
              'builder_cost', f.builder_cost,
              'image', f.image
            )
            FROM facade f WHERE f.facade_id = qv.facade_id
          ) as facade,
          (
            SELECT json_build_object(
              'package_id', qvi.package_id,
              'name', qvi.package_name,
              'cost', qvi.package_cost
            )
            FROM quotation_version_items qvi
            WHERE qvi.quotation_version_id = qv.quotation_version_id 
            AND qvi.package_id IS NOT NULL 
            LIMIT 1
          ) as package,
          COALESCE(
            (SELECT DISTINCT package_cost 
             FROM quotation_version_items qvi
             WHERE qvi.quotation_version_id = qv.quotation_version_id 
             AND qvi.package_id IS NOT NULL 
             LIMIT 1), 0
          ) as total_package_cost,
          COALESCE(
            (SELECT SUM(total_price)
             FROM quotation_version_items qvi
             WHERE qvi.quotation_version_id = qv.quotation_version_id
             AND package_id IS NULL), 0
          ) as total_pricelist_cost,
          (
            COALESCE(
               (SELECT DISTINCT package_cost 
                FROM quotation_version_items qvi
                WHERE qvi.quotation_version_id = qv.quotation_version_id 
                AND qvi.package_id IS NOT NULL 
                LIMIT 1), 0
            ) + COALESCE(
              (SELECT SUM(total_price)
               FROM quotation_version_items qvi
               WHERE qvi.quotation_version_id = qv.quotation_version_id
               AND package_id IS NULL), 0
            ) + COALESCE(qv.structure_engineer_price, 0)
          ) as grand_total_cost,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'quotation_version_item_id', qvi.quotation_version_item_id,
              'price_list_item_id', qvi.price_list_item_id,
              'price_list_item_description', qvi.price_list_item_description,
              'price_list_item_cost', qvi.price_list_item_cost,
              'quantity', qvi.quantity,
              'total_price', qvi.total_price,
              'package_id', qvi.package_id,
              'is_price_list_item_cost_mismatch', CASE 
                WHEN qvi.price_list_item_id IS NOT NULL AND pli.cost IS NOT NULL 
                     AND qvi.price_list_item_cost::numeric != pli.cost::numeric THEN true 
                ELSE false 
              END,
              'is_package_cost_mismatch', CASE 
                WHEN qvi.package_id IS NOT NULL AND p.cost IS NOT NULL 
                     AND qvi.package_cost::numeric != p.cost::numeric THEN true 
                ELSE false 
              END
            )), '[]'::json)
            FROM quotation_version_items qvi
            LEFT JOIN price_list_item pli ON qvi.price_list_item_id = pli.price_list_item_id
            LEFT JOIN package p ON qvi.package_id = p.package_id
            WHERE qvi.quotation_version_id = qv.quotation_version_id
          ) as quotation_version_items,
          leads.leads_id as lead_id,
          leads.property_detail_id as lead_property_detail_id,
          (
            SELECT json_build_object(
              'property_detail_id', pd.property_detail_id,
              'lot_id', pd.lot_id,
              'lot_number', pd.lot_number,
              'street', pd.street,
              'address_line1', pd.address_line1,
              'address_line2', pd.address_line2,
              'city', pd.city,
              'state_id', pd.state_id,
              'state_name', s.name,
              'country_id', pd.country_id,
              'zip_code', pd.zip_code,
              'estate_id', pd.estate_id,
              'estate_stage_id', pd.estate_stage_id,
              'estate_name', pd.estate_name,
              'title_status', pd.title_status,
              'title_date', pd.title_date,
              'clearing_date', pd.clearing_date,
              'compaction_report', pd.compaction_report,
              'compaction_report_url', pd.compaction_report_url,
              'compaction_report_content', pd.compaction_report_content,
              'land_type', pd.land_type,
              'width_m', pd.width_m,
              'depth_m', pd.depth_m,
              'total_size_m2', pd.total_size_m2,
              'site_fall_mm', pd.site_fall_mm,
              'land_fill_mm', pd.land_fill_mm,
              'price', pd.price,
              'bush_fire', pd.bush_fire,
              'corner_block', pd.corner_block,
              'is_hl_package_lot', pd.is_hl_package_lot,
              'compaction_report_provider', pd.compaction_report_provider
            )
            FROM property_detail pd 
            LEFT JOIN state s ON pd.state_id = s.state_id
            WHERE pd.property_detail_id = leads.property_detail_id
          ) as property,
          (
        SELECT COALESCE(json_agg(json_build_object(
              'id', lcm.id,
              'users_id', u.users_id,
              'name', u.name,
              'address', jsonb_build_object(
                'address_line1', a.address_line1,
                'address_line2', a.address_line2,
                'city', a.city,
                'zip_code', a.zip_code,
                'country_id', a.country_id,
                'state_id', a.state_id
              ),
              'phone', u.phone,
              'email', u.email
            )), '[]'::json)
            FROM leads_contact_map lcm
            JOIN users u ON lcm.contact_id = u.users_id
            LEFT JOIN address a ON u.address_id = a.address_id
            WHERE lcm.leads_id = leads.leads_id
          ) as lead_contacts,
          qv.created_at, qv.updated_at
        FROM quotation_version qv
        LEFT JOIN location l ON qv.location_id = l.location_id
        LEFT JOIN range r ON qv.range_id = r.range_id
        LEFT JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
        LEFT JOIN structure_engineer se ON qv.structure_engineer_id = se.structure_engineer_id
        LEFT JOIN floor_plan fp ON qv.floor_plan_id = fp.floor_plan_id
        LEFT JOIN facade f ON qv.facade_id = f.facade_id
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        LEFT JOIN leads ON q.leads_id = leads.leads_id
        WHERE qv.quotation_id = $1
      `;

      if (versionId) {
        query += ` AND qv.quotation_version_id = $2`;
        values.push(versionId);
      }

      query += ` ORDER BY qv.quotation_version_no DESC`;

      const result = await client.query(query, values);
      return result.rows.map(row => keysToCamelCase(row));
    } finally {
      client.release();
    }
  }

  async updateQuotationVersion(versionId, updateData) {
    const client = await this.pool.connect();
    try {
      const allowedFields = [
        "location_id", "range_id", "dwelling_type_id",
        "floor_plan_id", "facade_id", "is_approve", "sketch_number",
        "structure_engineer_id", "structure_engineer_price",
      ];

      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = $${paramIndex++}`);
          values.push(updateData[field]);
        }
      }

      if (updateFields.length === 0) {
        return null;
      }

      updateFields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(versionId);

      const query = `
        UPDATE quotation_version
        SET ${updateFields.join(", ")}
        WHERE quotation_version_id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      if (result.rows.length === 0) {
        return null;
      }

      // Fetch the updated version with lead lot_id and contacts
      const enrichQuery = `
        SELECT qv.quotation_version_id, qv.quotation_id, qv.quotation_version_no,
          qv.is_approve, qv.sketch_number, qv.created_at, qv.updated_at,
          qv.location_id, l.name as location_name,
          qv.range_id, r.name as range_name,
          qv.dwelling_type_id, dt.name as dwelling_type_name,
          CASE WHEN qv.structure_engineer_id IS NOT NULL THEN
            json_build_object(
              'id', qv.structure_engineer_id,
              'name', se.name,
              'price', qv.structure_engineer_price
            )
          ELSE NULL END as structural_engineer,
          (
            SELECT json_build_object(
              'name', fp.name,
              'floor_plan_id', fp.floor_plan_id,
              'min_land_width', fp.min_land_width,
              'min_land_depth', fp.min_land_depth,
              'dwelling_area', fp.dwelling_area,
              'dwelling_type_id', fp.dwelling_type_id,
              'beds', fp.beds,
              'baths', fp.baths,
              'carpark', fp.carpark,
              'living', fp.living,
              'range_id', fp.range_id,
              'location_id', fp.location_id,
              'garage_area', fp.garage_area,
              'porch_area', fp.porch_area,
              'alfresco_area', fp.alfresco_area,
              'total_area', fp.total_area,
              'detailed_image', fp.detailed_image,
              'simple_image', fp.simple_image,
              'description', fp.description
            )
            FROM floor_plan fp WHERE fp.floor_plan_id = qv.floor_plan_id
          ) as floor_plan,
          (
            SELECT json_build_object(
              'name', f.name,
              'facade_id', f.facade_id,
              'location_id', f.location_id,
              'dwelling_type_id', f.dwelling_type_id,
              'range_id', f.range_id,
              'cost_type', f.cost_type,
              'cost', f.cost,
              'builder_cost', f.builder_cost,
              'image', f.image
            )
            FROM facade f WHERE f.facade_id = qv.facade_id
          ) as facade,
          (
            SELECT json_build_object(
              'package_id', qvi.package_id,
              'name', qvi.package_name,
              'cost', qvi.package_cost
            )
            FROM quotation_version_items qvi
            WHERE qvi.quotation_version_id = qv.quotation_version_id 
            AND qvi.package_id IS NOT NULL 
            LIMIT 1
          ) as package,
          COALESCE(
            (SELECT DISTINCT package_cost 
             FROM quotation_version_items qvi
             WHERE qvi.quotation_version_id = qv.quotation_version_id 
             AND qvi.package_id IS NOT NULL 
             LIMIT 1), 0
          ) as total_package_cost,
          COALESCE(
            (SELECT SUM(total_price)
             FROM quotation_version_items qvi
             WHERE qvi.quotation_version_id = qv.quotation_version_id
             AND package_id IS NULL), 0
          ) as total_pricelist_cost,
          (
            COALESCE(
              (SELECT DISTINCT package_cost 
               FROM quotation_version_items qvi
               WHERE qvi.quotation_version_id = qv.quotation_version_id 
               AND qvi.package_id IS NOT NULL 
               LIMIT 1), 0
            ) + COALESCE(
              (SELECT SUM(total_price)
               FROM quotation_version_items qvi
               WHERE qvi.quotation_version_id = qv.quotation_version_id
               AND package_id IS NULL), 0
            ) + COALESCE(qv.structure_engineer_price, 0)
          ) as grand_total_cost,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'quotation_version_item_id', qvi.quotation_version_item_id,
              'price_list_item_id', qvi.price_list_item_id,
              'price_list_item_description', qvi.price_list_item_description,
              'price_list_item_cost', qvi.price_list_item_cost,
              'quantity', qvi.quantity,
              'total_price', qvi.total_price,
              'package_id', qvi.package_id,
              'is_price_list_item_cost_mismatch', CASE 
                WHEN qvi.price_list_item_id IS NOT NULL AND pli.cost IS NOT NULL 
                     AND qvi.price_list_item_cost::numeric != pli.cost::numeric THEN true 
                ELSE false 
              END,
              'is_package_cost_mismatch', CASE 
                WHEN qvi.package_id IS NOT NULL AND p.cost IS NOT NULL 
                     AND qvi.package_cost::numeric != p.cost::numeric THEN true 
                ELSE false 
              END
            )), '[]'::json)
            FROM quotation_version_items qvi
            LEFT JOIN price_list_item pli ON qvi.price_list_item_id = pli.price_list_item_id
            LEFT JOIN package p ON qvi.package_id = p.package_id
            WHERE qvi.quotation_version_id = qv.quotation_version_id
          ) as quotation_version_items,
          leads.leads_id as lead_id,
          leads.property_detail_id as lead_property_detail_id,
          (
           SELECT COALESCE(json_agg(json_build_object(
              'id', lcm.id,
              'users_id', u.users_id,
              'address', jsonb_build_object(
                'address_line1', a.address_line1,
                'address_line2', a.address_line2,
                'city', a.city,
                'zip_code', a.zip_code,
                'country_id', a.country_id,
                'state_id', a.state_id
              ),
              'phone', u.phone,
              'email', u.email
            )), '[]'::json)
            FROM leads_contact_map lcm
            JOIN users u ON lcm.contact_id = u.users_id
            LEFT JOIN address a ON u.address_id = a.address_id
            WHERE lcm.leads_id = leads.leads_id
          ) as lead_contacts,
          qv.created_at, qv.updated_at
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        LEFT JOIN leads ON q.leads_id = leads.leads_id
        LEFT JOIN location l ON qv.location_id = l.location_id
        LEFT JOIN range r ON qv.range_id = r.range_id
        LEFT JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
        LEFT JOIN structure_engineer se ON qv.structure_engineer_id = se.structure_engineer_id
        LEFT JOIN floor_plan fp ON qv.floor_plan_id = fp.floor_plan_id
        LEFT JOIN facade f ON qv.facade_id = f.facade_id
        WHERE qv.quotation_version_id = $1
      `;
      const enrichResult = await client.query(enrichQuery, [versionId]);
      return enrichResult.rows.length > 0 ? keysToCamelCase(enrichResult.rows[0]) : keysToCamelCase(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getQuotationVersionDetailsById(versionId) {
    const client = await this.pool.connect();
    try {
      const enrichQuery = `
        SELECT qv.quotation_version_id, qv.quotation_id,q.reference_number, qv.quotation_version_no,
          qv.location_id, qv.range_id, qv.dwelling_type_id, qv.is_approve,
          qv.sketch_number, qv.created_at, qv.updated_at,
          CASE WHEN qv.structure_engineer_id IS NOT NULL THEN
            json_build_object(
              'id', qv.structure_engineer_id,
              'name', se.name,
              'price', qv.structure_engineer_price,
              'is_engineer_price_mismatch', CASE 
                WHEN qv.structure_engineer_id IS NOT NULL AND se.price IS NOT NULL 
                     AND qv.structure_engineer_price::numeric != se.price::numeric THEN true 
                ELSE false 
              END
            )
          ELSE NULL END as structural_engineer,
          l.name as location_name,
          r.name as range_name,
          dt.name as dwelling_type_name,
          (
            SELECT json_build_object(
              'name', fp.name,
              'floor_plan_id', fp.floor_plan_id,
              'min_land_width', fp.min_land_width,
              'min_land_depth', fp.min_land_depth,
              'dwelling_area', fp.dwelling_area,
              'dwelling_type_id', fp.dwelling_type_id,
              'beds', fp.beds,
              'baths', fp.baths,
              'carpark', fp.carpark,
              'living', fp.living,
              'range_id', fp.range_id,
              'location_id', fp.location_id,
              'garage_area', fp.garage_area,
              'porch_area', fp.porch_area,
              'alfresco_area', fp.alfresco_area,
              'total_area', fp.total_area,
              'detailed_image', fp.detailed_image,
              'simple_image', fp.simple_image,
              'description', fp.description
            )
            FROM floor_plan fp WHERE fp.floor_plan_id = qv.floor_plan_id
          ) as floor_plan,
          (
            SELECT json_build_object(
              'name', f.name,
              'facade_id', f.facade_id,
              'location_id', f.location_id,
              'dwelling_type_id', f.dwelling_type_id,
              'range_id', f.range_id,
              'cost_type', f.cost_type,
              'cost', f.cost,
              'builder_cost', f.builder_cost,
              'image', f.image
            )
            FROM facade f WHERE f.facade_id = qv.facade_id
          ) as facade,
          (
            SELECT json_build_object(
              'package_id', qvi.package_id,
              'name', qvi.package_name,
              'cost', qvi.package_cost
            )
            FROM quotation_version_items qvi
            WHERE qvi.quotation_version_id = qv.quotation_version_id 
            AND qvi.package_id IS NOT NULL 
            LIMIT 1
          ) as package,
          COALESCE(
            (SELECT DISTINCT package_cost 
             FROM quotation_version_items qvi
             WHERE qvi.quotation_version_id = qv.quotation_version_id 
             AND qvi.package_id IS NOT NULL 
             LIMIT 1), 0
          ) as total_package_cost,
          COALESCE(
            (SELECT SUM(total_price)
             FROM quotation_version_items qvi
             WHERE qvi.quotation_version_id = qv.quotation_version_id
             AND package_id IS NULL), 0
          ) as total_pricelist_cost,
          (
            COALESCE(
              (SELECT DISTINCT package_cost 
               FROM quotation_version_items qvi
               WHERE qvi.quotation_version_id = qv.quotation_version_id 
               AND qvi.package_id IS NOT NULL 
               LIMIT 1), 0
            ) + COALESCE(
              (SELECT SUM(total_price)
               FROM quotation_version_items qvi
               WHERE qvi.quotation_version_id = qv.quotation_version_id
               AND package_id IS NULL), 0
            ) + COALESCE(qv.structure_engineer_price, 0)
          ) as grand_total_cost,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'quotation_version_item_id', qvi.quotation_version_item_id,
              'price_list_item_id', qvi.price_list_item_id,
              'price_list_item_description', qvi.price_list_item_description,
              'price_list_item_cost', qvi.price_list_item_cost,
              'quantity', qvi.quantity,
              'total_price', qvi.total_price,
              'package_id', qvi.package_id,
              'is_price_list_item_cost_mismatch', CASE 
                WHEN qvi.price_list_item_id IS NOT NULL AND pli.cost IS NOT NULL 
                     AND qvi.price_list_item_cost::numeric != pli.cost::numeric THEN true 
                ELSE false 
              END,
              'is_package_cost_mismatch', CASE 
                WHEN qvi.package_id IS NOT NULL AND p.cost IS NOT NULL 
                     AND qvi.package_cost::numeric != p.cost::numeric THEN true 
                ELSE false 
              END
            )), '[]'::json)
            FROM quotation_version_items qvi
            LEFT JOIN price_list_item pli ON qvi.price_list_item_id = pli.price_list_item_id
            LEFT JOIN package p ON qvi.package_id = p.package_id
            WHERE qvi.quotation_version_id = qv.quotation_version_id
          ) as quotation_version_items,
          leads.leads_id as lead_id,
          leads.property_detail_id as lead_property_detail_id,
          (
            SELECT json_build_object(
              'property_detail_id', pd.property_detail_id,
              'lot_id', pd.lot_id,
              'lot_number', pd.lot_number,
              'street', pd.street,
              'address_line1', pd.address_line1,
              'address_line2', pd.address_line2,
              'city', pd.city,
              'state_id', pd.state_id,
              'state_name', s.name,
              'country_id', pd.country_id,
              'zip_code', pd.zip_code,
              'estate_id', pd.estate_id,
              'estate_stage_id', pd.estate_stage_id,
              'estate_name', pd.estate_name,
              'title_status', pd.title_status,
              'title_date', pd.title_date,
              'clearing_date', pd.clearing_date,
              'compaction_report', pd.compaction_report,
              'compaction_report_url', pd.compaction_report_url,
              'compaction_report_content', pd.compaction_report_content,
              'land_type', pd.land_type,
              'width_m', pd.width_m,
              'depth_m', pd.depth_m,
              'total_size_m2', pd.total_size_m2,
              'site_fall_mm', pd.site_fall_mm,
              'land_fill_mm', pd.land_fill_mm,
              'price', pd.price,
              'bush_fire', pd.bush_fire,
              'corner_block', pd.corner_block,
              'is_hl_package_lot', pd.is_hl_package_lot,
              'compaction_report_provider', pd.compaction_report_provider
            )
            FROM property_detail pd 
            LEFT JOIN state s ON pd.state_id = s.state_id
            WHERE pd.property_detail_id = leads.property_detail_id
          ) as property,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', lcm.id,
              'users_id', u.users_id,
              'name', u.name,
              'address', jsonb_build_object(
                'address_line1', a.address_line1,
                'address_line2', a.address_line2,
                'city', a.city,
                'zip_code', a.zip_code,
                'country_id', a.country_id,
                'state_id', a.state_id
              ),
              'phone', u.phone,
              'email', u.email
            )), '[]'::json)
            FROM leads_contact_map lcm
            JOIN users u ON lcm.contact_id = u.users_id
            LEFT JOIN address a ON u.address_id = a.address_id
            WHERE lcm.leads_id = leads.leads_id
          ) as lead_contacts,
          qv.created_at, qv.updated_at
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        LEFT JOIN leads ON q.leads_id = leads.leads_id
        LEFT JOIN location l ON qv.location_id = l.location_id
        LEFT JOIN range r ON qv.range_id = r.range_id
        LEFT JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
        LEFT JOIN structure_engineer se ON qv.structure_engineer_id = se.structure_engineer_id
        LEFT JOIN floor_plan fp ON qv.floor_plan_id = fp.floor_plan_id
        LEFT JOIN facade f ON qv.facade_id = f.facade_id
        WHERE qv.quotation_version_id = $1
      `;
      const result = await client.query(enrichQuery, [versionId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getVersionComparisonData(versionId) {
    const client = await this.pool.connect();
    try {
      // 1. Version header with grand total
      const versionQuery = `
        SELECT qv.quotation_version_id, qv.quotation_version_no, qv.facade_id, qv.floor_plan_id,
          f.name as facade_name, fp.name as floor_plan_name,
          COALESCE(
            (SELECT DISTINCT package_cost 
             FROM quotation_version_items qvi 
             WHERE qvi.quotation_version_id = qv.quotation_version_id 
             AND qvi.package_id IS NOT NULL 
             LIMIT 1), 0
          ) as total_package_cost,
          COALESCE(
            (SELECT SUM(total_price)
             FROM quotation_version_items qvi
             WHERE qvi.quotation_version_id = qv.quotation_version_id
             AND package_id IS NULL), 0
          ) as total_pricelist_cost,
          (
            COALESCE(
              (SELECT DISTINCT package_cost 
               FROM quotation_version_items qvi 
               WHERE qvi.quotation_version_id = qv.quotation_version_id 
               AND qvi.package_id IS NOT NULL 
               LIMIT 1), 0
            ) + COALESCE(
              (SELECT SUM(total_price)
               FROM quotation_version_items qvi
               WHERE qvi.quotation_version_id = qv.quotation_version_id
               AND package_id IS NULL), 0
            ) + COALESCE(qv.structure_engineer_price, 0)
          ) as grand_total_cost
        FROM quotation_version qv
        LEFT JOIN facade f ON qv.facade_id = f.facade_id
        LEFT JOIN floor_plan fp ON qv.floor_plan_id = fp.floor_plan_id
        WHERE qv.quotation_version_id = $1
      `;
      const versionResult = await client.query(versionQuery, [versionId]);
      if (versionResult.rowCount === 0) {
        return null;
      }

      const version = keysToCamelCase(versionResult.rows[0]);

      // 2. Unified items from quotation_version_items table
      const itemsQuery = `
        SELECT 
          qvi.quotation_version_item_id,
          qvi.package_id,
          qvi.package_name,
          qvi.package_cost,
          qvi.price_list_item_id,
          qvi.price_list_item_description,
          qvi.price_list_item_short_description,
          qvi.price_list_item_cost,
          qvi.price_list_item_builder_cost,
          qvi.price_list_item_sort_order,
          qvi.price_list_item_uom,
          qvi.quantity,
          qvi.note,
          qvi.total_price,
          CASE 
            WHEN qvi.package_id IS NOT NULL THEN 'package'
            ELSE 'item'
          END as item_type,
          qvi.price_list_id,
          qvi.price_list_name
        FROM quotation_version_items qvi
        WHERE qvi.quotation_version_id = $1
        ORDER BY 
          CASE 
            WHEN qvi.package_id IS NOT NULL THEN 0 
            ELSE 1 
          END,
          qvi.price_list_item_sort_order ASC,
          qvi.package_name ASC,
          qvi.price_list_item_description ASC
      `;
      const itemsResult = await client.query(itemsQuery, [versionId]);
      const items = itemsResult.rows.map(r => keysToCamelCase(r));

      // 3. Extract package data for backward compatibility
      const packageItem = items.find(item => item.itemType === 'package');
      const packageData = packageItem ? {
        packageId: packageItem.packageId,
        packageName: packageItem.packageName,
        packageCost: packageItem.packageCost
      } : null;

      // 4. Extract pricelist items for backward compatibility
      const pricelistItems = items
        .filter(item => item.itemType === 'item')
        .map(item => ({
          id: item.quotationVersionItemId,
          priceListItemId: item.priceListItemId,
          itemDescription: item.priceListItemDescription,
          priceListId: item.priceListId,
          priceListName: item.priceListName,
          itemCost: item.priceListItemCost,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          note: item.note
        }));

      return {
        version,
        package: packageData,
        pricelistItems,
        items, // New unified items array
      };
    } finally {
      client.release();
    }
  }

  async deleteQuotation(quotationId) {
    const client = await this.pool.connect();
    try {
      const query = "DELETE FROM quotation WHERE quotation_id = $1 RETURNING *";
      const result = await client.query(query, [quotationId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async removePackageFromVersion(versionId, packageId, builderId, companyId) {
    const client = await this.pool.connect();
    try {
      // Find the version explicitly to ensure ownership and that the version exists
      const query = `
        UPDATE quotation_version
        SET package_id = NULL
        WHERE quotation_version_id = $1 AND package_id = $2
        RETURNING *
      `;
      const result = await client.query(query, [versionId, packageId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async updatePdfUrl(versionId, pdfUrl) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE quotation_version
        SET pdf_url = $1, updated_at = CURRENT_TIMESTAMP
        WHERE quotation_version_id = $2
        RETURNING quotation_version_id, pdf_url
      `;
      const result = await client.query(query, [pdfUrl, versionId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async clearPdfUrl(versionId) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE quotation_version
        SET pdf_url = NULL
        WHERE quotation_version_id = $1
      `;
      await client.query(query, [versionId]);
    } finally {
      client.release();
    }
  }

  async getPdfUrl(versionId) {
    const client = await this.pool.connect();
    try {
      const query = `SELECT pdf_url FROM quotation_version WHERE quotation_version_id = $1`;
      const result = await client.query(query, [versionId]);
      return result.rows.length > 0 ? result.rows[0].pdf_url : null;
    } finally {
      client.release();
    }
  }

  async getAllQuotations(builderId, companyId, options = {}) {
    const client = await this.pool.connect();
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        status = '',
        statuses = [],
        leadIds = [],
        contactIds = [],
        startDate = '',
        endDate = '',
        sortBy = '',
        sortOrder = '',
      } = options;

      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params = [builderId];
      let paramIndex = 2;

      let searchCondition = '';
      if (search && search.trim()) {
        searchCondition = `AND (
          q.reference_number ILIKE $${paramIndex}
          OR l.name ILIKE $${paramIndex}
          OR EXISTS (
            SELECT 1
            FROM leads_contact_map lcm_s
            JOIN users u_s ON lcm_s.contact_id = u_s.users_id
            WHERE lcm_s.leads_id = l.leads_id
            AND (
              u_s.name ILIKE $${paramIndex}
              OR u_s.phone ILIKE $${paramIndex}
              OR u_s.email ILIKE $${paramIndex}
            )
          )
          OR EXISTS (
            SELECT 1
            FROM property_detail pd_s
            LEFT JOIN lot lot_s ON pd_s.lot_id = lot_s.lot_id
            WHERE pd_s.property_detail_id = l.property_detail_id
            AND (
              COALESCE(lot_s.street, '') ILIKE $${paramIndex}
              OR COALESCE(lot_s.city, '') ILIKE $${paramIndex}
              OR COALESCE(pd_s.address_line1, '') ILIKE $${paramIndex}
              OR COALESCE(pd_s.address_line2, '') ILIKE $${paramIndex}
            )
          )
          OR COALESCE(assignee_user.name, '') ILIKE $${paramIndex}
          OR COALESCE(created_by_user.name, '') ILIKE $${paramIndex}
        )`;
        params.push(`%${search.trim()}%`);
        paramIndex++;
      }

      const expiredCondition = `(
        qv.quotation_version_id IS NOT NULL
        AND qv.is_approve = FALSE
        AND NOW() > (
          (CASE
            WHEN COALESCE(qs.extend_validity_from_updated_date, 0) = 1
              THEN COALESCE(qv.updated_at, qv.created_at, q.updated_at, q.created_at)
            ELSE COALESCE(qv.created_at, q.created_at)
          END)
          + (COALESCE(qs.quotation_validity_days, 30) || ' days')::interval
        )
      )`;
      const approvedCondition = `(
        qv.quotation_version_id IS NOT NULL
        AND qv.is_approve = TRUE
      )`;
      const cancelledCondition = `(COALESCE(LOWER(l.status), '') = 'cancelled')`;
      const activeDraftCondition = `(
        qv.quotation_version_id IS NOT NULL
        AND qv.is_approve = FALSE
        AND NOT ${expiredCondition}
        AND NOT ${cancelledCondition}
      )`;

      let statusCondition = '';
      const normalizedStatuses = (Array.isArray(statuses) && statuses.length > 0
        ? statuses
        : status
          ? [status]
          : []
      ).map(s => String(s).trim()).filter(Boolean);
      if (normalizedStatuses.length > 0) {
        const wantsApproved = normalizedStatuses.includes('approved');
        const wantsExpired = normalizedStatuses.includes('expired');
        const wantsCancelled = normalizedStatuses.includes('cancelled');
        const wantsDraftLike = normalizedStatuses.some(s => ['draft', 'pendingApproval', 'modified'].includes(s));
        const statusOrConditions = [];
        if (wantsApproved) statusOrConditions.push(approvedCondition);
        if (wantsExpired) statusOrConditions.push(expiredCondition);
        if (wantsCancelled) statusOrConditions.push(cancelledCondition);
        if (wantsDraftLike) statusOrConditions.push(activeDraftCondition);
        if (statusOrConditions.length > 0) {
          statusCondition = `AND (${statusOrConditions.join(' OR ')})`;
        }
      }

      let leadCondition = '';
      if (Array.isArray(leadIds) && leadIds.length > 0) {
        const cleanLeadIds = leadIds.map(id => String(id).trim()).filter(Boolean);
        if (cleanLeadIds.length > 0) {
          leadCondition = ` AND l.leads_id = ANY($${paramIndex}::uuid[])`;
          params.push(cleanLeadIds);
          paramIndex++;
        }
      }

      let contactCondition = '';
      if (Array.isArray(contactIds) && contactIds.length > 0) {
        const cleanContactIds = contactIds.map(id => String(id).trim()).filter(Boolean);
        if (cleanContactIds.length > 0) {
          contactCondition = ` AND EXISTS (
            SELECT 1
            FROM leads_contact_map lcm_filter
            WHERE lcm_filter.leads_id = l.leads_id
            AND lcm_filter.contact_id = ANY($${paramIndex}::uuid[])
          )`;
          params.push(cleanContactIds);
          paramIndex++;
        }
      }

      let dateCondition = '';
      if (startDate) {
        dateCondition += ` AND q.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }
      if (endDate) {
        dateCondition += ` AND q.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      const normalizedSortOrder = String(sortOrder || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      const sortByKey = String(sortBy || '');
      const sortFieldMap = {
        createdAt: 'created_at',
        quotationTotal: 'quotation_total',
        referenceNumber: 'q.reference_number',
        customerName: 'customer_name',
        status: 'status',
      };
      const primarySortField = sortFieldMap[sortByKey] || null;
      const orderByClause = primarySortField
        ? `${primarySortField} ${normalizedSortOrder}, q.created_at DESC, qv.quotation_version_no DESC`
        : `q.created_at DESC, qv.quotation_version_no DESC`;

      const companyCondition = companyId ? ` OR l.company_id = '${companyId}'` : '';

      const countQuery = `
        SELECT COUNT(DISTINCT qv.quotation_version_id) as total
        FROM quotation q
        LEFT JOIN quotation_version qv ON qv.quotation_id = q.quotation_id
        JOIN leads l ON q.leads_id = l.leads_id
        LEFT JOIN quotation_settings qs ON qs.builder_id = l.builder_id AND qs.company_id = l.company_id
        LEFT JOIN users assignee_user ON l.assignee_id = assignee_user.users_id
        LEFT JOIN users created_by_user ON q.created_by = created_by_user.users_id
        WHERE (l.builder_id = $1${companyCondition})
        ${searchCondition}
        ${statusCondition}
        ${leadCondition}
        ${contactCondition}
        ${dateCondition}
      `;

      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total, 10);

      // Add pagination params
      params.push(parseInt(limit, 10), offset);

      const dataQuery = `
        SELECT
          q.quotation_id,
          q.reference_number,
          q.leads_id,
          COALESCE(qv.created_at, q.created_at) AS created_at,
          q.updated_at,
          l.name AS customer_name,
          COALESCE(
            NULLIF(TRIM(COALESCE(lot.street, '') || CASE WHEN lot.street IS NOT NULL AND lot.city IS NOT NULL THEN ', ' ELSE '' END || COALESCE(lot.city, '')), ''),
            'N/A'
          ) AS property_address,
          COALESCE(
            NULLIF(
              TRIM(
                CONCAT_WS(
                  ', ',
                  NULLIF(TRIM(COALESCE(pd.lot_number, '')), ''),
                  NULLIF(TRIM(COALESCE(pd.street, '')), ''),
                  NULLIF(TRIM(COALESCE(pd.address_line1, '')), ''),
                  NULLIF(TRIM(COALESCE(pd.address_line2, '')), ''),
                  NULLIF(TRIM(COALESCE(pd.city, '')), ''),
                  NULLIF(TRIM(COALESCE(st.name, '')), ''),
                  NULLIF(TRIM(COALESCE(pd.zip_code, '')), '')
                )
              ),
              ''
            ),
            'N/A'
          ) AS property_details,
          COALESCE(
            (
              SELECT u.name
              FROM leads_contact_map lcm
              JOIN users u ON lcm.contact_id = u.users_id
              WHERE lcm.leads_id = l.leads_id
              ORDER BY lcm.created_at ASC
              LIMIT 1
            ),
            l.name,
            'N/A'
          ) AS contact_name,
          COALESCE(assignee_user.name, '') AS assignee_name,
          COALESCE(assignee_user.initials, '') AS assignee_initials,
          COALESCE(created_by_user.name, '') AS approver_name,
          COALESCE(created_by_user.initials, '') AS approver_initials,
          CASE
            WHEN ${cancelledCondition} THEN 'cancelled'
            WHEN ${approvedCondition} THEN 'approved'
            WHEN ${expiredCondition} THEN 'expired'
            ELSE 'draft'
          END AS status,
          qv.quotation_version_id AS latest_version_id,
          qv.quotation_version_no AS latest_version_no,
          (
            COALESCE(
              (SELECT DISTINCT qvi.package_cost
               FROM quotation_version_items qvi
               WHERE qvi.quotation_version_id = qv.quotation_version_id
               AND qvi.package_id IS NOT NULL
               LIMIT 1),
              0
            ) +
            COALESCE(
              (SELECT SUM(qvi.total_price)
               FROM quotation_version_items qvi
               WHERE qvi.quotation_version_id = qv.quotation_version_id
               AND qvi.package_id IS NULL),
              0
            ) +
            COALESCE(
              (SELECT qv_total.structure_engineer_price
               FROM quotation_version qv_total
               WHERE qv_total.quotation_version_id = qv.quotation_version_id
               LIMIT 1),
              0
            )
          ) AS quotation_total,
          (
            SELECT COUNT(*) FROM quotation_version qv_cnt
            WHERE qv_cnt.quotation_id = q.quotation_id
          ) AS version_count
        FROM quotation q
        LEFT JOIN quotation_version qv ON qv.quotation_id = q.quotation_id
        JOIN leads l ON q.leads_id = l.leads_id
        LEFT JOIN quotation_settings qs ON qs.builder_id = l.builder_id AND qs.company_id = l.company_id
        LEFT JOIN users assignee_user ON l.assignee_id = assignee_user.users_id
        LEFT JOIN users created_by_user ON q.created_by = created_by_user.users_id
        LEFT JOIN property_detail pd ON l.property_detail_id = pd.property_detail_id
        LEFT JOIN lot ON pd.lot_id = lot.lot_id
        LEFT JOIN state st ON pd.state_id = st.state_id
        WHERE (l.builder_id = $1${companyCondition})
        ${searchCondition}
        ${statusCondition}
        ${leadCondition}
        ${contactCondition}
        ${dateCondition}
        ORDER BY ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const result = await client.query(dataQuery, params);

      return {
        data: result.rows.map(row => keysToCamelCase(row)),
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(total / parseInt(limit, 10)),
        },
      };
    } finally {
      client.release();
    }
  }

  async getQuotationFilterOptions(builderId, companyId) {
    const client = await this.pool.connect();
    try {
      // Base options on leads (and their contacts), not only leads that already have
      // quotation rows — otherwise the dropdown stays empty until every lead has a quote.
      const whereClause = companyId
        ? "(l.builder_id = $1 OR l.company_id = $2)"
        : "l.builder_id = $1";
      const params = companyId ? [builderId, companyId] : [builderId];
        const query = `
        SELECT DISTINCT
          opts.option_type,
          opts.option_id,
          opts.option_label,
          opts.opt_leads_id as leads_id,
          opts.customer_name,
          opts.contact_name
        FROM leads l
        LEFT JOIN leads_contact_map lcm ON l.leads_id = lcm.leads_id
        LEFT JOIN users u ON lcm.contact_id = u.users_id
        CROSS JOIN LATERAL (
          VALUES
            (
              'lead',
              l.leads_id::text,
              COALESCE(NULLIF(TRIM(l.name), ''), 'Unknown'),
              l.leads_id,
              COALESCE(NULLIF(TRIM(l.name), ''), 'Unknown'),
              NULL::text
            ),
            (
              'contact',
              COALESCE(u.users_id::text, ''),
              CASE
                WHEN u.users_id IS NULL THEN NULL
                ELSE CONCAT(
                  COALESCE(NULLIF(TRIM(u.name), ''), 'Unknown Contact'),
                  ' (',
                  COALESCE(NULLIF(TRIM(l.name), ''), 'Unknown'),
                  ')'
                )
              END,
              l.leads_id,
              COALESCE(NULLIF(TRIM(l.name), ''), 'Unknown'),
              COALESCE(NULLIF(TRIM(u.name), ''), 'Unknown Contact')
            )
        ) AS opts(option_type, option_id, option_label, leads_id, customer_name, contact_name)
        WHERE ${whereClause}
          AND opts.option_label IS NOT NULL
          AND opts.option_id <> ''
        ORDER BY option_label ASC
      `;
      const result = await client.query(query, params);
      return result.rows.map(row => keysToCamelCase(row));
    } finally {
      client.release();
    }
  }

  async getQuotationCountsByStatus(builderId, companyId) {
    const client = await this.pool.connect();
    try {
      const companyCondition = companyId ? ` OR l.company_id = '${companyId}'` : '';
      const query = `
        WITH quotation_versions AS (
          SELECT
            qv.quotation_version_id,
            l.builder_id,
            l.company_id,
            LOWER(COALESCE(l.status, '')) AS lead_status,
            qv.is_approve,
            qv.created_at AS version_created_at,
            qv.updated_at AS version_updated_at,
            q.created_at AS quotation_created_at,
            COALESCE(qs.quotation_validity_days, 30) AS quotation_validity_days,
            COALESCE(qs.extend_validity_from_updated_date, 0) AS extend_validity_from_updated_date
          FROM quotation q
          LEFT JOIN quotation_version qv ON qv.quotation_id = q.quotation_id
          JOIN leads l ON q.leads_id = l.leads_id
          LEFT JOIN quotation_settings qs ON qs.builder_id = l.builder_id AND qs.company_id = l.company_id
          WHERE (l.builder_id = $1${companyCondition})
        )
        SELECT
          COUNT(DISTINCT quotation_version_id) AS total,
          COUNT(DISTINCT CASE WHEN is_approve = TRUE THEN quotation_version_id END) AS approved,
          COUNT(DISTINCT CASE WHEN lead_status = 'cancelled' THEN quotation_version_id END) AS cancelled,
          COUNT(DISTINCT CASE WHEN is_approve = FALSE AND NOW() > (
            (CASE
              WHEN extend_validity_from_updated_date = 1
                THEN COALESCE(version_updated_at, version_created_at, quotation_created_at)
              ELSE COALESCE(version_created_at, quotation_created_at)
            END)
            + (quotation_validity_days || ' days')::interval
          ) THEN quotation_version_id END) AS expired,
          COUNT(DISTINCT CASE WHEN is_approve = FALSE
            AND lead_status <> 'cancelled'
            AND NOW() <= (
            (CASE
              WHEN extend_validity_from_updated_date = 1
                THEN COALESCE(version_updated_at, version_created_at, quotation_created_at)
              ELSE COALESCE(version_created_at, quotation_created_at)
            END)
            + (quotation_validity_days || ' days')::interval
          ) THEN quotation_version_id END) AS draft
        FROM quotation_versions
      `;
      const result = await client.query(query, [builderId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : { total: 0, approved: 0, draft: 0, expired: 0 };
    } finally {
      client.release();
    }
  }
}

export default new QuotationRepository();
