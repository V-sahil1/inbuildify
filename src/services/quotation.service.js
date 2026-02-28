const quotationRepository = require("../repositories/quotation.repository");
const leadsRepository = require("../repositories/leads.repository");
const { generateDynamicReferenceNumber } = require("../utils/common");
const getPool = require("../config/database");

class QuotationService {
  async createQuotation(leadsId, userId, builderId, companyId) {
    try {
      // Check if lead exists to validate logic, and ensure scope access
      const existingLead = await leadsRepository.getLeadById(leadsId, builderId, companyId);
      if (!existingLead) {
        return {
          success: false,
          message: "Lead not found or unauthorized",
        };
      }

      const reference_number = await generateDynamicReferenceNumber({
        prefix: "QT",
        tableName: "quotation",
        column: "reference_number",
        user: null,
        client: getPool(),
      });

      const quotationData = {
        leads_id: leadsId,
        reference_number,
        created_by: userId,
      };

      const quotation = await quotationRepository.createQuotation(quotationData);

      const versionData = {
        quotation_id: quotation.quotationId,
        quotation_version_no: 1,
      };

      const quotationVersion = await quotationRepository.createQuotationVersion(versionData);
      
      return {
        success: true,
        data: {
          quotation,
          quotationVersion,
        },
        message: "Quotation created successfully",
      };
    } catch (error) {
      console.error("DEBUG: Error in createQuotation service:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getQuotationsByLeadId(leadsId, builderId, companyId) {
    try {
      const existingLead = await leadsRepository.getLeadById(leadsId, builderId, companyId);
      if (!existingLead) {
        return {
          success: false,
          message: "Lead not found or unauthorized",
        };
      }

      const quotations = await quotationRepository.getAllQuotationsByLeadId(leadsId);

      return {
        success: true,
        data: quotations,
        message: "Quotations fetched successfully",
      };
    } catch (error) {
      console.error("DEBUG: Error in getQuotationsByLeadId service:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getQuotationVersions(quotationId, builderId, companyId) {
    try {
      const client = getPool();
      const checkQuery = `
        SELECT q.quotation_id FROM quotation q
        JOIN leads l ON q.leads_id = l.leads_id
        WHERE q.quotation_id = $1 AND (l.builder_id = $2 OR (l.company_id = $3 AND $3 IS NOT NULL))
      `;
      const checkResult = await client.query(checkQuery, [quotationId, builderId, companyId]);

      if (checkResult.rowCount === 0) {
        return {
          success: false,
          message: "Quotation not found or unauthorized",
        };
      }

      const versions = await quotationRepository.getVersionsByQuotationId(quotationId);

      return {
        success: true,
        data: versions,
        message: "Quotation versions fetched successfully",
      };
    } catch (error) {
      console.error("DEBUG: Error in getQuotationVersions service:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateQuotationVersion(versionId, updateData, builderId, companyId) {
    try {
      const client = getPool();

      // Fetch the version + verify ownership via quotation → lead
      const checkQuery = `
        SELECT qv.*, q.leads_id
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        JOIN leads l ON q.leads_id = l.leads_id
        WHERE qv.quotation_version_id = $1 AND (l.builder_id = $2 OR (l.company_id = $3 AND $3 IS NOT NULL))
      `;
      const checkResult = await client.query(checkQuery, [versionId, builderId, companyId]);

      if (checkResult.rowCount === 0) {
        return {
          success: false,
          message: "Quotation version not found or unauthorized",
        };
      }

      const existingVersion = checkResult.rows[0];

      // If already approved, block all updates
      if (existingVersion.is_approve === true) {
        return {
          success: false,
          message: "This quotation version is already approved and cannot be updated",
        };
      }

      // If user is approving now, sketch_number is required
      if (updateData.is_approve === true && !updateData.sketch_number) {
        return {
          success: false,
          message: "Sketch number is required when approving a quotation version",
        };
      }

      // Check dwelling_type_id prerequisite for floor_plan and facade
      const effectiveDwellingTypeId = updateData.dwelling_type_id !== undefined
        ? updateData.dwelling_type_id
        : existingVersion.dwelling_type_id;

      if ((updateData.floor_plan_id || updateData.facade_id) && !effectiveDwellingTypeId) {
        return {
          success: false,
          message: "Dwelling type must be selected before setting floor plan or facade",
        };
      }

      // Validate foreign key references (with ownership + active status check)
      const validations = [
        { field: "location_id", table: "location", pk: "location_id", label: "Location", statusField: "status" },
        { field: "range_id", table: "range", pk: "range_id", label: "Range", statusField: "is_active" },
        { field: "dwelling_type_id", table: "dwelling_type", pk: "dwelling_type_id", label: "Dwelling Type", statusField: "is_active" },
        { field: "floor_plan_id", table: "floor_plan", pk: "floor_plan_id", label: "Floor Plan", statusField: "status" },
        { field: "facade_id", table: "facade", pk: "facade_id", label: "Facade", statusField: "status" },
      ];

      for (const v of validations) {
        if (updateData[v.field] && updateData[v.field] !== null) {
          const result = await client.query(
            `SELECT ${v.pk}, ${v.statusField} FROM ${v.table} WHERE ${v.pk} = $1 AND (
              (company_id = $2 AND $2 IS NOT NULL)
              OR (builder_id = $3 AND $3 IS NOT NULL)
            ) LIMIT 1`,
            [updateData[v.field], companyId, builderId]
          );
          if (result.rowCount === 0) {
            return {
              success: false,
              message: `${v.label} not found or does not belong to your organization`,
            };
          }
          if (result.rows[0][v.statusField] === false) {
            return {
              success: false,
              message: `${v.label} is currently inactive`,
            };
          }
        }
      }

      // If range_id or dwelling_type_id is changing, clear related selections
      const rangeChanged = updateData.range_id !== undefined
        && updateData.range_id !== existingVersion.range_id;
      const dwellingTypeChanged = updateData.dwelling_type_id !== undefined
        && updateData.dwelling_type_id !== existingVersion.dwelling_type_id;

      if (rangeChanged || dwellingTypeChanged) {
        // Set facade_id and floor_plan_id to NULL
        updateData.facade_id = null;
        updateData.floor_plan_id = null;

        // Delete related package mappings
        await client.query(
          `DELETE FROM quotation_version_package_map WHERE quotation_version_id = $1`,
          [versionId]
        );

        // Delete related pricelist item mappings
        await client.query(
          `DELETE FROM quotation_version_pricelist_item_map WHERE quotation_version_id = $1`,
          [versionId]
        );
      }

      const updated = await quotationRepository.updateQuotationVersion(versionId, updateData);

      if (!updated) {
        return {
          success: false,
          message: "No valid fields provided for update",
        };
      }

      return {
        success: true,
        data: updated,
        message: "Quotation version updated successfully",
      };
    } catch (error) {
      console.error("DEBUG: Error in updateQuotationVersion service:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteQuotation(quotationId, builderId, companyId) {
    try {
      // Verify the quotation exists and belongs to a lead the user can access
      const client = getPool();
      const checkQuery = `
        SELECT q.quotation_id FROM quotation q
        JOIN leads l ON q.leads_id = l.leads_id
        WHERE q.quotation_id = $1 AND (l.builder_id = $2 OR (l.company_id = $3 AND $3 IS NOT NULL))
      `;
      const checkResult = await client.query(checkQuery, [quotationId, builderId, companyId]);

      if (checkResult.rowCount === 0) {
        return {
          success: false,
          message: "Quotation not found or unauthorized",
        };
      }

      const deleted = await quotationRepository.deleteQuotation(quotationId);

      return {
        success: true,
        data: deleted,
        message: "Quotation deleted successfully",
      };
    } catch (error) {
      console.error("DEBUG: Error in deleteQuotation service:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = new QuotationService();
