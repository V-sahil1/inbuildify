const getPool = require("../config/database");
const { keysToCamelCase } = require("../utils/common");

class LeadsRepository {
  constructor() {
    this.pool = getPool();
  }

  async createLead(leadData) {
    const client = await this.pool.connect();
    try {
      const {
        company_id,
        builder_id,
        name,
        email,
        phone,
        notes,
        send_letter,
        lead_source_id,
        status,
        rating,
        land,
        finance,
        face_to_face,
        purpose,
        assignee_id,
        created_by,
        reference_number,
      } = leadData;

      const query = `
        INSERT INTO leads (
          company_id, builder_id, name, email, phone, 
          notes, send_letter, lead_source_id, status, rating, land, finance, 
          face_to_face, purpose, assignee_id, created_by, updated_by, reference_number
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        ) RETURNING *
      `;

      const values = [
        company_id,
        builder_id,
        name,
        email,
        phone,
        notes,
        send_letter === true || send_letter === "true" ? true : false, // Ensure proper boolean
        lead_source_id,
        status,
        rating,
        land,
        finance,
        face_to_face,
        purpose,
        assignee_id,
        created_by,
        created_by,
        reference_number,
      ];

      const result = await client.query(query, values);
      const lead = result.rows[0];

      // Fetch mapped contacts
      const contactsResult = await client.query(
        `SELECT lcm.id, lcm.contact_id, u.name, u.email, u.phone
         FROM leads_contact_map lcm
         JOIN users u ON lcm.contact_id = u.users_id
         WHERE lcm.leads_id = $1`,
        [lead.leads_id]
      );

      return {
        ...keysToCamelCase(lead),
        leadContacts: keysToCamelCase(contactsResult.rows),
      };
    } finally {
      client.release();
    }
  }

  async checkDuplicateName(name, builderId, createdBy, excludeLeadId = null) {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT * 
        FROM leads 
        WHERE builder_id = $1 AND created_by = $2 AND LOWER(name) = LOWER($3)
      `;
      const values = [builderId, createdBy, name];

      if (excludeLeadId) {
        query += ` AND leads_id != $4`;
        values.push(excludeLeadId);
      }

      query += ` LIMIT 1`;

      console.log("Checking duplicate with name:", name, "builderId:", builderId, "createdBy:", createdBy);
      
      const result = await client.query(query, values);
      console.log("Duplicate check result:", result.rowCount);
      return result.rowCount > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getAllLeads(builderId, companyId, filters = {}) {
    const client = await this.pool.connect();
    try {
      const {
        page = 1,
        limit = 25,
        status,
        outcome,
        rating,
        lead_source_id,
        client_type_id,
        region_id,
        assignee_id,
        search,
        email, // Add email filter
      } = filters;

      const offset = (page - 1) * limit;
      let whereConditions = ["(l.builder_id = $1 OR (l.company_id = $2 AND $2 IS NOT NULL))"];
      let queryParams = [builderId, companyId];
      let paramIndex = 3;

      if (status) {
        whereConditions.push(`l.status = $${paramIndex++}`);
        queryParams.push(status);
      }

      if (outcome) {
        whereConditions.push(`l.outcome = $${paramIndex++}`);
        queryParams.push(outcome);
      }

      if (rating) {
        whereConditions.push(`l.rating = $${paramIndex++}`);
        queryParams.push(rating);
      }

      if (lead_source_id) {
        whereConditions.push(`l.lead_source_id = $${paramIndex++}`);
        queryParams.push(lead_source_id);
      }

      if (client_type_id) {
        whereConditions.push(`l.client_type_id = $${paramIndex++}`);
        queryParams.push(client_type_id);
      }

      if (region_id) {
        whereConditions.push(`l.region_id = $${paramIndex++}`);
        queryParams.push(region_id);
      }

      if (assignee_id) {
        whereConditions.push(`l.assignee_id = $${paramIndex++}`);
        queryParams.push(assignee_id);
      }

      if (search) {
        whereConditions.push(`(
          l.name ILIKE $${paramIndex++} OR 
          l.email ILIKE $${paramIndex++} OR 
          l.phone ILIKE $${paramIndex++} OR 
          l.reference_number ILIKE $${paramIndex++}
        )`);
        queryParams.push(
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
        );
      }

      if (email) {
        whereConditions.push(`l.email = $${paramIndex++}`);
        queryParams.push(email);
      }

      const whereClause = whereConditions.join(" AND ");

      const dataQuery = `
        SELECT 
          l.*,
          ls.name as lead_source_name,
          ct.client_type as client_type_name,
          s.name as state_name,
          assignee.name as assignee_name,
          created_by_user.name as created_by_name,
          updated_by_user.name as updated_by_name,
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
            WHERE lcm.leads_id = l.leads_id
          ) as lead_contacts
        FROM leads l
        LEFT JOIN lead_source ls ON l.lead_source_id = ls.lead_source_id
        LEFT JOIN client_type ct ON l.client_type_id = ct.client_type_id
        LEFT JOIN state s ON l.region_id = s.state_id
        LEFT JOIN users assignee ON l.assignee_id = assignee.users_id
        LEFT JOIN users created_by_user ON l.created_by = created_by_user.users_id
        LEFT JOIN users updated_by_user ON l.updated_by = updated_by_user.users_id
        WHERE ${whereClause}
        ORDER BY l.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      queryParams.push(limit, offset);

      const countQuery = `
        SELECT COUNT(*) as total
        FROM leads l
        WHERE ${whereClause}
      `;

      const [dataResult, countResult] = await Promise.all([
        client.query(dataQuery, queryParams),
        client.query(countQuery, queryParams.slice(0, -2)), // Remove limit and offset for count
      ]);

      return {
        leads: keysToCamelCase(dataResult.rows),
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit),
        },
      };
    } finally {
      client.release();
    }
  }

  async getLeadById(leadId, builderId, companyId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          l.*,
          ls.name as lead_source_name,
          ct.client_type as client_type_name,
          s.name as state_name,
          assignee.name as assignee_name,
          created_by_user.name as created_by_name,
          updated_by_user.name as updated_by_name,

          -- Contacts from leads_contact_map
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', lcm.id,
              'contact_id', lcm.contact_id,
              'name', cu.name,
              'email', cu.email,
              'phone', cu.phone
            )), '[]'::json)
            FROM leads_contact_map lcm
            JOIN users cu ON lcm.contact_id = cu.users_id
            WHERE lcm.leads_id = l.leads_id
          ) as lead_contacts,

          -- Lot details
          (
            SELECT json_build_object(
              'lot_id', lot.lot_id,
              'lot_number', lot.lot_number,
              'street', lot.street,
              'city', lot.city,
              'zip_code', lot.zip_code,
              'title_status', lot.title_status,
              'title_date', lot.title_date,
              'lot_type', lot.lot_type,
              'corner_block', lot.corner_block,
              'width_m', lot.width_m,
              'depth_m', lot.depth_m,
              'price', lot.price,
              'total_size_m2', lot.total_size_m2,
              'estate_id', lot.estate_id,
              'estate_name', (SELECT e.name FROM estate e WHERE e.estate_id = lot.estate_id LIMIT 1),
              'estate_stage_id', lot.estate_stage_id,
              'estate_stage_name', (SELECT es.name FROM estate_stages es WHERE es.estate_stage_id = lot.estate_stage_id LIMIT 1)
            )
            FROM lot WHERE lot.lot_id = l.lot_id LIMIT 1
          ) as lot_details,

          -- House land package details
          (
            SELECT json_build_object(
              'house_land_package_id', hlp.house_land_package_id,
              'title', hlp.title,
              'lot_id', hlp.lot_id,
              'facade_id', hlp.facade_id,
              'floor_plan_id', hlp.floor_plan_id,
              'attach_files', hlp.attach_files
            )
            FROM house_land_package hlp WHERE hlp.house_land_package_id = l.house_land_package_id LIMIT 1
          ) as house_land_package_details,

          -- Properties
          (
            SELECT COALESCE(json_agg(json_build_object(
              'property_id', p.property_id,
              'lot_no', p.lot_no,
              'street_no', p.street_no,
              'estate_name', p.estate_name,
              'title_status', p.title_status,
              'title_date', p.title_date,
              'width_m', p.width_m,
              'depth_m', p.depth_m,
              'total_size_m2', p.total_size_m2
            )), '[]'::json)
            FROM property p WHERE p.leads_id = l.leads_id
          ) as properties,

          -- Quotations with versions
          (
            SELECT COALESCE(json_agg(json_build_object(
              'quotation_id', q.quotation_id,
              'reference_number', q.reference_number,
              'created_at', q.created_at,
              'versions', (
                SELECT COALESCE(json_agg(json_build_object(
                  'quotation_version_id', qv.quotation_version_id,
                  'quotation_version_no', qv.quotation_version_no,
                  'location_id', qv.location_id,
                  'range_id', qv.range_id,
                  'dwelling_type_id', qv.dwelling_type_id,
                  'floor_plan_id', qv.floor_plan_id,
                  'facade_id', qv.facade_id,
                  'is_approve', qv.is_approve,
                  'sketch_number', qv.sketch_number,
                  'package_maps', (
                    SELECT COALESCE(json_agg(json_build_object(
                      'id', qpm.id,
                      'package_id', qpm.package_id,
                      'package_name', (SELECT pk.name FROM package pk WHERE pk.package_id = qpm.package_id LIMIT 1)
                    )), '[]'::json)
                    FROM quotation_version_package_map qpm WHERE qpm.quotation_version_id = qv.quotation_version_id
                  ),
                  'pricelist_item_maps', (
                    SELECT COALESCE(json_agg(json_build_object(
                      'id', qpim.id,
                      'price_list_item_id', qpim.price_list_item_id,
                      'item_name', (SELECT pli.item_description FROM price_list_item pli WHERE pli.price_list_item_id = qpim.price_list_item_id LIMIT 1),
                      'quantity', qpim.quantity,
                      'note', qpim.note,
                      'total_price', qpim.total_price
                    )), '[]'::json)
                    FROM quotation_version_pricelist_item_map qpim WHERE qpim.quotation_version_id = qv.quotation_version_id
                  ),
                  'custom_sections', (
                    SELECT COALESCE(json_agg(json_build_object(
                      'custom_section_id', qcs.custom_section_id,
                      'file_url', qcs.file_url,
                      'sort_order', qcs.sort_order
                    ) ORDER BY qcs.sort_order ASC), '[]'::json)
                    FROM quotation_version_custom_section qcs WHERE qcs.quotation_version_id = qv.quotation_version_id
                  )
                ) ORDER BY qv.quotation_version_no DESC), '[]'::json)
                FROM quotation_version qv WHERE qv.quotation_id = q.quotation_id
              )
            ) ORDER BY q.created_at DESC), '[]'::json)
            FROM quotation q WHERE q.leads_id = l.leads_id
          ) as quotations,

          -- Business contacts
          (
            SELECT COALESCE(json_agg(json_build_object(
              'business_contact_id', bc.business_contact_id,
              'contact_type', bc.contact_type,
              'name', bc.name,
              'email', bc.email,
              'phone', bc.phone,
              'address1', bc.address1,
              'city', bc.city
            )), '[]'::json)
            FROM business_contact bc WHERE bc.leads_id = l.leads_id
          ) as business_contacts,

          -- Invoices
          (
            SELECT COALESCE(json_agg(json_build_object(
              'invoice_id', inv.invoice_id,
              'reference_number', inv.reference_number,
              'invoice_date', inv.invoice_date,
              'due_date', inv.due_date,
              'invoice_amount', inv.invoice_amount,
              'status', inv.status
            ) ORDER BY inv.created_at DESC), '[]'::json)
            FROM invoice inv WHERE inv.leads_id = l.leads_id
          ) as invoices

        FROM leads l
        LEFT JOIN lead_source ls ON l.lead_source_id = ls.lead_source_id
        LEFT JOIN client_type ct ON l.client_type_id = ct.client_type_id
        LEFT JOIN state s ON l.region_id = s.state_id
        LEFT JOIN users assignee ON l.assignee_id = assignee.users_id
        LEFT JOIN users created_by_user ON l.created_by = created_by_user.users_id
        LEFT JOIN users updated_by_user ON l.updated_by = updated_by_user.users_id
        WHERE l.leads_id = $1 AND (l.builder_id = $2 OR (l.company_id = $3 AND $3 IS NOT NULL))
      `;

      const result = await client.query(query, [leadId, builderId, companyId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async updateLead(leadId, leadData, builderId) {
    const client = await this.pool.connect();
    try {
      const {
        name,
        email,
        phone,
        notes,
        send_letter,
        lead_source_id,
        status,
        outcome,
        rating,
        land,
        finance,
        face_to_face,
        purpose,
        client_type_id,
        forcast_close,
        build_budget,
        region_id,
        prelim_agreement,
        client_profile,
        h_l_budget,
        assignee_id,
        updated_by,
        house_land_package_id,
        opportunity_notes,
      } = leadData;

      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(name);
      }

      if (email !== undefined) {
        updateFields.push(`email = $${paramIndex++}`);
        values.push(email);
      }

      if (phone !== undefined) {
        updateFields.push(`phone = $${paramIndex++}`);
        values.push(phone);
      }

      if (notes !== undefined) {
        updateFields.push(`notes = $${paramIndex++}`);
        values.push(notes);
      }

      if (send_letter !== undefined) {
        updateFields.push(`send_letter = $${paramIndex++}`);
        values.push(send_letter);
      }

      if (lead_source_id !== undefined) {
        updateFields.push(`lead_source_id = $${paramIndex++}`);
        values.push(lead_source_id);
      }

      if (status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      if (outcome !== undefined) {
        updateFields.push(`outcome = $${paramIndex++}`);
        values.push(outcome);
      }

      if (rating !== undefined) {
        updateFields.push(`rating = $${paramIndex++}`);
        values.push(rating);
      }

      if (land !== undefined) {
        updateFields.push(`land = $${paramIndex++}`);
        values.push(land);
      }

      if (finance !== undefined) {
        updateFields.push(`finance = $${paramIndex++}`);
        values.push(finance);
      }

      if (face_to_face !== undefined) {
        updateFields.push(`face_to_face = $${paramIndex++}`);
        values.push(face_to_face);
      }

      if (purpose !== undefined) {
        updateFields.push(`purpose = $${paramIndex++}`);
        values.push(purpose);
      }

      if (client_type_id !== undefined) {
        updateFields.push(`client_type_id = $${paramIndex++}`);
        values.push(client_type_id);
      }

      if (forcast_close !== undefined) {
        updateFields.push(`forcast_close = $${paramIndex++}`);
        values.push(forcast_close);
      }

      if (build_budget !== undefined) {
        updateFields.push(`build_budget = $${paramIndex++}`);
        values.push(build_budget);
      }

      if (region_id !== undefined) {
        updateFields.push(`region_id = $${paramIndex++}`);
        values.push(region_id);
      }

      if (prelim_agreement !== undefined) {
        updateFields.push(`prelim_agreement = $${paramIndex++}`);
        values.push(prelim_agreement);
      }

      if (client_profile !== undefined) {
        updateFields.push(`client_profile = $${paramIndex++}`);
        values.push(client_profile);
      }

      if (h_l_budget !== undefined) {
        updateFields.push(`h_l_budget = $${paramIndex++}`);
        values.push(h_l_budget);
      }

      if (assignee_id !== undefined) {
        updateFields.push(`assignee_id = $${paramIndex++}`);
        values.push(assignee_id);
      }

      if (house_land_package_id !== undefined) {
        updateFields.push(`house_land_package_id = $${paramIndex++}`);
        values.push(house_land_package_id);
      }

      if (opportunity_notes !== undefined) {
        updateFields.push(`opportunity_notes = $${paramIndex++}`);
        values.push(opportunity_notes);
      }

      if (updateFields.length === 0) {
        throw new Error("No fields provided for update");
      }

      updateFields.push(`updated_by = $${paramIndex++}`);
      updateFields.push(`updated_at = NOW()`);
      values.push(updated_by);

      values.push(leadId, builderId);

      const query = `
        UPDATE leads 
        SET ${updateFields.join(", ")}
        WHERE leads_id = $${paramIndex++} AND (builder_id = $${paramIndex++} OR company_id IS NOT NULL)
        RETURNING *
      `;

      const result = await client.query(query, values);
      return keysToCamelCase(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async deleteLead(leadId, builderId, companyId) {
    const client = await this.pool.connect();
    try {
      const query = `
        DELETE FROM leads 
        WHERE leads_id = $1 AND (builder_id = $2 OR (company_id = $3 AND $3 IS NOT NULL))
        RETURNING *
      `;

      const result = await client.query(query, [leadId, builderId, companyId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getLeadStats(builderId, companyId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN status = 'New' THEN 1 END) as new_leads,
          COUNT(CASE WHEN status = 'Working' THEN 1 END) as working_leads,
          COUNT(CASE WHEN status = 'Qualified' THEN 1 END) as qualified_leads,
          COUNT(CASE WHEN outcome = 'Won' THEN 1 END) as won_leads,
          COUNT(CASE WHEN outcome = 'Lost' THEN 1 END) as lost_leads,
          COUNT(CASE WHEN rating = 'Hot' THEN 1 END) as hot_leads,
          COUNT(CASE WHEN rating = 'Warm' THEN 1 END) as warm_leads,
          COUNT(CASE WHEN rating = 'Cold' THEN 1 END) as cold_leads
        FROM leads 
        WHERE builder_id = $1 OR (company_id = $2 AND $2 IS NOT NULL)
      `;

      const result = await client.query(query, [builderId, companyId]);
      return keysToCamelCase(result.rows[0]);
    } finally {
      client.release();
    }
  }
}

module.exports = new LeadsRepository();
