const leadsRepository = require("./leads.repository");
const { successResponse, errorResponse } = require("../../helper/response");
const { generateDynamicReferenceNumber } = require("../../utils/common");
const getPool = require("../../config/database");
const quotationService = require("../quotation/quotation.service")
class LeadsService {
  async createLead(
    leadData,
    userId,
    builderId,
    companyId,
    forceCreate = false,
  ) {
    try {
      if (!leadData.name || !leadData.email || !leadData.phone) {
        throw new Error("Name, Email and Phone are required");
      }

      const existingLeads = await leadsRepository.getAllLeads(builderId, companyId, {
        email: leadData.email,
        limit: 1,
      });

      if (existingLeads.leads.length > 0 && !forceCreate) {
        return {
          success: false,
          emailExists: true,
          message: "A lead with this email already exists",
          existingLead: existingLeads.leads[0],
        };
      }

      const existingLeadByName = await leadsRepository.checkDuplicateName(
        leadData.name,
        builderId,
        userId
      );

      if (existingLeadByName) {
        return {
          success: false,
          nameExists: true,
          message: "A lead with this name already exists",
          existingLead: existingLeadByName,
        };
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

      if (leadData.email && leadData.email !== existingLead.email) {
        const existingLeads = await leadsRepository.getAllLeads(builderId, companyId, {
          email: leadData.email,
          limit: 1,
        });

        if (existingLeads.leads.length > 0) {
          throw new Error("A lead with this email already exists");
        }
      }

      // Check if name is being updated and if it conflicts with existing leads
      if (leadData.name && leadData.name.toLowerCase() !== existingLead.name.toLowerCase()) {
        const existingLeadByName = await leadsRepository.checkDuplicateName(
          leadData.name,
          builderId,
          userId,
          leadId
        );

        if (existingLeadByName) {
          throw new Error("A lead with this name already exists");
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
          companyId
        );
        if (!hlpValidation.valid) {
          return {
            success: false,
            message: hlpValidation.message,
          };
        }
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
        companyId
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

  async assignLead(leadId, assigneeId, userId, builderId) {
    try {
      const existingLead = await leadsRepository.getLeadById(leadId, builderId);
      if (!existingLead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      const updatedLead = await leadsRepository.updateLead(
        leadId,
        { assigneeId, updatedBy: userId },
        builderId,
      );
      return {
        success: true,
        data: updatedLead,
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
}

 

module.exports = new LeadsService();
