const leadsRepository = require("../repositories/leads.repository");
const { successResponse, errorResponse } = require("../helper/response");
const { generateDynamicReferenceNumber } = require("../utils/common");
const getPool = require("../config/database");

class LeadsService {
  async createLead(
    leadData,
    userId,
    builderId,
    companyId,
    forceCreate = false,
  ) {
    try {
      // Validate required fields
      if (!leadData.name || !leadData.email) {
        throw new Error("Name and email are required");
      }

      // Check if email already exists for same builder
      const existingLeads = await leadsRepository.getAllLeads(builderId, {
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

      // Generate reference number if not provided
      const refrenceNumber =
        leadData.refrenceNumber ||
        (await generateDynamicReferenceNumber({
          prefix: "LD",
          tableName: "leads",
          column: "refrence_number",
          user: { company_id: companyId, builder_id: builderId },
          client: getPool(),
        }));

      const leadDataWithDefaults = {
        ...leadData,
        refrenceNumber,
        builderId,
        companyId: companyId, // Use company from user
        createdBy: userId,
        updatedBy: userId,
        status: leadData.status || "New",
        rating: leadData.rating || "None",
        land: leadData.land || "None",
        finance: leadData.finance || "None",
        faceToFace: leadData.faceToFace || "None",
        purpose: leadData.purpose || "None",
      };

      const lead = await leadsRepository.createLead(leadDataWithDefaults);
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

  async getAllLeads(builderId, filters = {}) {
    try {
      const result = await leadsRepository.getAllLeads(builderId, filters);
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

  async getLeadById(leadId, builderId) {
    try {
      const lead = await leadsRepository.getLeadById(leadId, builderId);

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
      // Check if lead exists
      const existingLead = await leadsRepository.getLeadById(leadId, builderId);
      if (!existingLead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      // Check if email is being updated and if it conflicts with existing leads
      if (leadData.email && leadData.email !== existingLead.email) {
        const existingLeads = await leadsRepository.getAllLeads(builderId, {
          email: leadData.email,
          limit: 1,
        });

        if (existingLeads.leads.length > 0) {
          throw new Error("A lead with this email already exists");
        }
      }

      // Validate region_id if provided
      if (leadData.region_id) {
        const regionValidation = await this.validateRegion(leadData.region_id);
        if (!regionValidation.valid) {
          return {
            success: false,
            message: regionValidation.message,
          };
        }
      }

      // Validate client_type_id if provided
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

      const leadDataWithUpdatedBy = {
        ...leadData,
        updatedBy: userId,
      };

      const updatedLead = await leadsRepository.updateLead(
        leadId,
        leadDataWithUpdatedBy,
        builderId,
      );
      return {
        success: true,
        data: updatedLead,
        message: "Lead updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteLead(leadId, builderId) {
    try {
      // Check if lead exists
      const existingLead = await leadsRepository.getLeadById(leadId, builderId);
      if (!existingLead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      const deletedLead = await leadsRepository.deleteLead(leadId, builderId);
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

  async getLeadStats(builderId) {
    try {
      const stats = await leadsRepository.getLeadStats(builderId);
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

  async updateLeadStatus(leadId, status, userId, builderId) {
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

      console.log("DEBUG: validateClientType called with:", {
        clientTypeId,
        builderId,
        companyId,
      });

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

      // First check if lead source exists and belongs to the same company/builder
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

      // Then check if lead source is active
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
}

module.exports = new LeadsService();
