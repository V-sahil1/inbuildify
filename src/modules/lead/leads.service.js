import leadsRepository from "./leads.repository.js";
import quotationService from "../quotation/quotation.service.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { generateDynamicReferenceNumber, keysToCamelCase, formatCamelCaseToReadable } from "../../utils/common.js";
import getPool from "../../config/database.js";

class LeadsService {
  async createLead(
    leadData,
    userId,
    builderId,
    companyId,
    forceCreate = false,
  ) {
    try {
      // Fetch sales module settings to check mandatory fields
      const settingsQueryResult = await getPool().query(
        `SELECT lead_mandatory_option FROM sales_module_settings 
         WHERE builder_id = $1 AND company_id = $2 
         LIMIT 1`,
        [builderId, companyId]
      );
      
      const leadMandatoryOption = settingsQueryResult.rows[0]?.lead_mandatory_option || "email_and_phone";

      if (!leadData.name) {
        throw new Error("Name is required");
      }

      const emailProvided = !!(leadData.email && leadData.email.trim());
      const phoneProvided = !!(leadData.phone && leadData.phone.trim());

      switch (leadMandatoryOption) {
        case "email_and_phone":
          if (!emailProvided || !phoneProvided) {
            throw new Error("Email and Phone are required");
          }
          break;
        case "either_email_or_phone":
          if (!emailProvided && !phoneProvided) {
            throw new Error("Either Email or Phone must be provided");
          }
          break;
        case "email_not_mandatory":
          if (!phoneProvided) {
            throw new Error("Phone is required");
          }
          break;
        case "phone_not_mandatory":
          if (!emailProvided) {
            throw new Error("Email is required");
          }
          break;
        case "email_and_phone_not_mandatory":
          // Both are optional, no check needed
          break;
        default:
          // Default to both required if option is unknown
          if (!emailProvided || !phoneProvided) {
            throw new Error("Email and Phone are required");
          }
      }

      const existingLeads = await leadsRepository.getAllLeads(builderId, companyId, {
        email: leadData.email,
        limit: 1,
      });

      if (existingLeads.leads.length > 0) {
        // Fetch sales module settings to check if duplicates are allowed
        const settingsQueryResult = await getPool().query(
          `SELECT allow_duplicate_leads FROM sales_module_settings 
           WHERE builder_id = $1 AND company_id = $2 
           LIMIT 1`,
          [builderId, companyId]
        );
        
        const allowDuplicateLeads = settingsQueryResult.rows[0]?.allow_duplicate_leads || false;

        if (!allowDuplicateLeads) {
          return {
            success: false,
            message: "A lead with this email already exists. Duplicate leads are disabled in settings.",
          };
        }

        if (!forceCreate) {
          return {
            success: false,
            emailExists: true,
            message: "A lead with this email already exists",
            existingLead: existingLeads.leads[0],
          };
        }
      }

      // Validate leadSourceId if provided
      if (leadData.lead_source_id) {
        const leadSourceValidation = await this.validateLeadSource(
          leadData.lead_source_id,
          builderId,
          companyId,
        );

        if (!leadSourceValidation.valid) {
          return {
            success: false,
            message: leadSourceValidation.message,
          };
        }
      }

      const reference_number =
        leadData.reference_number ||
        (await generateDynamicReferenceNumber({
          prefix: "LD",
          tableName: "leads",
          column: "reference_number",
          user: { company_id: companyId, builder_id: builderId },
          client: getPool(),
        }));

      const leadDataWithDefaults = {
        ...leadData,
        reference_number,
        builder_id: builderId,
        company_id: companyId,
        created_by: userId,
        updated_by: userId,
        assignee_id: leadData.assignee_id || userId,
        status: leadData.status || "New",
        rating: leadData.rating || "None",
        land: leadData.land || "None",
        finance: leadData.finance || "None",
        face_to_face: leadData.face_to_face || "None",
        purpose: leadData.purpose || "None",
      };

      const lead = await leadsRepository.createLead(leadDataWithDefaults);

      // Auto-create property_detail and Quotation from HLP data
      if (leadData.house_land_package_id) {
        await this.syncPropertyDetailFromHLP(lead.leads_id, leadData.house_land_package_id);
        
        await quotationService.syncQuotationFromHLP(
          lead.leads_id, 
          leadData.house_land_package_id, 
          userId, 
          builderId, 
          companyId
        );
      }

      return {
        success: true,
        data: lead,
        message: "Lead created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getAllLeads(builderId, companyId, filters = {}) {
    try {
      const result = await leadsRepository.getAllLeads(builderId, companyId, filters);
      return {
        success: true,
        data: result,
        message: "Leads fetched successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getLeadById(leadId, builderId, companyId) {
    try {
      const lead = await leadsRepository.getLeadById(leadId, builderId, companyId);

      if (!lead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      return {
        success: true,
        data: lead,
        message: "Lead fetched successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateLead(leadId, leadData, userId, builderId, companyId) {
    try {
      const existingLead = await leadsRepository.getLeadById(leadId, builderId, companyId);
      if (!existingLead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      // Check if lead has any opportunity with outcome = 'lost'
      const pool = getPool();
      const lostOppResult = await pool.query(
        "SELECT 1 FROM opportunity WHERE leads_id = $1 AND outcome = 'lost' LIMIT 1",
        [leadId],
      );

      if (lostOppResult.rowCount > 0) {
        throw new Error("This lead cannot be updated because an associated opportunity has been marked as lost.");
      }

      if (leadData.email && leadData.email !== existingLead.email) {
        const existingLeads = await leadsRepository.getAllLeads(builderId, companyId, {
          email: leadData.email,
          limit: 1,
        });

        if (existingLeads.leads.length > 0) {
          throw new Error("A lead with this email already exists");
        }
      }

      if (leadData.region_id) {
        const regionValidation = await this.validateRegion(leadData.region_id);
        if (!regionValidation.valid) {
          return {
            success: false,
            message: regionValidation.message,
          };
        }
      }

      if (leadData.client_type_id) {
        const clientTypeValidation = await this.validateClientType(
          leadData.client_type_id,
          builderId,
          companyId,
        );
        if (!clientTypeValidation.valid) {
          return {
            success: false,
            message: clientTypeValidation.message,
          };
        }
      }

      if (leadData.house_land_package_id) {
        const hlpValidation = await this.validateHouseLandPackage(
          leadData.house_land_package_id,
          builderId,
          companyId,
        );
        if (!hlpValidation.valid) {
          return {
            success: false,
            message: hlpValidation.message,
          };
        }
      }

      // Auto-update status to 'Working' if current status is 'New'
      // and user is not explicitly updating the status in this request
      if (existingLead.status === "New" && !leadData.status) {
        leadData.status = "Working";
      }

      const leadDataWithUpdatedBy = {
        ...leadData,
        updated_by: userId,
      };

      await leadsRepository.updateLead(
        leadId,
        leadDataWithUpdatedBy,
        builderId,
      );

      // Auto-create property_detail from HLP lot data and Quotation
      if (leadData.house_land_package_id && leadData.house_land_package_id !== existingLead.houseLandPackageId) {
        await this.syncPropertyDetailFromHLP(leadId, leadData.house_land_package_id);
        
        // Auto-create Quotation from HLP data
        await quotationService.syncQuotationFromHLP(
          leadId, 
          leadData.house_land_package_id, 
          userId, 
          builderId, 
          companyId
        );
      }
      
      const fullyPopulatedLead = await leadsRepository.getLeadById(leadId, builderId, companyId);

      return {
        success: true,
        data: fullyPopulatedLead,
        message: "Lead updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async convertLeadToOpportunity(leadId, opportunityNotes, builderId, companyId) {
    try {
      const result = await leadsRepository.convertLeadToOpportunity(
        leadId,
        opportunityNotes,
        builderId,
        companyId,
      );

      return {
        success: true,
        data: result,
        message: "Lead converted to opportunity successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteLead(leadId, builderId, companyId) {
    try {
      const existingLead = await leadsRepository.getLeadById(leadId, builderId, companyId);
      if (!existingLead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      const deletedLead = await leadsRepository.deleteLead(leadId, builderId, companyId);
      return {
        success: true,
        data: deletedLead,
        message: "Lead deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getLeadStats(builderId, companyId) {
    try {
      const stats = await leadsRepository.getLeadStats(builderId, companyId);
      return {
        success: true,
        data: stats,
        message: "Lead statistics fetched successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateLeadStatus(leadId, status, userId, builderId, companyId) {
    try {
      const existingLead = await leadsRepository.getLeadById(leadId, builderId, companyId);
      if (!existingLead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      const updatedLead = await leadsRepository.updateLead(
        leadId,
        { status, updatedBy: userId },
        builderId,
      );
      return {
        success: true,
        data: updatedLead,
        message: "Lead status updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async assignLead(leadId, assigneeId, assigneeNote, userId, builderId) {
    try {
      const existingLead = await leadsRepository.getLeadById(leadId, builderId);
      if (!existingLead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      // Check if assignee is a valid user
      const userCheck = await getPool().query(
        "SELECT users_id, name FROM users WHERE users_id = $1 AND builder_id = $2 AND is_active = true AND is_deleted = false LIMIT 1",
        [assigneeId, builderId],
      );

      if (userCheck.rowCount === 0) {
        return {
          success: false,
          message:
            "Invalid assignee: User not found or does not belong to your organization",
        };
      }

      const updatedLead = await leadsRepository.updateLead(
        leadId,
        {
          assignee_id: assigneeId,
          assignee_note: assigneeNote,
          updated_by: userId,
        },
        builderId,
      );

      return {
        success: true,
        data: {
          ...updatedLead,
          assigneeName: userCheck.rows[0].name,
        },
        message: "Lead assigned successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async validateRegion(regionId) {
    try {
      const client = getPool();

      const query = `
        SELECT state_id, name 
        FROM state
        WHERE state_id = $1
      `;

      const result = await client.query(query, [regionId]);

      if (result.rowCount === 0) {
        return {
          valid: false,
          message: "Region not found",
        };
      }

      return {
        valid: true,
        message: "Region is valid",
      };
    } catch (error) {
      return {
        valid: false,
        message: "Error validating region",
      };
    }
  }

  async validateClientType(clientTypeId, builderId, companyId) {
    try {
      const client = getPool();

      const query = `
        SELECT client_type_id, client_type, is_active 
        FROM client_type
        WHERE client_type_id = $1
          AND (company_id = $2 OR company_id IS NULL)
          AND (builder_id = $3 OR builder_id IS NULL)
      `;

      const result = await client.query(query, [
        clientTypeId,
        companyId,
        builderId,
      ]);

      if (result.rowCount === 0) {
        return {
          valid: false,
          message: "Client type not found",
        };
      }

      const clientType = result.rows[0];

      if (!clientType.is_active) {
        return {
          valid: false,
          message: "Client type is not active",
        };
      }

      return {
        valid: true,
        message: "Client type is valid",
      };
    } catch (error) {
      console.error("DEBUG: Error in validateClientType:", error);
      return {
        valid: false,
        message: "Error validating client type",
      };
    }
  }

  async validateLeadSource(leadSourceId, builderId, companyId) {
    try {
      const client = getPool();

      const checkQuery = `
        SELECT lead_source_id, is_active 
        FROM lead_source
        WHERE lead_source_id = $1
          AND (company_id = $2 OR company_id IS NULL)
          AND (builder_id = $3 OR builder_id IS NULL)
      `;

      const checkResult = await client.query(checkQuery, [
        leadSourceId,
        companyId,
        builderId,
      ]);

      if (checkResult.rowCount === 0) {
        return {
          valid: false,
          message: "Lead source not found",
        };
      }

      const checkActiveQuery = `
        SELECT lead_source_id, is_active 
        FROM lead_source
        WHERE lead_source_id = $1
          AND (company_id = $2 OR company_id IS NULL)
          AND (builder_id = $3 OR builder_id IS NULL)
          AND is_active = true
      `;

      const checkActiveResult = await client.query(checkActiveQuery, [
        leadSourceId,
        companyId,
        builderId,
      ]);

      if (checkActiveResult.rowCount === 0) {
        return {
          valid: false,
          message: "Lead source is not active",
        };
      }

      return {
        valid: true,
        message: "Lead source is valid",
      };
    } catch (error) {
      return {
        valid: false,
        message: "Error validating lead source",
      };
    }
  }

  async validateContact(contactId, builderId, companyId) {
    try {
      const client = getPool();

      const query = `
        SELECT u.users_id, r.name as role_name 
        FROM users u
        JOIN role r ON u.role_id = r.role_id
        WHERE u.users_id = $1
          AND u.builder_id = $2
          AND u.is_active = true
      `;

      const result = await client.query(query, [
        contactId,
        builderId,
      ]);

      if (result.rowCount === 0) {
        return {
          valid: false,
          message: "Contact not found or does not belong to this organization",
        };
      }

      if (result.rows[0].role_name !== "Contact") {
        return {
          valid: false,
          message: "The provided user is not a Contact",
        };
      }

      return {
        valid: true,
        message: "Contact is valid",
      };
    } catch (error) {
      return {
        valid: false,
        message: "Error validating contact",
      };
    }
  }

  async validateHouseLandPackage(houseLandPackageId, builderId, companyId) {
    try {
      const client = getPool();

      const query = `
        SELECT house_land_package_id 
        FROM house_land_package
        WHERE house_land_package_id = $1
          AND (company_id = $2 OR company_id IS NULL)
          AND (builder_id = $3 OR builder_id IS NULL)
      `;

      const result = await client.query(query, [
        houseLandPackageId,
        companyId,
        builderId,
      ]);

      if (result.rowCount === 0) {
        return {
          valid: false,
          message: "House Land Package not found or does not belong to this organization",
        };
      }

      return {
        valid: true,
        message: "House Land Package is valid",
      };
    } catch (error) {
      return {
        valid: false,
        message: "Error validating House Land Package",
      };
    }
  }

  async removeHLPackage(leadId, options, builderId, companyId) {
    try {
      const { remove_hl_package_lot_quotation } = options;
      await leadsRepository.removeHLPData(
        leadId,
        remove_hl_package_lot_quotation,
        builderId,
        companyId
      );

      return {
        success: true,
        message: "House Land Package removed successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async syncPropertyDetailFromHLP(leadId, houseLandPackageId) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Fetch HLP to get lot_id
      const hlpResult = await client.query(
        `SELECT lot_id FROM house_land_package WHERE house_land_package_id = $1`,
        [houseLandPackageId]
      );

      if (hlpResult.rowCount === 0 || !hlpResult.rows[0].lot_id) {
        // HLP has no lot_id, nothing to sync
        await client.query("COMMIT");
        return;
      }

      const lotId = hlpResult.rows[0].lot_id;

      // 2. Fetch lot data with estate name
      const lotResult = await client.query(
        `SELECT 
          l.*,
          e.name AS estate_name_lookup
        FROM lot l
        LEFT JOIN estate e ON e.estate_id = l.estate_id
        WHERE l.lot_id = $1`,
        [lotId]
      );

      if (lotResult.rowCount === 0) {
        await client.query("COMMIT");
        return;
      }

      const lot = lotResult.rows[0];

      // 3. Check if lead already has a property_detail → delete old record
      const leadResult = await client.query(
        `SELECT property_detail_id FROM leads WHERE leads_id = $1`,
        [leadId]
      );

      if (leadResult.rows[0]?.property_detail_id) {
        const oldPropertyDetailId = leadResult.rows[0].property_detail_id;

        // Unlink from lead first
        await client.query(
          `UPDATE leads SET property_detail_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE leads_id = $1`,
          [leadId]
        );

        // Delete old property_detail
        await client.query(
          `DELETE FROM property_detail WHERE property_detail_id = $1`,
          [oldPropertyDetailId]
        );
      }

      // 4. Insert new property_detail from lot data
      const insertResult = await client.query(
        `INSERT INTO property_detail (
          lot_id, lot_number, street, city, state_id, zip_code,
          estate_id, estate_stage_id, estate_name,
          title_status, title_date, land_type,
          corner_block, width_m, depth_m, total_size_m2,
          price, site_fall_mm, land_fill_mm,
          is_hl_package_lot,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19,
          true,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING property_detail_id`,
        [
          lotId,
          lot.lot_number,
          lot.street,
          lot.city,
          lot.state_id,
          lot.zip_code,
          lot.estate_id,
          lot.estate_stage_id,
          lot.estate_name_lookup || null,
          lot.title_status,
          lot.title_date,
          lot.lot_type || "REGULAR",
          lot.corner_block,
          lot.width_m,
          lot.depth_m,
          lot.total_size_m2,
          lot.price,
          lot.site_fall_mm,
          lot.land_fill_mm,
        ]
      );

      const newPropertyDetailId = insertResult.rows[0].property_detail_id;

      // 5. Link new property_detail to lead
      await client.query(
        `UPDATE leads SET property_detail_id = $1, updated_at = CURRENT_TIMESTAMP WHERE leads_id = $2`,
        [newPropertyDetailId, leadId]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error syncing property_detail from HLP lot:", error);
      throw error;
    } finally {
      client.release();
    }
  }
  async getAllLeadActions(leadId, builderId, companyId) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      // 1. Verify lead existence and ownership
      const leadCheck = await client.query(
        "SELECT leads_id FROM leads WHERE leads_id = $1 AND (builder_id = $2 OR company_id = $3)",
        [leadId, builderId, companyId],
      );

      if (leadCheck.rowCount === 0) {
        return { success: false, message: "Lead not found or access denied" };
      }

      // 2. Fetch Notes
      const notesQuery = `
        SELECT 
          n.notes_id, n.leads_id, n.description, n.send_to_customer, 
          n.create_follow_up_task, n.task_id, n.attach_file, n.note_type, n.parent_note_id, n.created_at, n.updated_at,
          (
            SELECT json_agg(json_build_object('id', nt.notes_tag_id, 'name', nt.name)) 
            FROM notes_tag nt 
            WHERE nt.notes_tag_id = ANY(n.note_tag_id)
          ) AS notetag,
          (SELECT name FROM users WHERE users_id = l.created_by) AS createdbyname
        FROM notes n 
        JOIN leads l ON n.leads_id = l.leads_id
        WHERE n.leads_id = $1 
        ORDER BY n.created_at DESC
      `;
      const notesResult = await client.query(notesQuery, [leadId]);

      // 3. Fetch Tasks
      const tasksQuery = `
        SELECT t.*, u.name as assignee_name,
        (SELECT name FROM users WHERE users_id = t.created_by) AS createdbyname
        FROM task t 
        LEFT JOIN users u ON t.assignee_id = u.users_id 
        WHERE t.lead_id = $1 
        ORDER BY t.created_at DESC
      `;
      const tasksResult = await client.query(tasksQuery, [leadId]);

      // 4. Fetch Appointments
      const appointmentsQuery = `
        SELECT 
          a.appointment_id, a.company_id, a.builder_id, a.title, a.date, 
          a.start_time, a.end_time, a.location_text, a.link_to, a.lead_id, 
          a.notes, a.send_appointment_customer, a.is_deleted, 
          a.created_by, a.updated_by, a.created_at, a.updated_at,
          (
            SELECT json_agg(json_build_object('id', u.users_id, 'name', u.name))
            FROM users u
            WHERE u.users_id = ANY(a.select_users)
          ) as select_users,
          (SELECT name FROM users WHERE users_id = a.created_by) AS createdbyname
        FROM appointment a 
        WHERE a.lead_id = $1 AND a.is_deleted = false 
        ORDER BY a.date DESC, a.start_time DESC
      `;
      const appointmentsResult = await client.query(appointmentsQuery, [leadId]);

      // 5. Fetch SMS
      const smsQuery = `
        SELECT s.*, u.name as recipient_name,
        (SELECT name FROM users WHERE users_id = l.created_by) AS createdbyname
        FROM sms s 
        JOIN leads l ON s.leads_id = l.leads_id
        LEFT JOIN users u ON s.recipient_id = u.users_id 
        WHERE s.leads_id = $1 
        ORDER BY s.created_at DESC
      `;
      const smsResult = await client.query(smsQuery, [leadId]);

      return {
        success: true,
        data: {
          notes: keysToCamelCase(notesResult.rows),
          tasks: keysToCamelCase(tasksResult.rows),
          appointments: keysToCamelCase(appointmentsResult.rows),
          sms: keysToCamelCase(smsResult.rows),
        },
        message: "Lead actions fetched successfully",
      };
    } catch (error) {
      console.error("Error in getAllLeadActions:", error);
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  }

  async getLeadActivityLog(leadId, builderId, companyId, filters = {}) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      // 1. Verify lead existence and ownership
      const leadCheck = await client.query(
        "SELECT leads_id FROM leads WHERE leads_id = $1 AND (builder_id = $2 OR company_id = $3)",
        [leadId, builderId, companyId],
      );

      if (leadCheck.rowCount === 0) {
        return { success: false, message: "Lead not found or access denied" };
      }

      const { page = 1, limit = 20, module, action, search } = filters;
      const offset = (page - 1) * limit;

      const whereConditions = ["al.leads_id = $1"];
      const queryParams = [leadId];
      let paramIndex = 2;

      if (module) {
        whereConditions.push(`al.module = $${paramIndex++}`);
        queryParams.push(module);
      }

      if (action) {
        whereConditions.push(`al.action = $${paramIndex++}`);
        queryParams.push(action);
      }

      if (search) {
        whereConditions.push(`(
          u.name ILIKE $${paramIndex} OR 
          al.description ILIKE $${paramIndex + 1}
        )`);
        queryParams.push(`%${search}%`, `%${search}%`);
        paramIndex += 2;
      }

      const whereClause = whereConditions.join(" AND ");

      const dataQuery = `
        SELECT 
          al.lead_activity_log_id,
          al.leads_id,
          al.user_id,
          al.module,
          al.module_id,
          al.record_name,
          al.action,
          al.field_name,
          al.old_value,
          al.new_value,
          al.description,
          al.metadata,
          al.created_at,
          u.name AS user_name
        FROM lead_activity_log al
        LEFT JOIN users u ON al.user_id = u.users_id
        WHERE ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);
      paramIndex += 2;

      const countQuery = `
        SELECT COUNT(*) AS total
        FROM lead_activity_log al
        LEFT JOIN users u ON al.user_id = u.users_id
        WHERE ${whereClause}
      `;

      const [dataResult, countResult] = await Promise.all([
        client.query(dataQuery, queryParams),
        client.query(countQuery, queryParams.slice(0, -2)),
      ]);

      const total = parseInt(countResult.rows[0].total);

      const activityLogs = keysToCamelCase(dataResult.rows);
      
      // Format activity log entries for professional presentation
      activityLogs.forEach(log => {
        // Capitalize names and modules
        if (log.userName) log.userName = formatCamelCaseToReadable(log.userName);
        if (log.recordName) log.recordName = formatCamelCaseToReadable(log.recordName);
        if (log.module) log.module = formatCamelCaseToReadable(log.module);

        if (log.action === 'UPDATE' && log.fieldName) {
          const readableField = formatCamelCaseToReadable(log.fieldName);
          const oldValue = log.oldValue || 'None';
          const newValue = log.newValue || 'None';
          
          let context = "";
          if (log.module === "Quotation" && log.metadata?.quotationVersionNo) {
            context = ` in Quotation Version V${log.metadata.quotationVersionNo}`;
          }

          log.description = `Updated ${readableField}${context} ${oldValue} → ${newValue}`;
        } else if (log.action === 'CREATE') {
          log.description = `Created ${log.module} ${log.recordName || ""}`.trim();
        } else if (log.action === 'DELETE') {
          log.description = `Deleted ${log.module} ${log.recordName || ""}`.trim();
        } else if (log.description) {
          log.description = formatCamelCaseToReadable(log.description);
        }

        // Professional touch: Ensure "v2" becomes "V2" in any version strings
        if (log.description) {
          log.description = log.description.replace(/\bv(\d+)\b/g, 'V$1');
        }
      });

      return {
        success: true,
        data: {
          activityLogs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
        message: "Lead activity log fetched successfully",
      };
    } catch (error) {
      console.error("Error in getLeadActivityLog:", error);
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  }
}

export default new LeadsService();
