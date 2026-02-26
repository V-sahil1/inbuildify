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
                'range_id', qv.range_id,
                'dwelling_type_id', qv.dwelling_type_id,
                'floor_plan_id', qv.floor_plan_id,
                'facade_id', qv.facade_id,
                'is_approve', qv.is_approve,
                'sketch_number', qv.sketch_number,
                'created_at', qv.created_at,
                'updated_at', qv.updated_at
              ) ORDER BY qv.quotation_version_no DESC
            ) FILTER (WHERE qv.quotation_version_id IS NOT NULL),
            '[]'
          ) AS versions
        FROM quotation q
        LEFT JOIN quotation_version qv ON q.quotation_id = qv.quotation_id
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

  async getVersionsByQuotationId(quotationId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT qv.*,
          l.name as location_name,
          r.name as range_name,
          dt.name as dwelling_type_name,
          fp.name as floor_plan_name,
          f.name as facade_name
        FROM quotation_version qv
        LEFT JOIN location l ON qv.location_id = l.location_id
        LEFT JOIN range r ON qv.range_id = r.range_id
        LEFT JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
        LEFT JOIN floor_plan fp ON qv.floor_plan_id = fp.floor_plan_id
        LEFT JOIN facade f ON qv.facade_id = f.facade_id
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
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
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
