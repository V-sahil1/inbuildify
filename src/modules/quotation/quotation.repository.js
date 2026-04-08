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

  async getVersionsByQuotationId(quotationId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT qv.quotation_version_id, qv.quotation_id, qv.quotation_version_no,
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
        LEFT JOIN location l ON qv.location_id = l.location_id
        LEFT JOIN range r ON qv.range_id = r.range_id
        LEFT JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
        LEFT JOIN structure_engineer se ON qv.structure_engineer_id = se.structure_engineer_id
        LEFT JOIN floor_plan fp ON qv.floor_plan_id = fp.floor_plan_id
        LEFT JOIN facade f ON qv.facade_id = f.facade_id
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        LEFT JOIN leads ON q.leads_id = leads.leads_id
        WHERE qv.quotation_id = $1
        ORDER BY qv.quotation_version_no DESC
      `;
      const result = await client.query(query, [quotationId]);
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
        SELECT qv.quotation_version_id, qv.quotation_id, qv.quotation_version_no,
          qv.location_id, qv.range_id, qv.dwelling_type_id, qv.is_approve,
          qv.sketch_number, qv.created_at, qv.updated_at,
          CASE WHEN qv.structure_engineer_id IS NOT NULL THEN
            json_build_object(
              'id', qv.structure_engineer_id,
              'name', se.name,
              'price', qv.structure_engineer_price
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

      // 2. Package
      const packageQuery = `
        SELECT p.package_id, p.name as package_name, p.cost as package_cost
        FROM quotation_version qv
        JOIN package p ON p.package_id = qv.package_id
        WHERE qv.quotation_version_id = $1
      `;
      const packageResult = await client.query(packageQuery, [versionId]);
      const packageData = packageResult.rows.length > 0 ? keysToCamelCase(packageResult.rows[0]) : null;

      // 3. Pricelist items with price_list name
      const pricelistItemsQuery = `
        SELECT qvpim.id, qvpim.price_list_item_id, 
          pli.item_description, pli.price_list_id,
          pl.name as price_list_name, pli.cost as item_cost,                
          qvpim.quantity, qvpim.total_price, qvpim.note
        FROM quotation_version_pricelist_item_map qvpim
        JOIN price_list_item pli ON qvpim.price_list_item_id = pli.price_list_item_id
        JOIN price_list pl ON pli.price_list_id = pl.price_list_id
        WHERE qvpim.quotation_version_id = $1
        ORDER BY pl.sort_order ASC, pli.sort_order ASC
      `;
      const pricelistItemsResult = await client.query(pricelistItemsQuery, [versionId]);
      const pricelistItems = pricelistItemsResult.rows.map(r => keysToCamelCase(r));

      return {
        version,
        package: packageData,
        pricelistItems,
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
}

export default new QuotationRepository();
