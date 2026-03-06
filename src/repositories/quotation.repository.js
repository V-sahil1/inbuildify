const getPool = require("../config/database");
const { keysToCamelCase } = require("../utils/common");

class QuotationRepository {
  constructor() {
    this.pool = getPool();
  }

  async getQuotationByLeadId(leadsId) {
    const client = await this.pool.connect();
    try {
      const query = `SELECT * FROM quotation WHERE leads_id = $1 LIMIT 1`;
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
          COALESCE(
            json_agg(
              json_build_object(
                'quotation_version_id', qv.quotation_version_id,
                'quotation_version_no', qv.quotation_version_no,
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
                'is_approve', qv.is_approve,
                'sketch_number', qv.sketch_number,
                'total_package_cost', COALESCE(
                  (SELECT SUM(p.cost)
                   FROM quotation_version_package_map qvpm
                   JOIN package p ON qvpm.package_id = p.package_id
                   WHERE qvpm.quotation_version_id = qv.quotation_version_id), 0
                ),
                'total_pricelist_cost', COALESCE(
                  (SELECT SUM(total_price)
                   FROM quotation_version_pricelist_item_map qvpim
                   WHERE qvpim.quotation_version_id = qv.quotation_version_id), 0
                ),
                'grand_total_cost', (
                  COALESCE(
                    (SELECT SUM(p.cost)
                     FROM quotation_version_package_map qvpm
                     JOIN package p ON qvpm.package_id = p.package_id
                     WHERE qvpm.quotation_version_id = qv.quotation_version_id), 0
                  ) + COALESCE(
                    (SELECT SUM(total_price)
                     FROM quotation_version_pricelist_item_map qvpim
                     WHERE qvpim.quotation_version_id = qv.quotation_version_id), 0
                  )
                ),
                'created_at', qv.created_at,
                'updated_at', qv.updated_at
              ) ORDER BY qv.quotation_version_no DESC
            ) FILTER (WHERE qv.quotation_version_id IS NOT NULL),
            '[]'
          ) AS versions
        FROM quotation q
        LEFT JOIN quotation_version qv ON q.quotation_id = qv.quotation_id
        LEFT JOIN location l ON qv.location_id = l.location_id
        LEFT JOIN range r ON qv.range_id = r.range_id
        LEFT JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
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
      const query = `SELECT MAX(quotation_version_no) as max_version FROM quotation_version WHERE quotation_id = $1`;
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
      const getVersionQuery = `SELECT * FROM quotation_version WHERE quotation_version_id = $1`;
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
              is_approve
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
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
      ];

      const newVersionResult = await client.query(
        insertVersionQuery,
        newVersionValues
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

      // 4. Copy Package Map
      const copyPackageMapQuery = `
          INSERT INTO quotation_version_package_map (
              quotation_version_id, package_id
          )
          SELECT $1, package_id
          FROM quotation_version_package_map
          WHERE quotation_version_id = $2
      `;
      await client.query(copyPackageMapQuery, [
        newVersion.quotation_version_id,
        sourceVersionId,
      ]);

      // 5. Copy Pricelist Item Map (removed custom fields as discussed)
      const copyPricelistItemMapQuery = `
          INSERT INTO quotation_version_pricelist_item_map (
              quotation_version_id, price_list_item_id, quantity, note, total_price
          )
          SELECT $1, price_list_item_id, quantity, note, total_price
          FROM quotation_version_pricelist_item_map
          WHERE quotation_version_id = $2
      `;
      await client.query(copyPricelistItemMapQuery, [
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
        SELECT qv.*,
          l.name as location_name,
          r.name as range_name,
          dt.name as dwelling_type_name,
          fp.name as floor_plan_name,
          f.name as facade_name,
          COALESCE(
            (SELECT SUM(p.cost)
             FROM quotation_version_package_map qvpm
             JOIN package p ON qvpm.package_id = p.package_id
             WHERE qvpm.quotation_version_id = qv.quotation_version_id), 0
          ) as total_package_cost,
          COALESCE(
            (SELECT SUM(total_price)
             FROM quotation_version_pricelist_item_map qvpim
             WHERE qvpim.quotation_version_id = qv.quotation_version_id), 0
          ) as total_pricelist_cost,
          (
            COALESCE(
              (SELECT SUM(p.cost)
               FROM quotation_version_package_map qvpm
               JOIN package p ON qvpm.package_id = p.package_id
               WHERE qvpm.quotation_version_id = qv.quotation_version_id), 0
            ) + COALESCE(
              (SELECT SUM(total_price)
               FROM quotation_version_pricelist_item_map qvpim
               WHERE qvpim.quotation_version_id = qv.quotation_version_id), 0
            )
          ) as grand_total_cost,
          leads.leads_id as lead_id,
          leads.lot_id as lead_lot_id,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', lcm.id,
              'contact_id', lcm.contact_id,
              'name', u.name,
              'email', u.email,
              'phone', u.phone
            )), '[]'::json)
            FROM leads_contact_map lcm
            JOIN users u ON lcm.contact_id = u.users_id
            WHERE lcm.leads_id = leads.leads_id
          ) as lead_contacts
        FROM quotation_version qv
        LEFT JOIN location l ON qv.location_id = l.location_id
        LEFT JOIN range r ON qv.range_id = r.range_id
        LEFT JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
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

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(versionId);

      const query = `
        UPDATE quotation_version
        SET ${updateFields.join(", ")}
        WHERE quotation_version_id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      if (result.rows.length === 0) return null;

      // Fetch the updated version with lead lot_id and contacts
      const enrichQuery = `
        SELECT qv.*,
          l.name as location_name,
          r.name as range_name,
          dt.name as dwelling_type_name,
          fp.name as floor_plan_name,
          f.name as facade_name,
          leads.leads_id as lead_id,
          leads.lot_id as lead_lot_id,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', lcm.id,
              'contact_id', lcm.contact_id,
              'name', u.name,
              'email', u.email,
              'phone', u.phone
            )), '[]'::json)
            FROM leads_contact_map lcm
            JOIN users u ON lcm.contact_id = u.users_id
            WHERE lcm.leads_id = leads.leads_id
          ) as lead_contacts
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        LEFT JOIN leads ON q.leads_id = leads.leads_id
        LEFT JOIN location l ON qv.location_id = l.location_id
        LEFT JOIN range r ON qv.range_id = r.range_id
        LEFT JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
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
        SELECT qv.*,
          l.name as location_name,
          r.name as range_name,
          dt.name as dwelling_type_name,
          fp.name as floor_plan_name,
          f.name as facade_name,
          COALESCE(
            (SELECT SUM(p.cost)
             FROM quotation_version_package_map qvpm
             JOIN package p ON qvpm.package_id = p.package_id
             WHERE qvpm.quotation_version_id = qv.quotation_version_id), 0
          ) as total_package_cost,
          COALESCE(
            (SELECT SUM(total_price)
             FROM quotation_version_pricelist_item_map qvpim
             WHERE qvpim.quotation_version_id = qv.quotation_version_id), 0
          ) as total_pricelist_cost,
          (
            COALESCE(
              (SELECT SUM(p.cost)
               FROM quotation_version_package_map qvpm
               JOIN package p ON qvpm.package_id = p.package_id
               WHERE qvpm.quotation_version_id = qv.quotation_version_id), 0
            ) + COALESCE(
              (SELECT SUM(total_price)
               FROM quotation_version_pricelist_item_map qvpim
               WHERE qvpim.quotation_version_id = qv.quotation_version_id), 0
            )
          ) as grand_total_cost,
          leads.leads_id as lead_id,
          leads.lot_id as lead_lot_id,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', lcm.id,
              'contact_id', lcm.contact_id,
              'name', u.name,
              'email', u.email,
              'phone', u.phone
            )), '[]'::json)
            FROM leads_contact_map lcm
            JOIN users u ON lcm.contact_id = u.users_id
            WHERE lcm.leads_id = leads.leads_id
          ) as lead_contacts
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        LEFT JOIN leads ON q.leads_id = leads.leads_id
        LEFT JOIN location l ON qv.location_id = l.location_id
        LEFT JOIN range r ON qv.range_id = r.range_id
        LEFT JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
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
        SELECT qv.quotation_version_id, qv.quotation_version_no, qv.facade_id,
          f.name as facade_name,
          COALESCE(
            (SELECT SUM(p.cost)
             FROM quotation_version_package_map qvpm
             JOIN package p ON qvpm.package_id = p.package_id
             WHERE qvpm.quotation_version_id = qv.quotation_version_id), 0
          ) as total_package_cost,
          COALESCE(
            (SELECT SUM(total_price)
             FROM quotation_version_pricelist_item_map qvpim
             WHERE qvpim.quotation_version_id = qv.quotation_version_id), 0
          ) as total_pricelist_cost,
          (
            COALESCE(
              (SELECT SUM(p.cost)
               FROM quotation_version_package_map qvpm
               JOIN package p ON qvpm.package_id = p.package_id
               WHERE qvpm.quotation_version_id = qv.quotation_version_id), 0
            ) + COALESCE(
              (SELECT SUM(total_price)
               FROM quotation_version_pricelist_item_map qvpim
               WHERE qvpim.quotation_version_id = qv.quotation_version_id), 0
            )
          ) as grand_total_cost
        FROM quotation_version qv
        LEFT JOIN facade f ON qv.facade_id = f.facade_id
        WHERE qv.quotation_version_id = $1
      `;
      const versionResult = await client.query(versionQuery, [versionId]);
      if (versionResult.rowCount === 0) return null;

      const version = keysToCamelCase(versionResult.rows[0]);

      // 2. Packages
      const packagesQuery = `
        SELECT qvpm.id, qvpm.package_id, p.name as package_name, p.cost as package_cost
        FROM quotation_version_package_map qvpm
        JOIN package p ON qvpm.package_id = p.package_id
        WHERE qvpm.quotation_version_id = $1
        ORDER BY p.name ASC
      `;
      const packagesResult = await client.query(packagesQuery, [versionId]);
      const packages = packagesResult.rows.map(r => keysToCamelCase(r));

      // 3. Pricelist items with price_list name
      const pricelistItemsQuery = `
        SELECT qvpim.id, qvpim.price_list_item_id, 
          pli.item_description, pli.price_list_id,
          pl.name as price_list_name,
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
        packages,
        pricelistItems,
      };
    } finally {
      client.release();
    }
  }

  async deleteQuotation(quotationId) {
    const client = await this.pool.connect();
    try {
      const query = `DELETE FROM quotation WHERE quotation_id = $1 RETURNING *`;
      const result = await client.query(query, [quotationId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }
}

module.exports = new QuotationRepository();
