import getPool from "../../config/database.js";
import { keysToCamelCase } from "../../utils/common.js";

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
        house_land_package_id,
        property_detail_id,
      } = leadData;

      await client.query("BEGIN");

      // 1. Insert lead
      const leadQuery = `
        INSERT INTO leads (
          company_id, builder_id, name, email, phone, 
          notes, send_letter, lead_source_id, status, rating, land, finance, 
          face_to_face, purpose, assignee_id, created_by, updated_by, reference_number,
          house_land_package_id, property_detail_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()
        ) RETURNING *
      `;

      const leadValues = [
        company_id,
        builder_id,
        name,
        email,
        phone,
        notes,
        send_letter === true || send_letter === "true" ? true : false,
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
        house_land_package_id,
        property_detail_id,
      ];

      const leadResult = await client.query(leadQuery, leadValues);
      const lead = leadResult.rows[0];

      // 2. Auto-create/find contact
      // Check if a user with this email already exists for this builder
      const contactCheckQuery = `
        SELECT users_id FROM users 
        WHERE email = $1 AND builder_id = $2 AND is_deleted = false 
        LIMIT 1
      `;
      const contactCheckResult = await client.query(contactCheckQuery, [email, builder_id]);

      let contactId;
      if (contactCheckResult.rowCount === 0) {
        // Find role_id for "Contact"
        const roleResult = await client.query(
          "SELECT role_id FROM role WHERE name = 'Contact' LIMIT 1"
        );
        
        if (roleResult.rowCount === 0) {
          throw new Error("Contact role not found in database");
        }
        
        const roleId = roleResult.rows[0].role_id;

        // Create new contact
        const contactInsertQuery = `
          INSERT INTO users (
            builder_id, name, email, phone, role_id, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
          RETURNING users_id
        `;
        const contactInsertResult = await client.query(contactInsertQuery, [
          builder_id, name, email, phone, roleId
        ]);
        contactId = contactInsertResult.rows[0].users_id;
      } else {
        contactId = contactCheckResult.rows[0].users_id;
      }

      // 3. Map lead to contact
      // Check if mapping already exists (unlikely for new lead, but safe for force-create)
      const mapCheckResult = await client.query(
        "SELECT id FROM leads_contact_map WHERE leads_id = $1 AND contact_id = $2",
        [lead.leads_id, contactId]
      );

      if (mapCheckResult.rowCount === 0) {
        await client.query(
          "INSERT INTO leads_contact_map (leads_id, contact_id) VALUES ($1, $2)",
          [lead.leads_id, contactId]
        );
      }

      await client.query("COMMIT");

      // 4. Fetch mapped contacts for response
      const contactsResult = await client.query(
        `SELECT lcm.id, lcm.contact_id as users_id, u.name, u.email, u.phone,
                jsonb_build_object(
                  'address_line1', a.address_line1,
                  'address_line2', a.address_line2,
                  'city', a.city,
                  'zip_code', a.zip_code,
                  'country_id', a.country_id,
                  'state_id', a.state_id
                ) AS address
         FROM leads_contact_map lcm
         JOIN users u ON lcm.contact_id = u.users_id
         LEFT JOIN address a ON u.address_id = a.address_id
         WHERE lcm.leads_id = $1`,
        [lead.leads_id],
      );

      let leadSourceName = null;
      if (lead_source_id) {
        const sourceResult = await client.query(
          "SELECT name FROM lead_source WHERE lead_source_id = $1",
          [lead_source_id]
        );
        if (sourceResult.rowCount > 0) {
          leadSourceName = sourceResult.rows[0].name;
        }
      }

      return {
        ...keysToCamelCase(lead),
        leadSourceName: leadSourceName,
        leadContacts: keysToCamelCase(contactsResult.rows),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
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
        query += " AND leads_id != $4";
        values.push(excludeLeadId);
      }

      query += ` LIMIT 1`;
      
      const result = await client.query(query, values);
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
        rating,
        lead_source_id,
        client_type_id,
        region_id,
        assignee_id,
        search,
        email, 
        created_at, 
        sort_by = "created_at",
        sort_order = "desc",
      } = filters;

      const offset = (page - 1) * limit;
      const whereConditions = ["(l.builder_id = $1 OR (l.company_id = $2 AND $2 IS NOT NULL))"];
      const queryParams = [builderId, companyId];
      let paramIndex = 3;

      if (created_at) {
        let dateFilter;
        let dateFilterEnd;
        const now = new Date();

        switch (created_at.toLowerCase()) {
          case "last_15_minutes":
            dateFilter = new Date(now.getTime() - 15 * 60 * 1000);
            break;
          case "last_1_hour":
            dateFilter = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case "last_2_hours":
            dateFilter = new Date(now.getTime() - 2 * 60 * 60 * 1000);
            break;
          case "last_24_hours":
            dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "today":
            dateFilter = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "yesterday":
            dateFilter = new Date(new Date().setHours(0, 0, 0, 0) - 24 * 60 * 60 * 1000);
            dateFilterEnd = new Date(new Date().setHours(0, 0, 0, 0));
            break;
          case "last_7_days":
            dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "last_15_days":
            dateFilter = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
            break;
          case "last_30_days":
            dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }

        if (dateFilter && dateFilterEnd) {
          whereConditions.push(
            `l.created_at >= $${paramIndex++} AND l.created_at < $${paramIndex++}`,
          );
          queryParams.push(dateFilter.toISOString(), dateFilterEnd.toISOString());
        } else if (dateFilter) {
          whereConditions.push(`l.created_at >= $${paramIndex++}`);
          queryParams.push(dateFilter.toISOString());
        }
      }

      if (status) {
        whereConditions.push(`(l.status = $${paramIndex} OR EXISTS (SELECT 1 FROM opportunity o WHERE o.leads_id = l.leads_id AND o.status = $${paramIndex}))`);
        queryParams.push(status);
        paramIndex++;
      }

      if (rating?.length) {
        whereConditions.push(`l.rating = ANY($${paramIndex++})`);
        queryParams.push(rating);
      }

      if (lead_source_id?.length) {
        whereConditions.push(`l.lead_source_id = ANY($${paramIndex++}::uuid[])`);
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

      if (assignee_id?.length) {
        whereConditions.push(`l.assignee_id = ANY($${paramIndex++}::uuid[])`);
        queryParams.push(assignee_id);
      }

      if (search) {
        whereConditions.push(`(
          l.name ILIKE $${paramIndex++} OR 
          l.email ILIKE $${paramIndex++} OR 
          l.phone ILIKE $${paramIndex++}
        )`);
        queryParams.push(
          `%${search}%`,
          `%${search}%`,
          `%${search}%`
        );
      }

      if (email) {
        whereConditions.push(`l.email = $${paramIndex++}`);
        queryParams.push(email);
      }

      const whereClause = whereConditions.join(" AND ");
      const allowedSortColumns = {
        created_at: "l.created_at",
      };
      const normalizedSortOrder =
        String(sort_order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
      const orderByColumn = allowedSortColumns[sort_by] || "l.created_at";

      const dataQuery = `
        SELECT 
          l.*,
          ls.name as lead_source_name,
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
          ) as property_details,
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
          ) as lead_contacts,
          (SELECT status FROM opportunity WHERE leads_id = l.leads_id LIMIT 1) as opportunity_status
        FROM leads l
        LEFT JOIN lead_source ls ON l.lead_source_id = ls.lead_source_id
        LEFT JOIN property_detail pd ON l.property_detail_id = pd.property_detail_id
        LEFT JOIN client_type ct ON l.client_type_id = ct.client_type_id
        LEFT JOIN state st ON pd.state_id = st.state_id
        LEFT JOIN state s ON l.region_id = s.state_id
        LEFT JOIN users assignee ON l.assignee_id = assignee.users_id
        LEFT JOIN users created_by_user ON l.created_by = created_by_user.users_id
        LEFT JOIN users updated_by_user ON l.updated_by = updated_by_user.users_id
        WHERE ${whereClause}
        ORDER BY ${orderByColumn} ${normalizedSortOrder} NULLS LAST, l.updated_at DESC NULLS LAST, l.reference_number DESC
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
          s.name as region_name,
          hlp_main.title as house_land_package_name,
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

          -- Lot details (via property_detail)
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
              'site_fall_mm', lot.site_fall_mm,
              'land_fill_mm', lot.land_fill_mm,
              'state_id', lot.state_id,
              'state_name', (SELECT s.name FROM state s WHERE s.state_id = lot.state_id LIMIT 1),
              'estate_id', lot.estate_id,
              'estate_name', (SELECT e.name FROM estate e WHERE e.estate_id = lot.estate_id LIMIT 1),
              'estate_stage_id', lot.estate_stage_id,
              'estate_stage_name', (SELECT es.name FROM estate_stages es WHERE es.estate_stage_id = lot.estate_stage_id LIMIT 1)
            )
            FROM lot
            JOIN property_detail pd ON pd.lot_id = lot.lot_id
            WHERE pd.property_detail_id = l.property_detail_id LIMIT 1
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
                  'total_package_cost', COALESCE(
                    (SELECT package_cost 
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
                      (SELECT package_cost 
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
                  ),
                  'package', (
                    SELECT json_build_object(
                      'package_id', p.package_id,
                      'package_name', p.name
                    )
                    FROM package p WHERE p.package_id = qv.package_id LIMIT 1
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
          ) as invoices,
          (SELECT status FROM opportunity WHERE leads_id = l.leads_id LIMIT 1) as opportunity_status,
          (SELECT opportunity_id FROM opportunity WHERE leads_id = l.leads_id LIMIT 1) as opportunity_id

        FROM leads l
        LEFT JOIN lead_source ls ON l.lead_source_id = ls.lead_source_id
        LEFT JOIN client_type ct ON l.client_type_id = ct.client_type_id
        LEFT JOIN state s ON l.region_id = s.state_id
        LEFT JOIN house_land_package hlp_main ON l.house_land_package_id = hlp_main.house_land_package_id
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
        assignee_note,
        updated_by,
        house_land_package_id,
        structure_engineer_id,
        structure_report_file,
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
      
      if (assignee_note !== undefined) {
        updateFields.push(`assignee_note = $${paramIndex++}`);
        values.push(assignee_note);
      }

      if (house_land_package_id !== undefined) {
        updateFields.push(`house_land_package_id = $${paramIndex++}`);
        values.push(house_land_package_id);
      }

      if (structure_engineer_id !== undefined) {
        updateFields.push(`structure_engineer_id = $${paramIndex++}`);
        values.push(structure_engineer_id);
      }

      if (structure_report_file !== undefined) {
        updateFields.push(`structure_report_file = $${paramIndex++}`);
        values.push(structure_report_file);
      }

      if (updateFields.length === 0) {
        throw new Error("No fields provided for update");
      }

      updateFields.push(`updated_by = $${paramIndex++}`);
      updateFields.push("updated_at = NOW()");
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

  async convertLeadToOpportunity(leadId, opportunityNotes, builderId, companyId, status = 'Negotiation', client = null) {
    let ownClient = false;
    if (!client) {
      client = await this.pool.connect();
      ownClient = true;
      await client.query("BEGIN");
    }
    try {
      // 1. Verify existence and ownership
      const leadQuery = "SELECT * FROM leads WHERE leads_id = $1 AND (builder_id = $2 OR (company_id = $3 AND $3 IS NOT NULL)) FOR UPDATE";
      const leadResult = await client.query(leadQuery, [leadId, builderId, companyId]);

      if (leadResult.rowCount === 0) {
        throw new Error("Lead not found or unauthorized");
      }

      const lead = leadResult.rows[0];

      // If already converted, update status and return existing opportunity
      if (lead.status === "Convert") {
        const updateOppStatusQuery = "UPDATE opportunity SET status = $1 WHERE leads_id = $2 RETURNING *";
        const oppResult = await client.query(updateOppStatusQuery, [status, leadId]);
        return keysToCamelCase(oppResult.rows[0]);
      }

      if (!lead.property_detail_id) {
        throw new Error("Lead must have a property detail before converting to an opportunity");
      }

      // 2. Insert into opportunity table
      const oppQuery = `
        INSERT INTO opportunity (leads_id, opportunity_notes, status)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const oppResult = await client.query(oppQuery, [leadId, opportunityNotes || null, status]);

      // 3. Update lead status to Convert
      const updateLeadQuery = `
        UPDATE leads 
        SET status = 'Convert', updated_at = NOW()
        WHERE leads_id = $1
      `;
      await client.query(updateLeadQuery, [leadId]);

      if (ownClient) {
        await client.query("COMMIT");
      }

      return keysToCamelCase(oppResult.rows[0]);
    } catch (error) {
      if (ownClient) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      if (ownClient) {
        client.release();
      }
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
          0 as won_leads,
          0 as lost_leads,
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
  async removeHLPData(leadsId, removeExtras, builderId, companyId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Get current lead data to find property_detail_id
      const leadQuery = `SELECT property_detail_id FROM leads WHERE leads_id = $1 AND builder_id = $2`;
      const leadRes = await client.query(leadQuery, [leadsId, builderId]);
      
      if (leadRes.rowCount === 0) {
        throw new Error("Lead not found");
      }

      const { property_detail_id } = leadRes.rows[0];

      // 2. Clear house_land_package_id
      await client.query(
        `UPDATE leads SET house_land_package_id = NULL, updated_at = NOW() WHERE leads_id = $1`,
        [leadsId]
      );

      if (removeExtras) {
        // 3. Handle Property Detail removal
        if (property_detail_id) {
          const pdQuery = `SELECT is_hl_package_lot FROM property_detail WHERE property_detail_id = $1`;
          const pdRes = await client.query(pdQuery, [property_detail_id]);
          
          if (pdRes.rowCount > 0 && pdRes.rows[0].is_hl_package_lot === true) {
            // Detach from lead first
            await client.query(
              `UPDATE leads SET property_detail_id = NULL WHERE leads_id = $1`,
              [leadsId]
            );
            // Delete the auto-created lot
            await client.query(
              `DELETE FROM property_detail WHERE property_detail_id = $1`,
              [property_detail_id]
            );
          }
        }

        // 4. Delete auto-created quotations
        await client.query(
          `DELETE FROM quotation WHERE leads_id = $1 AND is_hl_package_quotation = TRUE`,
          [leadsId]
        );
      }

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}


export default new LeadsRepository(); 
