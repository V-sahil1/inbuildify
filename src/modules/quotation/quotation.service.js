import quotationRepository from "./quotation.repository.js";
import leadsRepository from "../lead/leads.repository.js";
import { generateDynamicReferenceNumber, keysToCamelCase } from "../../utils/common.js";
import getPool from "../../config/database.js";
import { logActivity, compareAndLogUpdates } from "../../utils/activityLogger.js";
import db from "../../config/database/models/postgre-models/index.js";
import { Op } from "sequelize";
import { generatePDF } from "./pdf.service.js";
import sendEmail from "../../service/sendMail.service.js";
import { generateQuotationHTML } from "../../utils/template.js";
import { uploadFile, getObject, generatePresignedDownloadUrl } from "../../service/s3.service.js";

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

      if (!existingLead.propertyDetailId) {
        return {
          success: false,
          message: "Cannot create quotation: Lead must have an associated property.",
        };
      }

      // Check if this is the first quotation for the lead
      const pool = getPool();
      const versionCountQuery = `
        SELECT count(qv.quotation_version_id) as count
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        WHERE q.leads_id = $1
      `;
      const versionCountResult = await pool.query(versionCountQuery, [leadsId]);
      const versionCount = parseInt(versionCountResult.rows[0].count, 10);

      const reference_number = await generateDynamicReferenceNumber({
        prefix: "QT",
        tableName: "quotation",
        column: "reference_number",
        user: null,
        client: getPool(),
      });

      const client = await getPool().connect();
      try {
        await client.query("BEGIN");

        // Check for latest quotation version of this lead
        const latestVersionQuery = `
          SELECT qv.* 
          FROM quotation_version qv
          JOIN quotation q ON qv.quotation_id = q.quotation_id
          WHERE q.leads_id = $1
          ORDER BY q.created_at DESC, qv.quotation_version_no DESC
          LIMIT 1
        `;
        const latestVersionResult = await client.query(latestVersionQuery, [leadsId]);
        const latestVersion = latestVersionResult.rowCount > 0 ? latestVersionResult.rows[0] : null;

        // Check compaction report status
        const propertyQuery = `
          SELECT compaction_report, compaction_report_provider 
          FROM property_detail 
          WHERE property_detail_id = $1
        `;
        const propertyResult = await client.query(propertyQuery, [existingLead.propertyDetailId]);
        const compactionReport = propertyResult.rowCount > 0 ? propertyResult.rows[0].compaction_report : null;
        const compactionReportProvider = propertyResult.rowCount > 0 ? propertyResult.rows[0].compaction_report_provider : null;

        // Insert new Quotation
        const insertQuotationQuery = `
          INSERT INTO quotation (leads_id, reference_number, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *
        `;
        const quotationResult = await client.query(insertQuotationQuery, [leadsId, reference_number, userId]);
        const quotation = quotationResult.rows[0];

        // Insert new Quotation Version
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
            sketch_number,
            package_id,
            structure_engineer_id,
            structure_engineer_price,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NULL, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *
        `;
        const versionResult = await client.query(insertVersionQuery, [
          quotation.quotation_id,
          1,
          latestVersion ? latestVersion.location_id : null,
          latestVersion ? latestVersion.range_id : null,
          latestVersion ? latestVersion.dwelling_type_id : null,
          latestVersion ? latestVersion.floor_plan_id : null,
          latestVersion ? latestVersion.facade_id : null,
          latestVersion ? latestVersion.package_id : null,
          latestVersion ? latestVersion.structure_engineer_id : null,
          latestVersion ? latestVersion.structure_engineer_price : null,
        ]);
        const quotationVersion = versionResult.rows[0];

        if (latestVersion) {
          // Copy Pricelist Item Maps
          await client.query(`
            INSERT INTO quotation_version_items (
              quotation_version_id, price_list_id, price_list_name, price_list_item_id, 
              price_list_item_description, price_list_item_short_description, 
              price_list_item_cost_type, price_list_item_cost_type_text, 
              price_list_item_cost_option, price_list_item_cost, 
              price_list_item_builder_cost, price_list_item_sort_order, 
              price_list_item_uom, price_list_item_status, 
              price_list_item_include_by_default, price_list_item_allow_remove_from_quotation, 
              price_list_item_show_in_hl_package, price_list_item_package_only, 
              price_list_item_range_id, price_list_item_dwelling_type_id, 
              price_list_item_created_at, price_list_item_updated_at, 
              package_id, package_name, package_cost, package_builder_cost, 
              quantity, note, total_price, 
              created_at, updated_at
            )
            SELECT $1, price_list_id, price_list_name, price_list_item_id, 
                   price_list_item_description, price_list_item_short_description, 
                   price_list_item_cost_type, price_list_item_cost_type_text, 
                   price_list_item_cost_option, price_list_item_cost, 
                   price_list_item_builder_cost, price_list_item_sort_order, 
                   price_list_item_uom, price_list_item_status, 
                   price_list_item_include_by_default, price_list_item_allow_remove_from_quotation, 
                   price_list_item_show_in_hl_package, price_list_item_package_only, 
                   price_list_item_range_id, price_list_item_dwelling_type_id, 
                   price_list_item_created_at, price_list_item_updated_at, 
                   package_id, package_name, package_cost, package_builder_cost, 
                   quantity, note, total_price, 
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM quotation_version_items
            WHERE quotation_version_id = $2
          `, [quotationVersion.quotation_version_id, latestVersion.quotation_version_id]);

          // Note: we can copy custom sections similarly if they apply to the new quotation's version
          await client.query(`
            INSERT INTO quotation_version_custom_section (quotation_version_id, file_url, sort_order)
            SELECT $1, file_url, sort_order
            FROM quotation_version_custom_section
            WHERE quotation_version_id = $2
          `, [quotationVersion.quotation_version_id, latestVersion.quotation_version_id]);
        } else if (compactionReport === "not_available" && compactionReportProvider === "builder") {
          // If first quotation and compaction report is not available and provided by builder, map "Compaction Report Charge"
          const priceListItemQuery = `
            SELECT price_list_item_id, cost 
            FROM price_list_item 
            WHERE item_description = $1 
            AND (builder_id = $2 OR (company_id = $3 AND $3 IS NOT NULL))
            AND status = 'active'
            ORDER BY created_at ASC
            LIMIT 1
          `;
          const priceListItemResult = await client.query(priceListItemQuery, [
            "Compaction Report Charge",
            builderId,
            companyId,
          ]);

          if (priceListItemResult.rowCount > 0) {
            const pli = priceListItemResult.rows[0];
            await client.query(
              `
              INSERT INTO quotation_version_items (
                quotation_version_id, price_list_item_id, price_list_item_description,
                price_list_item_cost, quantity, total_price,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
              [
                quotationVersion.quotation_version_id,
                pli.price_list_item_id,
                "Compaction Report Charge",
                pli.cost,
                1,
                pli.cost,
              ]
            );
          }
        }

        // Auto-convert lead to opportunity with status depending on whether previous versions exist
        const firstTimeConvertStatus = latestVersion ? 'Negotiation' : 'Proposal';
        await leadsRepository.convertLeadToOpportunity(leadsId, null, builderId, companyId, firstTimeConvertStatus, client);

        await client.query("COMMIT");

        // Log Activity
        await logActivity(client, {
          userId: userId,
          leadsId: leadsId,
          module: "Quotation",
          moduleId: quotation.quotation_id,
          recordName: reference_number,
          action: "CREATE",
          description: `Quotation created: ${reference_number}`
        });

        // Fetch fully enriched version to include lead and contact details mapping
        const enrichedVersion = await quotationRepository.getQuotationVersionDetailsById(quotationVersion.quotation_version_id);

        // Format result like original response

        const formattedQuotation = keysToCamelCase(quotation);
        formattedQuotation.versions = enrichedVersion ? [enrichedVersion] : [keysToCamelCase(quotationVersion)];

        return {
          success: true,
          data: formattedQuotation,
          message: "Quotation created successfully",
        };
      } catch (innerError) {
        await client.query("ROLLBACK");
        throw innerError;
      } finally {
        client.release();
      }
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

  async getAllQuotations(builderId, companyId, options = {}) {
    try {
      if (!builderId) {
        return { success: false, message: "Builder ID is required" };
      }
      const result = await quotationRepository.getAllQuotations(builderId, companyId, options);
      return { success: true, data: result, message: "Quotations fetched successfully" };
    } catch (error) {
      console.error("Error in getAllQuotations service:", error);
      return { success: false, message: error.message };
    }
  }

  async getQuotationCountsByStatus(builderId, companyId) {
    try {
      if (!builderId) {
        return { success: false, message: "Builder ID is required" };
      }
      const counts = await quotationRepository.getQuotationCountsByStatus(builderId, companyId);
      return { success: true, data: counts, message: "Quotation counts fetched successfully" };
    } catch (error) {
      console.error("Error in getQuotationCountsByStatus service:", error);
      return { success: false, message: error.message };
    }
  }

  async getQuotationFilterOptions(builderId, companyId) {
    try {
      if (!builderId) {
        return { success: false, message: "Builder ID is required" };
      }
      const options = await quotationRepository.getQuotationFilterOptions(builderId, companyId);
      return { success: true, data: options, message: "Quotation filter options fetched successfully" };
    } catch (error) {
      console.error("Error in getQuotationFilterOptions service:", error);
      return { success: false, message: error.message };
    }
  }

  async syncQuotationFromHLP(leadsId, houseLandPackageId, userId, builderId, companyId) {
    const client = await getPool().connect();
    try {
      // 1. Fetch HLP details
      const hlpQuery = `
        SELECT hlp.*, f.location_id
        FROM house_land_package hlp
        LEFT JOIN facade f ON hlp.facade_id = f.facade_id
        WHERE hlp.house_land_package_id = $1
      `;
      const hlpResult = await client.query(hlpQuery, [houseLandPackageId]);

      if (hlpResult.rowCount === 0) {
        return { success: false, message: "House Land Package not found" };
      }

      const hlp = hlpResult.rows[0];

      await client.query('BEGIN');

      // Check if any other quotation versions exist for this lead before inserting new ones
      const existingVersionCheckResult = await client.query(
        "SELECT qv.quotation_version_id FROM quotation_version qv JOIN quotation q ON qv.quotation_id = q.quotation_id WHERE q.leads_id = $1 LIMIT 1",
        [leadsId]
      );
      const hlpConvertStatus = existingVersionCheckResult.rowCount > 0 ? 'Negotiation' : 'Proposal';

      // 2. Generate Reference Number
      const reference_number = await generateDynamicReferenceNumber({
        prefix: "QT",
        tableName: "quotation",
        column: "reference_number",
        user: null,
        client: getPool(),
      });

      // 3. Create Quotation
      const insertQuotationQuery = `
        INSERT INTO quotation (leads_id, reference_number, created_by, is_hl_package_quotation, created_at, updated_at)
        VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING quotation_id
      `;
      const quotationResult = await client.query(insertQuotationQuery, [leadsId, reference_number, userId]);
      const quotationId = quotationResult.rows[0].quotation_id;

      // 4. Create Quotation Version
      const insertVersionQuery = `
        INSERT INTO quotation_version (
          quotation_id, quotation_version_no, location_id, range_id,
          dwelling_type_id, floor_plan_id, facade_id, is_approve, package_id,
          created_at, updated_at
        ) VALUES ($1, 1, $2, $3, $4, $5, $6, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING quotation_version_id
      `;
      const versionResult = await client.query(insertVersionQuery, [
        quotationId, hlp.location_id, hlp.range_id,
        hlp.dwelling_type_id, hlp.floor_plan_id, hlp.facade_id
      ]);
      const versionId = versionResult.rows[0].quotation_version_id;

      // 5. Copy Pricelist Items from HLP
      await client.query(`
        INSERT INTO quotation_version_pricelist_item_map (
          quotation_version_id, price_list_item_id, quantity, note, total_price
        )
        SELECT $1, price_list_item_id, quantity, note, total_price
        FROM h_l_package_pricelist_item_map
        WHERE house_land_package_id = $2
      `, [versionId, houseLandPackageId]);

      // Auto-convert lead to opportunity
      await leadsRepository.convertLeadToOpportunity(leadsId, null, builderId, companyId, hlpConvertStatus, client);

      await client.query('COMMIT');

      // Log Activity
      await logActivity(client, {
        userId: userId,
        leadsId: leadsId,
        module: "Quotation",
        moduleId: quotation.quotation_id,
        recordName: reference_number,
        action: "CREATE",
        description: `Quotation synced from HLP: ${reference_number}`
      });

      // 6. Fetch fully enriched version (this includes the sum totals requested)
      const result = await quotationRepository.getQuotationVersionDetailsById(versionId);

      return {
        success: true,
        data: result,
        message: "Quotation created from House Land Package successfully",
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("DEBUG: Error in syncQuotationFromHLP:", error);
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  }

  async getQuotationVersions(quotationId, builderId, companyId, versionId = null) {
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

      const versions = await quotationRepository.getVersionsByQuotationId(quotationId, versionId);

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

  async getQuotationVersionById(versionId, builderId, companyId) {
    try {
      const client = getPool();
      const checkQuery = `
        SELECT qv.quotation_version_id
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

      const version = await quotationRepository.getQuotationVersionDetailsById(versionId);

      return {
        success: true,
        data: version ? [version] : [],
        message: "Quotation version fetched successfully",
      };
    } catch (error) {
      console.error("DEBUG: Error in getQuotationVersionById service:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateQuotationVersion(versionId, updateData, builderId, companyId, userId) {
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

      // Block updates to older versions (only the latest version can be updated)
      // const currentMaxVersion = await quotationRepository.getLatestQuotationVersionNo(existingVersion.quotation_id);
      // if (existingVersion.quotation_version_no !== currentMaxVersion) {
      //   return {
      //     success: false,
      //     message: "Only the latest quotation version can be updated",
      //   };
      // }

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

      const effectiveRangeId = updateData.range_id !== undefined
        ? updateData.range_id
        : existingVersion.range_id;

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
            `SELECT ${v.pk}, ${v.statusField}${v.field === 'floor_plan_id' || v.field === 'facade_id' ? ', range_id, dwelling_type_id' : ''} 
             FROM ${v.table} WHERE ${v.pk} = $1 AND (
              (company_id = $2 AND $2 IS NOT NULL)
              OR (builder_id = $3 AND $3 IS NOT NULL)
            ) LIMIT 1`,
            [updateData[v.field], companyId, builderId],
          );
          if (result.rowCount === 0) {
            return {
              success: false,
              message: `${v.label} not found or does not belong to your organization`,
            };
          }
          const record = result.rows[0];
          if (record[v.statusField] === false) {
            return {
              success: false,
              message: `${v.label} is currently inactive`,
            };
          }

          // Consistency check for Range and Dwelling Type
          if (v.field === "floor_plan_id" || v.field === "facade_id") {
            if (record.range_id !== effectiveRangeId) {
              return {
                success: false,
                message: `The selected ${v.label} does not match the quotation version's range`,
              };
            }
            if (record.dwelling_type_id !== effectiveDwellingTypeId) {
              return {
                success: false,
                message: `The selected ${v.label} does not match the quotation version's dwelling type`,
              };
            }
          }
        }
      }
      console.log("test1@mailinat")

      // Handle structure_engineer_id: validate and auto-populate price from StructureEngineer
      if (updateData.structure_engineer_id !== undefined) {
        if (updateData.structure_engineer_id === null) {
          // If clearing the engineer, also clear the price
          updateData.structure_engineer_price = null;
        } else {
          // Validate engineer exists, belongs to org, and is active
          const { StructureEngineer } = db;

          const engineer = await StructureEngineer.findOne({
            attributes: ["structure_engineer_id", "price", "is_active"],
            where: {
              structure_engineer_id: updateData.structure_engineer_id,
              [Op.or]: [
                { company_id: companyId || null },
                { builder_id: builderId || null },
              ],
            },
          });

          if (!engineer) {
            return {
              success: false,
              message: "Structure engineer not found or does not belong to your organization",
            };
          }

          if (engineer.is_active === false) {
            return {
              success: false,
              message: "Structure engineer is currently inactive",
            };
          }

          // Auto-populate price from structure_engineer table
          // Only override if not explicitly provided in updateData
          if (updateData.structure_engineer_price === undefined) {
            updateData.structure_engineer_price = engineer.price;
          }
        }
      }

      // If range_id or dwelling_type_id is changing, clear related selections
      const rangeChanged = updateData.range_id !== undefined
        && updateData.range_id !== existingVersion.range_id;
      const dwellingTypeChanged = updateData.dwelling_type_id !== undefined
        && updateData.dwelling_type_id !== existingVersion.dwelling_type_id;

      if (rangeChanged || dwellingTypeChanged) {
        // Set facade_id and floor_plan_id to NULL only if not explicitly updating them right now
        if (updateData.facade_id === undefined) {
          updateData.facade_id = null;
        }
        if (updateData.floor_plan_id === undefined) {
          updateData.floor_plan_id = null;
        }

        // Clear related selections ONLY if they are not being explicitly updated right now
        if (updateData.package_id === undefined) updateData.package_id = null;
        if (updateData.structure_engineer_id === undefined) {
          updateData.structure_engineer_id = null;
          updateData.structure_engineer_price = null;
        }

        // Fetch property details to check compaction report status
        const propertyQuery = `
          SELECT pd.compaction_report, pd.compaction_report_provider 
          FROM leads l
          JOIN property_detail pd ON l.property_detail_id = pd.property_detail_id
          WHERE l.leads_id = $1
        `;
        const propertyResult = await client.query(propertyQuery, [existingVersion.leads_id]);
        const isCompactionMandatory = propertyResult.rowCount > 0 && 
          propertyResult.rows[0].compaction_report === "not_available" && 
          propertyResult.rows[0].compaction_report_provider === "builder";

        // Delete related pricelist item mappings
        // We use a subquery to avoid deleting the 'Compaction Report Charge' if mandatory
        const deleteMapQuery = isCompactionMandatory
          ? `DELETE FROM quotation_version_pricelist_item_map 
             WHERE quotation_version_id = $1 
             AND price_list_item_id NOT IN (
               SELECT price_list_item_id FROM price_list_item WHERE item_description = 'Compaction Report Charge'
             )`
          : `DELETE FROM quotation_version_pricelist_item_map WHERE quotation_version_id = $1`;
        
        await client.query(deleteMapQuery, [versionId]);

        // Delete version items (snapshots)
        const deleteItemsQuery = isCompactionMandatory
          ? `DELETE FROM quotation_version_items 
             WHERE quotation_version_id = $1 AND price_list_item_description != 'Compaction Report Charge'`
          : `DELETE FROM quotation_version_items WHERE quotation_version_id = $1`;

        await client.query(deleteItemsQuery, [versionId]);
      }

      // Handle package_id specifically if provided
      if (updateData.package_id) {
        if (!effectiveRangeId || !effectiveDwellingTypeId) {
          return {
            success: false,
            message: "Range and Dwelling type must be selected before adding a package",
          };
        }

        // Validate that the package provided exists, is active, and matches range/dwelling type
        const packageCheckQuery = `
          SELECT package_id FROM package 
          WHERE package_id = $1
          AND status = true 
          AND (
            (company_id = $2 AND $2 IS NOT NULL)
            OR (builder_id = $3 AND $3 IS NOT NULL)
          )
          AND $4::uuid = ANY(range_id)
          AND $5::uuid = ANY(dwelling_type_id)
        `;
        const packageCheckResult = await client.query(packageCheckQuery, [
          updateData.package_id,
          companyId,
          builderId,
          effectiveRangeId,
          effectiveDwellingTypeId,
        ]);

        if (packageCheckResult.rowCount === 0) {
          return {
            success: false,
            message: "The provided package ID is invalid, inactive, or does not match the selected range and dwelling type",
          };
        }
      }

      const oldVersion = await quotationRepository.getQuotationVersionDetailsById(versionId);
      updateData.updated_by = userId;
      const updated = await quotationRepository.updateQuotationVersion(versionId, updateData);

      // Invalidate cached PDF since version data changed
      await quotationRepository.clearPdfUrl(versionId);

      if (!updated) {
        return {
          success: false,
          message: "No valid fields provided for update",
        };
      }

      // Log Activity
      const newVersion = await quotationRepository.getQuotationVersionDetailsById(versionId);
      const quotationDetails = await client.query(
        "SELECT leads_id, reference_number FROM quotation WHERE quotation_id = $1",
        [newVersion.quotationId]
      );

      if (quotationDetails.rowCount > 0) {
        await compareAndLogUpdates(null, {
          userId,
          leadsId: quotationDetails.rows[0].leads_id,
          module: "Quotation",
          moduleId: newVersion.quotationId,
          recordName: quotationDetails.rows[0].reference_number,
          oldData: oldVersion,
          newData: newVersion,
        });
      }

      return {
        success: true,
        data: newVersion,
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

  async duplicateQuotationVersion(versionId, builderId, companyId, userId) {
    const client = await getPool().connect();
    try {
      // 1. Fetch the source version + verify ownership
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

      const sourceVersion = checkResult.rows[0];
      const quotationId = sourceVersion.quotation_id;

      await client.query("BEGIN");

      // 2. Get the next version number
      const maxVersion = await quotationRepository.getLatestQuotationVersionNo(quotationId);
      const newVersionNo = maxVersion + 1;

      // 3. Create the new quotation version (resetting approval and sketch number)
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
          structure_engineer_id,
          structure_engineer_price,
          sketch_number,
          package_id,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING quotation_version_id
      `;
      const insertVersionValues = [
        quotationId,
        newVersionNo,
        sourceVersion.location_id,
        sourceVersion.range_id,
        sourceVersion.dwelling_type_id,
        sourceVersion.floor_plan_id,
        sourceVersion.facade_id,
        sourceVersion.structure_engineer_id || null,
        sourceVersion.structure_engineer_price || 0,
        sourceVersion.sketch_number || null,
        sourceVersion.package_id || null,
      ];

      const newVersionResult = await client.query(insertVersionQuery, insertVersionValues);
      const newVersionId = newVersionResult.rows[0].quotation_version_id;

      // 5. Copy quotation version items (Snapshots)
      await client.query(`
        INSERT INTO quotation_version_items (
          quotation_version_id, price_list_id, price_list_name, price_list_item_id, 
          price_list_item_description, price_list_item_short_description, 
          price_list_item_cost_type, price_list_item_cost_type_text, 
          price_list_item_cost_option, price_list_item_cost, 
          price_list_item_builder_cost, price_list_item_sort_order, 
          price_list_item_uom, price_list_item_status, 
          price_list_item_include_by_default, price_list_item_allow_remove_from_quotation, 
          price_list_item_show_in_hl_package, price_list_item_package_only, 
          price_list_item_range_id, price_list_item_dwelling_type_id, 
          price_list_item_created_at, price_list_item_updated_at, 
          package_id, package_name, package_cost, package_builder_cost, 
          quantity, note, total_price, 
          created_at, updated_at
        )
        SELECT $1, price_list_id, price_list_name, price_list_item_id, 
               price_list_item_description, price_list_item_short_description, 
               price_list_item_cost_type, price_list_item_cost_type_text, 
               price_list_item_cost_option, price_list_item_cost, 
               price_list_item_builder_cost, price_list_item_sort_order, 
               price_list_item_uom, price_list_item_status, 
               price_list_item_include_by_default, price_list_item_allow_remove_from_quotation, 
               price_list_item_show_in_hl_package, price_list_item_package_only, 
               price_list_item_range_id, price_list_item_dwelling_type_id, 
               price_list_item_created_at, price_list_item_updated_at, 
               package_id, package_name, package_cost, package_builder_cost, 
               quantity, note, total_price, 
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM quotation_version_items
        WHERE quotation_version_id = $2
      `, [newVersionId, versionId]);

      // 6. Copy custom sections
      await client.query(`
        INSERT INTO quotation_version_custom_section (
          quotation_version_id, file_url, sort_order
        )
        SELECT $1, file_url, sort_order
        FROM quotation_version_custom_section
        WHERE quotation_version_id = $2
      `, [newVersionId, versionId]);

      // 7. Check for automatic Compaction Report Charge
      const propertyQuery = `
        SELECT pd.compaction_report, pd.compaction_report_provider 
        FROM leads l
        JOIN property_detail pd ON l.property_detail_id = pd.property_detail_id
        WHERE l.leads_id = $1
      `;
      const propertyResult = await client.query(propertyQuery, [sourceVersion.leads_id]);
      
      if (propertyResult.rowCount > 0) {
        const { compaction_report, compaction_report_provider } = propertyResult.rows[0];
        
        if (compaction_report === "not_available" && compaction_report_provider === "builder") {
          // Check if it already exists in the new version (copied from source)
          const checkItemQuery = `
            SELECT 1 FROM quotation_version_items 
            WHERE quotation_version_id = $1 AND price_list_item_description = $2
          `;
          const checkItemResult = await client.query(checkItemQuery, [newVersionId, "Compaction Report Charge"]);

          if (checkItemResult.rowCount === 0) {
            // Add the charge
            const priceListItemQuery = `
              SELECT price_list_item_id, cost 
              FROM price_list_item 
              WHERE item_description = $1 
              AND (builder_id = $2 OR (company_id = $3 AND $3 IS NOT NULL))
              AND status = 'active'
              ORDER BY created_at ASC
              LIMIT 1
            `;
            const priceListItemResult = await client.query(priceListItemQuery, [
              "Compaction Report Charge",
              builderId,
              companyId,
            ]);

            if (priceListItemResult.rowCount > 0) {
              const pli = priceListItemResult.rows[0];
              await client.query(`
                INSERT INTO quotation_version_items (
                  quotation_version_id, price_list_item_id, price_list_item_description,
                  price_list_item_cost, quantity, total_price,
                  created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `, [newVersionId, pli.price_list_item_id, "Compaction Report Charge", pli.cost, 1, pli.cost]);
            }
          }
        }
      }

      // After duplicating a version, ensure the opportunity status is 'Negotiation'
      await leadsRepository.convertLeadToOpportunity(sourceVersion.leads_id, null, builderId, companyId, 'Negotiation', client);

      await client.query("COMMIT");

      // Log Activity
      const quotationDetails = await client.query("SELECT reference_number FROM quotation WHERE quotation_id = $1", [quotationId]);
      await logActivity(client, {
        userId,
        leadsId: sourceVersion.leads_id,
        module: "Quotation",
        moduleId: quotationId,
        recordName: quotationDetails.rows[0].reference_number,
        action: "CREATE",
        description: `Quotation version duplicated: v${newVersionNo}`
      });

      // Fetch the full newly created version using repository to return all enriched fields
      const enrichedNewVersions = await quotationRepository.getVersionsByQuotationId(quotationId, newVersionId);
      const enrichedNewVersion = enrichedNewVersions.length > 0 ? enrichedNewVersions[0] : null;

      return {
        success: true,
        data: enrichedNewVersion,
        message: "Quotation version duplicated successfully",
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("DEBUG: Error in duplicateQuotationVersion service:", error);
      return {
        success: false,
        message: error.message,
      };
    } finally {
      client.release();
    }
  }

  async deleteQuotation(quotationId, builderId, companyId, userId) {
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

      // Log Activity
      await logActivity(null, {
        userId,
        leadsId: checkResult.rows[0].leads_id,
        module: "Quotation",
        moduleId: quotationId,
        recordName: "Quotation",
        action: "DELETE",
        description: `Quotation deleted`
      });

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

  async getQuotationPDF(versionId, builderId, companyId) {
    try {
      const client = getPool();
      // Verify ownership
      const checkQuery = `
        SELECT qv.quotation_version_id
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

      const versionDetails = await quotationRepository.getQuotationVersionDetailsById(versionId);
      if (!versionDetails) {
        return {
          success: false,
          message: "Quotation version details not found",
        };
      }

      const fileName = `Quotation_v${versionDetails.quotationVersionNo}_${versionDetails.quotationId}.pdf`;

      // Check if PDF already exists in S3
      const existingPdfUrl = await quotationRepository.getPdfUrl(versionId);
      if (existingPdfUrl) {
        try {
          const url = new URL(existingPdfUrl);
          const s3Key = decodeURIComponent(url.pathname.substring(1));
          const s3Result = await getObject(s3Key);
          if (s3Result.success) {
            return {
              success: true,
              data: {
                pdfBuffer: s3Result.data,
                fileName,
                pdfUrl: existingPdfUrl,
              },
            };
          }
        } catch (s3Err) {
          console.log("S3 fetch failed, regenerating PDF:", s3Err.message);
        }
      }

      // Generate fresh PDF, upload to S3, save URL
      const htmlContent = generateQuotationHTML(versionDetails);
      const pdfBuffer = await generatePDF(htmlContent);

      const s3Key = `quotations/${versionId}/${fileName}`;
      const uploadResult = await uploadFile(s3Key, pdfBuffer, "application/pdf");

      if (uploadResult.success) {
        await quotationRepository.updatePdfUrl(versionId, uploadResult.location);
      }

      return {
        success: true,
        data: {
          pdfBuffer,
          fileName,
          pdfUrl: uploadResult.success ? uploadResult.location : null,
        },
      };
    } catch (error) {
      console.error("DEBUG: Error in getQuotationPDF service:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async sendQuotationEmail(versionId, builderId, companyId) {
    try {
      const client = getPool();
      // Verify ownership
      const checkQuery = `
        SELECT qv.quotation_version_id
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

      const versionDetails = await quotationRepository.getQuotationVersionDetailsById(versionId);
      if (!versionDetails) {
        return {
          success: false,
          message: "Quotation version details not found",
        };
      }

      const leadContact = versionDetails.leadContacts && versionDetails.leadContacts[0];
      if (!leadContact || !leadContact.email) {
        return {
          success: false,
          message: "Customer email not available for this quotation",
        };
      }

      // 1. Generate PDF
      const htmlContent = generateQuotationHTML(versionDetails);
      const pdfBuffer = await generatePDF(htmlContent);
      console.log("PDF buffer generated, size:", pdfBuffer.length, "bytes");

      // 2. Upload to S3
      const fileName = `Quotation_v${versionDetails.quotationVersionNo}.pdf`;
      const s3Key = `quotations/${versionId}/${fileName}`;
      const uploadResult = await uploadFile(s3Key, pdfBuffer, "application/pdf");

      if (!uploadResult.success) {
        return {
          success: false,
          message: "Failed to upload PDF to storage",
        };
      }

      // 3. Save S3 URL to DB
      await quotationRepository.updatePdfUrl(versionId, uploadResult.location);

      // 4. Generate presigned download URL (7 days expiry)
      const presignedResult = await generatePresignedDownloadUrl(s3Key, 604800);
      const downloadUrl = presignedResult.success ? presignedResult.url : uploadResult.location;

      // 5. Send email with download link
      const emailSubject = "Your Quotation";
      const customerName = leadContact.name || "Customer";

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0056b3; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Your Quotation is Ready</h1>
          </div>
          <div style="padding: 30px; line-height: 1.6; color: #333;">
            <p>Dear ${customerName},</p>
            <p>Thank you for your interest. Your quotation <strong>(Version ${versionDetails.quotationVersionNo})</strong> has been prepared and is ready for your review.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${downloadUrl}" style="display: inline-block; background-color: #0056b3; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">📄 Download Quotation PDF</a>
            </div>
            <p style="font-size: 13px; color: #888; text-align: center;">This download link is valid for 7 days.</p>
            <p>If you have any questions or need further clarification, please don't hesitate to reach out to us.</p>
            <p style="margin-top: 25px;">Best regards,<br><strong>CRMSimplify Team</strong></p>
          </div>
          <div style="background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #777;">
            This is an automated message. Please do not reply directly to this email.
          </div>
        </div>
      `;

      const emailResult = await sendEmail(
        leadContact.email,
        emailSubject,
        `Dear ${customerName}, Your quotation (Version ${versionDetails.quotationVersionNo}) is ready. Download it here: ${downloadUrl}`,
        emailHtml
      );

      return emailResult;
    } catch (error) {
      console.error("DEBUG: Error in sendQuotationEmail service:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async compareQuotationVersions(leadsId, versions, showAll, builderId, companyId) {
    try {
      const client = getPool();
      const versionId1 = versions[0].version_id;
      const quotationId1 = versions[0].quotation_id;
      const versionId2 = versions[1].version_id;
      const quotationId2 = versions[1].quotation_id;

      // 1. Ownership and sanity checks for both versions
      const checkVersionsQuery = `
        SELECT qv.quotation_version_id, qv.quotation_id, q.reference_number, l.property_detail_id
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        JOIN leads l ON q.leads_id = l.leads_id
        WHERE qv.quotation_version_id IN ($1, $2)
        AND l.leads_id = $3
        AND (l.builder_id = $4 OR (l.company_id = $5 AND $5 IS NOT NULL))
      `;
      const checkResults = await client.query(checkVersionsQuery, [versionId1, versionId2, leadsId, builderId, companyId]);

      if (checkResults.rowCount < 2 && versionId1 !== versionId2) {
        return { success: false, message: "One or both quotation versions not found or unauthorized for this lead" };
      }

      const v1Row = checkResults.rows.find(r => r.quotation_version_id === versionId1);
      const v2Row = checkResults.rows.find(r => r.quotation_version_id === versionId2);

      if (!v1Row || !v2Row) {
        return { success: false, message: "Could not find matching version data" };
      }

      if (v1Row.quotation_id !== quotationId1 || v2Row.quotation_id !== quotationId2) {
        return { success: false, message: "Version does not belong to the specified quotation" };
      }

      // 2. Fetch property details (handling multiple properties if different)
      const fetchPropertyDetails = async (propertyDetailId) => {
        if (!propertyDetailId) return null;
        const pdResult = await client.query(
          `SELECT pd.lot_number, pd.street, pd.address_line1, pd.city, pd.zip_code,
                  s.name as state_name
           FROM property_detail pd
           LEFT JOIN state s ON pd.state_id = s.state_id
           WHERE pd.property_detail_id = $1`,
          [propertyDetailId]
        );
        if (pdResult.rowCount > 0) {
          const pd = pdResult.rows[0];
          return {
            lotNumber: pd.lot_number,
            street: pd.street,
            addressLine1: pd.address_line1,
            city: pd.city,
            state: pd.state_name,
            zipCode: pd.zip_code,
          };
        }
        return null;
      };

      const [propertyAddress1, propertyAddress2] = await Promise.all([
        fetchPropertyDetails(v1Row.property_detail_id),
        fetchPropertyDetails(v2Row.property_detail_id),
      ]);

      // 3. Fetch comparison data for both versions
      const [data1, data2] = await Promise.all([
        quotationRepository.getVersionComparisonData(versionId1),
        quotationRepository.getVersionComparisonData(versionId2),
      ]);

      if (!data1 || !data2) {
        return { success: false, message: "Could not fetch version comparison data" };
      }

      const v1No = data1.version.quotationVersionNo;
      const v2No = data2.version.quotationVersionNo;

      // 4. Build items array
      const items = [];

      // 4a. Package
      if (data1.package || data2.package) {
        const row = {
          type: "package",
          name: (data1.package || data2.package).packageName,
          packageId: (data1.package || data2.package).packageId,
          version1Value: data1.package ? data1.package.packageCost : null,
          version2Value: data2.package ? data2.package.packageCost : null,
        };

        if (showAll || row.version1Value !== row.version2Value) {
          items.push(row);
        }
      }

      // 4b. Floor Plan
      if (data1.version.floorPlanName || data2.version.floorPlanName) {
        const floorPlanRow = {
          type: "floor_plan",
          name: data1.version.floorPlanName || data2.version.floorPlanName || "-",
          version1Value: data1.version.floorPlanName || "-",
          version2Value: data2.version.floorPlanName || "-",
        };
        if (showAll || floorPlanRow.version1Value !== floorPlanRow.version2Value) {
          items.push(floorPlanRow);
        }
      }

      // 4c. Facade
      if (data1.version.facadeName || data2.version.facadeName) {
        const facadeRow = {
          type: "facade",
          name: data1.version.facadeName || data2.version.facadeName || "-",
          version1Value: data1.version.facadeName || "-",
          version2Value: data2.version.facadeName || "-",
        };
        if (showAll || facadeRow.version1Value !== facadeRow.version2Value) {
          items.push(facadeRow);
        }
      }

      // 4c. Pricelist items — union by price_list_item_id
      const allPricelistItemIds = new Set([
        ...data1.pricelistItems.map(p => p.priceListItemId),
        ...data2.pricelistItems.map(p => p.priceListItemId),
      ]);

      for (const pliId of allPricelistItemIds) {
        const v1Item = data1.pricelistItems.find(p => p.priceListItemId === pliId);
        const v2Item = data2.pricelistItems.find(p => p.priceListItemId === pliId);
        const refItem = v1Item || v2Item;

        const row = {
          type: "pricelist_item",
          name: refItem.itemDescription,
          priceListItemId: pliId,
          priceListId: refItem.priceListId,
          priceListName: refItem.priceListName,
          itemCost: refItem.itemCost,
          version1Quantity: v1Item ? v1Item.quantity : null,
          version1TotalPrice: v1Item ? v1Item.totalPrice : null,
          version1Note: v1Item ? v1Item.note : null,
          version2Quantity: v2Item ? v2Item.quantity : null,
          version2TotalPrice: v2Item ? v2Item.totalPrice : null,
          version2Note: v2Item ? v2Item.note : null,
        };

        const isDifferent =
          row.version1Quantity !== row.version2Quantity ||
          row.version1TotalPrice !== row.version2TotalPrice ||
          row.version1Note !== row.version2Note;

        if (showAll || isDifferent) {
          items.push(row);
        }
      }

      return {
        success: true,
        data: {
          version1: {
            referenceNumber: v1Row.reference_number,
            propertyAddress: propertyAddress1,
            quotationVersionId: data1.version.quotationVersionId,
            quotationVersionNo: data1.version.quotationVersionNo,
            totalPackageCost: data1.version.totalPackageCost,
            totalPricelistCost: data1.version.totalPricelistCost,
            grandTotal: data1.version.grandTotal,
          },
          version2: {
            referenceNumber: v2Row.reference_number,
            propertyAddress: propertyAddress2,
            quotationVersionId: data2.version.quotationVersionId,
            quotationVersionNo: data2.version.quotationVersionNo,
            totalPackageCost: data2.version.totalPackageCost,
            totalPricelistCost: data2.version.totalPricelistCost,
            grandTotal: data2.version.grandTotal,
          },
          items,
        },
        message: "Quotation versions compared successfully",
      };
    } catch (error) {
      console.error("DEBUG: Error in compareQuotationVersions service:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async removePackageFromVersion(versionId, packageId, builderId, companyId, userId) {
    try {
      const client = getPool();

      // Verify the version belongs to a lead the user can access
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

      if (!existingVersion.package_id || existingVersion.package_id !== packageId) {
        return {
          success: false,
          message: "Package ID does not exist in this quotation version",
        };
      }

      if (existingVersion.is_approve === true) {
        return {
          success: false,
          message: "This quotation version is already approved and cannot be modified",
        };
      }

      const currentMaxVersion = await quotationRepository.getLatestQuotationVersionNo(existingVersion.quotation_id);
      if (existingVersion.quotation_version_no !== currentMaxVersion) {
        return {
          success: false,
          message: "Only the latest quotation version can be modified",
        };
      }

      const updated = await quotationRepository.removePackageFromVersion(versionId, packageId, builderId, companyId);

      // Log Activity
      const quotationDetails = await client.query(
        "SELECT l.leads_id, q.reference_number FROM quotation q JOIN quotation_version qv ON q.quotation_id = qv.quotation_id JOIN leads l ON q.leads_id = l.leads_id WHERE qv.quotation_version_id = $1",
        [versionId]
      );
      if (quotationDetails.rowCount > 0) {
        await logActivity(null, {
          userId,
          leadsId: quotationDetails.rows[0].leads_id,
          module: "Quotation",
          moduleId: versionId,
          recordName: quotationDetails.rows[0].reference_number,
          action: "UPDATE",
          description: `Package removed from quotation version`
        });
      }

      return {
        success: true,
        data: updated,
        message: "Package removed from quotation version successfully",
      };
    } catch (error) {
      console.error("DEBUG: Error in removePackageFromVersion service:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

export default new QuotationService();
