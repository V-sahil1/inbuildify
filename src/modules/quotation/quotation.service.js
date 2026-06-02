import quotationRepository from "./quotation.repository.js";
import leadsService from "../lead/leads.service.js";
import { generateDynamicReferenceNumber, keysToCamelCase } from "../../utils/common.js";
import {
  getQuotationDriveFileS3Key,
  getQuotationDriveFilePresignedUrl,
} from "../../helper/quotationDriveFile.helper.js";
import { DRIVE_FILE_MAPPING } from "../../constants/driveFile.js";
import { logActivity, compareAndLogUpdates } from "../../utils/activityLogger.js";
import db from "../../config/database/models/postgre-models/index.js";
import {
  DRIVE_FILE_REFERENCE_TYPE,
  DRIVE_FILE_SUB_REFERENCE_TYPE,
} from "../../config/database/models/postgre-models/drive-file.constants.js";
import { Op } from "sequelize";
import { generatePDF } from "./pdf.service.js";
import sendEmail from "../../service/sendMail.service.js";
import { generateQuotationHTML } from "../../utils/template.js";
import { uploadFile, getObject, generatePresignedDownloadUrl } from "../../service/s3.service.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";
import { checkLeadLockStatus } from "../../helper/leadLock.helper.js";
import { checkQuotationLockStatus, syncCompactionReportCharge } from "../../helper/quotation.helper.js";
import docusignService from "../../service/docusign.service.js";
import { encodeQuotationHash, decodeQuotationHash } from "../../utils/hashEncoder.js";
import { env } from "../../config/env.config.js";
import engineerEmailQueue from "../../workers/engineerEmailWorker.js";
import quotationEmailQueue from "../../workers/quotationEmailWorker.js";
import pdfGenerationQueue from "../../workers/pdfGenerationWorker.js";

const syncQuotationVersionFiles = async (quotationVersion, leadsId, transaction) => {
  const { DriveFile } = db;
  const qvId = quotationVersion.quotation_version_id;

  // Handle Facade changes
  if (quotationVersion.facade_id) {
    // Delete old facade drive files for this QV
    await DriveFile.destroy({
      where: {
        reference_id: qvId,
        sub_reference_type: DRIVE_FILE_SUB_REFERENCE_TYPE.FACADE_IMAGE,
      },
      transaction,
    });

    const facadeFiles = await DriveFile.findAll({
      where: {
        reference_id: quotationVersion.facade_id,
        reference_type: DRIVE_FILE_REFERENCE_TYPE.FACADE,
        sub_reference_type: DRIVE_FILE_SUB_REFERENCE_TYPE.FACADE_IMAGE,
      },
      transaction,
    });

    for (const file of facadeFiles) {
      const fileData = file.get({ plain: true });
      delete fileData.file_id;
      delete fileData.created_at;
      delete fileData.updated_at;
      delete fileData.deleted_at;

      fileData.reference_id = qvId;
      fileData.reference_type = DRIVE_FILE_REFERENCE_TYPE.QUOTATION;
      fileData.sub_reference_id = quotationVersion.facade_id;
      fileData.sub_reference_type = DRIVE_FILE_SUB_REFERENCE_TYPE.FACADE_IMAGE;
      fileData.file_name = `qv_${qvId}_${Date.now()}_${fileData.original_name}`;
      fileData.lead_id = leadsId;

      await DriveFile.create(fileData, { transaction });
    }
  }

  // Handle Floor Plan changes
  if (quotationVersion.floor_plan_id) {
    // Delete old floor plan drive files for this QV
    await DriveFile.destroy({
      where: {
        reference_id: qvId,
        sub_reference_type: {
          [Op.in]: [DRIVE_FILE_SUB_REFERENCE_TYPE.FLOOR_PLAN_SIMPLE_IMAGE, DRIVE_FILE_SUB_REFERENCE_TYPE.FLOOR_PLAN_DETAILED_IMAGE],
        },
      },
      transaction,
    });

    const floorPlanFiles = await DriveFile.findAll({
      where: {
        reference_id: quotationVersion.floor_plan_id,
        reference_type: DRIVE_FILE_REFERENCE_TYPE.FLOOR_PLAN,
        sub_reference_type: {
          [Op.in]: [DRIVE_FILE_SUB_REFERENCE_TYPE.FLOOR_PLAN_SIMPLE_IMAGE, DRIVE_FILE_SUB_REFERENCE_TYPE.FLOOR_PLAN_DETAILED_IMAGE],
        },
      },
      transaction,
    });

    for (const file of floorPlanFiles) {
      const fileData = file.get({ plain: true });
      delete fileData.file_id;
      delete fileData.created_at;
      delete fileData.updated_at;
      delete fileData.deleted_at;

      fileData.reference_id = qvId;
      fileData.reference_type = DRIVE_FILE_REFERENCE_TYPE.QUOTATION;
      fileData.sub_reference_id = quotationVersion.floor_plan_id;
      fileData.file_name = `qv_${qvId}_${Date.now()}_${fileData.original_name}`;
      fileData.lead_id = leadsId;

      await DriveFile.create(fileData, { transaction });
    }
  }
};

class QuotationService {
  async createQuotation(leadsId, userId, builderId, companyId) {
    const t = await db.sequelize.transaction();
    try {
      console.log(`[DEBUG] Starting createQuotation for lead: ${leadsId}`);
      const {
        Leads, Quotation, QuotationVersion, QuotationVersionItem,
        QuotationVersionCustomSection, PropertyDetail, sequelize
      } = db;

      // 1. Check if lead exists and access scope
      const lead = await Leads.findOne({
        where: {
          leads_id: leadsId,
          [Op.or]: [{ builder_id: builderId }, { company_id: companyId }]
        },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!lead) {
        await t.rollback();
        return { success: false, message: "Lead not found or unauthorized" };
      }

      await checkLeadLockStatus(leadsId, t);

      if (!lead.property_detail_id) {
        await t.rollback();
        return { success: false, message: "Cannot create quotation: Lead must have an associated property." };
      }

      const reference_number = await generateDynamicReferenceNumber({
        prefix: "QT",
        tableName: "quotation",
        column: "reference_number",
        user: null,
        transaction: t,
      });
      console.log(`[DEBUG] Generated Reference Number: ${reference_number}`);

      // 3. Find latest version to copy from
      const latestVersion = await QuotationVersion.findOne({
        include: [{
          model: Quotation,
          as: "quotation",
          where: { leads_id: leadsId },
          required: true
        }],
        order: [
          [{ model: Quotation, as: "quotation" }, "created_at", "DESC"],
          ["quotation_version_no", "DESC"]
        ],
        transaction: t
      });

      // 4. Create new Quotation
      const quotation = await Quotation.create({
        leads_id: leadsId,
        reference_number,
        created_by: userId,
      }, { transaction: t });

      // 5. Create new Quotation Version
      const quotationVersion = await QuotationVersion.create({
        quotation_id: quotation.quotation_id,
        quotation_version_no: 1,
        location_id: latestVersion?.location_id || null,
        range_id: latestVersion?.range_id || null,
        dwelling_type_id: latestVersion?.dwelling_type_id || null,
        floor_plan_id: latestVersion?.floor_plan_id || null,
        facade_id: latestVersion?.facade_id || null,
        is_approve: false,
        package_id: latestVersion?.package_id || null,
        structure_engineer_id: latestVersion?.structure_engineer_id || null,
        structure_engineer_price: latestVersion?.structure_engineer_price || null,
        facade_price: latestVersion?.facade_price || 0,
      }, { transaction: t });
      console.log(`[DEBUG] Created Quotation Version ID: ${quotationVersion.quotation_version_id}`);

      // Sync drive files
      await syncQuotationVersionFiles(quotationVersion, leadsId, t);

      // 6. Copy items and sections if latest version exists
      if (latestVersion) {
        const oldItems = await QuotationVersionItem.findAll({
          where: { quotation_version_id: latestVersion.quotation_version_id },
          transaction: t
        });

        if (oldItems.length > 0) {
          await QuotationVersionItem.bulkCreate(
            oldItems.map(item => {
              const itemJson = item.get({ plain: true });
              delete itemJson.quotation_version_item_id;
              delete itemJson.created_at;
              delete itemJson.updated_at;
              return {
                ...itemJson,
                quotation_version_id: quotationVersion.quotation_version_id,
              };
            }),
            { transaction: t }
          );
        }

        const oldSections = await QuotationVersionCustomSection.findAll({
          where: { quotation_version_id: latestVersion.quotation_version_id },
          transaction: t
        });

        if (oldSections.length > 0) {
          await QuotationVersionCustomSection.bulkCreate(
            oldSections.map(section => ({
              quotation_version_id: quotationVersion.quotation_version_id,
              file_url: section.file_url,
              sort_order: section.sort_order
            })),
            { transaction: t }
          );
        }
      }

      // 7. Sync compaction report charge
      await syncCompactionReportCharge(leadsId, builderId, companyId, userId, t);

      // 8. Convert lead to opportunity
      const convertStatus = latestVersion ? "Negotiation" : "Proposal";
      await leadsService.convertLeadToOpportunity(leadsId, null, builderId, companyId, convertStatus, t);

      // 9. Activity Logging
      await logActivity(t, {
        userId,
        leadsId,
        module: "Quotation",
        moduleId: quotation.quotation_id,
        recordName: reference_number,
        action: "CREATE",
        description: `Quotation created: ${reference_number}`,
      });

      console.log(`[DEBUG] Committing transaction...`);
      await t.commit();
      console.log(`[DEBUG] Transaction committed successfully.`);

      // Trigger PDF generation in background
      pdfGenerationQueue.add({
        quotation_version_id: quotationVersion.quotation_version_id,
        builder_id: builderId,
        company_id: companyId
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true
      }).catch(err => console.error("Error adding PDF generation job:", err));

      // Enriched return data
      const enrichedVersion = await quotationRepository.getQuotationVersionDetailsById(quotationVersion.quotation_version_id);
      const formattedQuotation = keysToCamelCase(quotation.get({ plain: true }));
      formattedQuotation.versions = enrichedVersion ? [enrichedVersion] : [keysToCamelCase(quotationVersion.get({ plain: true }))];

      return {
        success: true,
        data: formattedQuotation,
        message: 201,
      };

    } catch (error) {
      if (t) await t.rollback();
      console.error("DEBUG: Error in createQuotation service:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getQuotationsByLeadId(leadsId, builderId, companyId) {
    try {
      const leadResult = await leadsService.getLeadById(leadsId, builderId, companyId);
      if (!leadResult.success) {
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

  async getQuotationById(id, builderId, companyId) {
    try {
      if (!builderId) {
        return { success: false, message: "Builder ID is required" };
      }

      // 1. Try to find as Quotation ID
      const quotation = await quotationRepository.getQuotationById(id);

      if (quotation) {
        // Check ownership via the lead associated with the quotation
        const leadResult = await leadsService.getLeadById(quotation.leadsId, builderId, companyId);
        if (!leadResult.success) {
          return {
            success: false,
            message: "Unauthorized: You do not have access to this quotation",
          };
        }

        return {
          success: true,
          data: quotation,
          message: "Quotation fetched successfully",
        };
      }

      // 2. Fallback: Check if it's a Lead ID
      const leadResult = await leadsService.getLeadById(id, builderId, companyId);
      if (leadResult.success) {
        const quotations = await quotationRepository.getAllQuotationsByLeadId(id);
        return {
          success: true,
          data: quotations,
          message: "Quotations for lead fetched successfully",
        };
      }

      return { success: false, message: "Quotation or Lead not found" };
    } catch (error) {
      console.error("DEBUG: Error in getQuotationById service:", error);
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

  async getQuotationVersions(quotationId, builderId, companyId, versionId = null) {
    try {
      const { Quotation, Leads } = db.sequelize.models;
      const quotation = await Quotation.findOne({
        where: { quotation_id: quotationId },
        include: [{
          model: Leads,
          as: "lead",
          where: {
            [Op.or]: [
              { builder_id: builderId },
              ...(companyId ? [{ company_id: companyId }] : [])
            ]
          }
        }]
      });

      if (!quotation) {
        return { success: false, message: "Quotation not found or unauthorized" };
      }

      const versions = await quotationRepository.getVersionsByQuotationId(quotationId, versionId);

      return {
        success: true,
        data: versions,
        message: "Quotation versions fetched successfully",
      };
    } catch (error) {
      console.error("DEBUG: Error in getQuotationVersions service:", error);
      return { success: false, message: error.message };
    }
  }

  async getQuotationVersionById(versionId, builderId, companyId) {
    try {
      const { QuotationVersion, Quotation, Leads } = db.sequelize?.models || db;
      const checkResult = await QuotationVersion.findOne({
        where: { quotation_version_id: versionId },
        include: [{
          model: Quotation,
          as: "quotation",
          include: [{
            model: Leads,
            as: "lead",
            where: {
              [Op.or]: [
                { builder_id: builderId },
                ...(companyId ? [{ company_id: companyId }] : []),
              ],
            },
          }],
        }],
      });

      if (!checkResult) {
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
    const t = await db.sequelize.transaction();
    try {
      const {
        QuotationVersion, Quotation, Leads, StructureEngineer,
        QuotationVersionItem, QuotationVersionPricelistItemMap,
        Location, Range, DwellingType, FloorPlan, Facade, Package,
        PropertyDetail,
      } = db.sequelize?.models || db;

      // 1. Fetch version and verify ownership via quotation -> lead
      const existingVersion = await QuotationVersion.findOne({
        where: { quotation_version_id: versionId },
        include: [
          {
            model: Quotation,
            as: "quotation",
            required: true,
            include: [{
              model: Leads,
              as: "lead",
              required: true,
              where: {
                [Op.or]: [
                  { builder_id: builderId },
                  { company_id: companyId },
                ],
              },
            }],
          },
        ],
        transaction: t,
      });

      if (!existingVersion) {
        await t.rollback();
        return { success: false, message: "Quotation version not found or unauthorized" };
      }

      if (existingVersion.send_to_engineer === true) {
        if (updateData.structure_engineer_id && updateData.structure_engineer_id !== existingVersion.structure_engineer_id) {
          await t.rollback();
          return { success: false, message: "Cannot change the Structural Engineer once the request has been sent to them" };
        }
      }

      // Identify fields being updated
      const updateFields = Object.keys(updateData);
      const isOnlySafeFields = updateFields.every(field =>
        ["upload_report", "structure_engineer_id", "updated_by"].includes(field)
      );

      // Only apply lock checks if updating core quotation data
      if (!isOnlySafeFields) {
        await checkLeadLockStatus(existingVersion.leads_id, t);
        await checkQuotationLockStatus(existingVersion.quotation_id, null, t);

        // If already approved, block all updates to core data
        if (existingVersion.is_approve === true) {
          return {
            success: false,
            message: "This quotation version is already approved and cannot be updated",
          };
        }
      }

      // 3. Sketch number validation on approval
      if (updateData.is_approve === true && !updateData.sketch_number) {
        await t.rollback();
        return { success: false, message: "Sketch number is required when approving a quotation version" };
      }

      // 4. Effective IDs for prerequisites
      const effectiveDwellingTypeId = updateData.dwelling_type_id !== undefined
        ? updateData.dwelling_type_id
        : existingVersion.dwelling_type_id;

      const effectiveRangeId = updateData.range_id !== undefined
        ? updateData.range_id
        : existingVersion.range_id;

      // Track floor plan change — needed for facade clearing and price list auto-mapping below
      const previousFloorPlanId = existingVersion.floor_plan_id;
      const floorPlanChanged = updateData.floor_plan_id !== undefined
        && updateData.floor_plan_id !== previousFloorPlanId;

      // Floor plan changed → the old facade belongs to the old floor plan and must be cleared.
      // Only force-clear if the request does NOT explicitly supply a new facade_id.
      if (floorPlanChanged && updateData.facade_id === undefined) {
        updateData.facade_id = null;
      }

      if ((updateData.floor_plan_id || updateData.facade_id) && !effectiveDwellingTypeId) {
        await t.rollback();
        return { success: false, message: "Dwelling type must be selected before setting floor plan or facade" };
      }

      // 5. Foreign Key Validations
      const validations = [
        { field: "location_id", model: Location, pk: "location_id", label: "Location", statusField: "status" },
        { field: "range_id", model: Range, pk: "range_id", label: "Range", statusField: "is_active" },
        { field: "dwelling_type_id", model: DwellingType, pk: "dwelling_type_id", label: "Dwelling Type", statusField: "is_active" },
        { field: "floor_plan_id", model: FloorPlan, pk: "floor_plan_id", label: "Floor Plan", statusField: "status" },
        { field: "facade_id", model: Facade, pk: "facade_id", label: "Facade", statusField: "status" },
      ];

      for (const v of validations) {
        const idValue = updateData[v.field];
        if (idValue && idValue !== null) {
          const record = await v.model.findOne({
            where: {
              [v.pk]: idValue,
              [Op.or]: [
                { company_id: companyId || null },
                { builder_id: builderId || null },
              ],
            },
            transaction: t,
          });

          if (!record) {
            await t.rollback();
            return { success: false, message: `${v.label} not found or does not belong to your organization` };
          }

          if (record[v.statusField] === false) {
            await t.rollback();
            return { success: false, message: `${v.label} is currently inactive` };
          }

          // Consistency check for Floor Plan and Facade
          if (v.field === "floor_plan_id" || v.field === "facade_id") {
            if (record.range_id !== effectiveRangeId) {
              await t.rollback();
              return { success: false, message: `The selected ${v.label} does not match the quotation version's range` };
            }
            if (record.dwelling_type_id !== effectiveDwellingTypeId) {
              await t.rollback();
              return { success: false, message: `The selected ${v.label} does not match the quotation version's dwelling type` };
            }
          }
        }
      }

      // Facade → Floor Plan constraint:
      // If the user is setting a non-null facade_id, verify it is mapped to the currently
      // selected floor plan (if that floor plan has any facade mappings at all).
      // When no mappings exist, any facade matching range + dwelling_type is allowed.
      const effectiveFloorPlanIdForConstraint = updateData.floor_plan_id !== undefined
        ? updateData.floor_plan_id
        : existingVersion.floor_plan_id;

      if (updateData.facade_id && effectiveFloorPlanIdForConstraint) {
        const facadeMappings = await quotationRepository.getFloorPlanFacadeMappings(
          effectiveFloorPlanIdForConstraint,
          t
        );
        // if (facadeMappings.length > 0) {
        //   const mappedFacadeIds = facadeMappings.map((r) => r.facade_id);
        //   if (!mappedFacadeIds.includes(updateData.facade_id)) {
        //     return {
        //       success: false,
        //       message: "The selected Facade is not mapped to the selected Floor Plan",
        //     };
        //   }
        // }
      }

      // Handle facade_price snapshotting
      if (updateData.facade_id !== undefined) {
        if (updateData.facade_id === null) {
          updateData.facade_price = 0;
        } else {
          const { Facade } = db;
          const facade = await Facade.findOne({
            attributes: ["cost"],
            where: {
              facade_id: updateData.facade_id,
            },
            transaction: t,
          });
          if (facade) {
            updateData.facade_price = facade.cost || 0;
          }
        }
      }

      // Handle structure_engineer_id: validate and auto-populate price from StructureEngineer
      if (updateData.structure_engineer_id !== undefined) {
        if (updateData.structure_engineer_id === null) {
          updateData.structure_engineer_price = null;
        } else {
          const engineer = await StructureEngineer.findOne({
            where: {
              structure_engineer_id: updateData.structure_engineer_id,
              [Op.or]: [
                { company_id: companyId || null },
                { builder_id: builderId || null },
              ],
            },
            transaction: t,
          });

          if (!engineer) {
            await t.rollback();
            return { success: false, message: "Structure engineer not found or does not belong to your organization" };
          }

          if (engineer.is_active === false) {
            await t.rollback();
            return { success: false, message: "Structure engineer is currently inactive" };
          }

          if (updateData.structure_engineer_price === undefined) {
            updateData.structure_engineer_price = engineer.price;
          }
        }
      }

      // 7. Handle Range/Dwelling Type Change (Snapshot Clearing)
      const rangeChanged = updateData.range_id !== undefined && updateData.range_id !== existingVersion.range_id;
      const dwellingTypeChanged = updateData.dwelling_type_id !== undefined && updateData.dwelling_type_id !== existingVersion.dwelling_type_id;

      if (rangeChanged || dwellingTypeChanged) {
        if (updateData.facade_id === undefined) {
          updateData.facade_id = null;
        }
        if (updateData.floor_plan_id === undefined) {
          updateData.floor_plan_id = null;
        }
        if (updateData.package_id === undefined) {
          updateData.package_id = null;
        }
        if (updateData.structure_engineer_id === undefined) {
          updateData.structure_engineer_id = null;
          updateData.structure_engineer_price = null;
        }

        // Fetch property details to check compaction report status
        const lead = await Leads.findByPk(existingVersion.quotation?.leads_id, {
          include: [{ model: PropertyDetail, as: "propertyDetail" }],
          transaction: t,
        });

        const propertyDetail = lead?.propertyDetail;
        const isCompactionMandatory = propertyDetail &&
          propertyDetail.compaction_report === "not_available" &&
          propertyDetail.compaction_report_provider === "builder";

        // Delete related pricelist item mappings
        if (isCompactionMandatory) {
          await QuotationVersionPricelistItemMap.destroy({
            where: {
              quotation_version_id: versionId,
              price_list_item_id: {
                [Op.notIn]: db.sequelize.literal("(SELECT price_list_item_id FROM price_list_item WHERE item_description = 'Compaction Report Charge')"),
              },
            },
            transaction: t,
          });

          await QuotationVersionItem.destroy({
            where: {
              quotation_version_id: versionId,
              [Op.or]: [
                { price_list_item_description: { [Op.ne]: "Compaction Report Charge" } },
                { package_id: { [Op.not]: null } },
              ],
            },
            transaction: t,
          });
        } else {
          await QuotationVersionPricelistItemMap.destroy({
            where: { quotation_version_id: versionId },
            transaction: t,
          });
          await QuotationVersionItem.destroy({
            where: { quotation_version_id: versionId },
            transaction: t,
          });
        }
      }

      // 8. Package Validation
      if (updateData.package_id) {
        if (!effectiveRangeId || !effectiveDwellingTypeId) {
          await t.rollback();
          return { success: false, message: "Range and Dwelling type must be selected before adding a package" };
        }

        const pkg = await Package.findOne({
          where: {
            package_id: updateData.package_id,
            status: true,
            [Op.or]: [
              { company_id: companyId || null },
              { builder_id: builderId || null },
            ],
            range_id: { [Op.contains]: [effectiveRangeId] },
            dwelling_type_id: { [Op.contains]: [effectiveDwellingTypeId] },
          },
          transaction: t,
        });

        if (!pkg) {
          await t.rollback();
          return { success: false, message: "The provided package ID is invalid, inactive, or does not match the selected range and dwelling type" };
        }
      }

      // Handle package_id snapshotting: 
      // If package_id is explicitly being updated (even to null), manage the snapshots.
      if (updateData.package_id !== undefined) {
        // 1. Clear any existing package snapshot for this version
        await quotationRepository.removePackageFromVersion(versionId, null, builderId, companyId, t);

        // 2. If a new package is selected, snapshot it
        if (updateData.package_id !== null) {
          const { Package } = db;
          const pkg = await Package.findOne({
            where: { package_id: updateData.package_id },
            attributes: ["package_id", "name", "cost"],
            transaction: t
          });
          if (pkg) {
            await quotationRepository.addPackageSnapshot(versionId, pkg, t);
          }
        }
      }

      const oldVersion = await quotationRepository.getQuotationVersionDetailsById(versionId, t);
      // upload_report cleanup has moved out of this branch — the controller
      // upserts a DriveFile (sub_reference_type=StructureEngineerUpload)
      // BEFORE this service runs, and the upsert overwrites the existing
      // record's s3_key in place. No reconciliation needed here.

      updateData.updated_by = userId;

      const updated = await quotationRepository.updateQuotationVersion(versionId, updateData, t);
      await quotationRepository.clearPdfUrl(versionId, t);

      // Floor Plan price list item auto-mapping.
      // Only runs when floor_plan_id is explicitly included in the update payload.
      if (updateData.floor_plan_id !== undefined) {
        // If the floor plan changed, remove items that were auto-mapped from the OLD floor plan.
        // Manually added items (not in the old floor plan's mapping) are preserved.
        if (floorPlanChanged && previousFloorPlanId) {
          await quotationRepository.removeFloorPlanPricelistItems(versionId, previousFloorPlanId, t);
        }
        // If the new floor plan is non-null, insert its mapped price list items (duplicates skipped).
        if (updateData.floor_plan_id) {
          await quotationRepository.autoMapFloorPlanPricelistItems(versionId, updateData.floor_plan_id, t);
        }
      }

      // Sync drive files if facade or floor plan changed
      const facadeChanged = updateData.facade_id !== undefined && updateData.facade_id !== existingVersion.facade_id;
      // floorPlanChanged is already declared at line 535!

      const { DriveFile } = db;
      const leadsId = existingVersion.quotation?.leads_id;

      if (facadeChanged) {
        // Delete old facade drive files for this QV
        await DriveFile.destroy({
          where: {
            reference_id: versionId,
            sub_reference_type: DRIVE_FILE_SUB_REFERENCE_TYPE.FACADE_IMAGE,
          },
          transaction: t,
        });

        if (updateData.facade_id) {
          // Clone new facade files
          const facadeFiles = await DriveFile.findAll({
            where: {
              reference_id: updateData.facade_id,
              reference_type: DRIVE_FILE_REFERENCE_TYPE.FACADE,
              sub_reference_type: DRIVE_FILE_SUB_REFERENCE_TYPE.FACADE_IMAGE,
            },
            transaction: t,
          });

          for (const file of facadeFiles) {
            const fileData = file.get({ plain: true });
            delete fileData.file_id;
            delete fileData.created_at;
            delete fileData.updated_at;
            delete fileData.deleted_at;

            fileData.reference_id = versionId;
            fileData.reference_type = DRIVE_FILE_REFERENCE_TYPE.QUOTATION;
            fileData.sub_reference_id = updateData.facade_id;
            fileData.sub_reference_type = DRIVE_FILE_SUB_REFERENCE_TYPE.FACADE_IMAGE;
            fileData.file_name = `qv_${versionId}_${Date.now()}_${fileData.original_name}`;
            fileData.lead_id = leadsId;

            await DriveFile.create(fileData, { transaction: t });
          }
        }
      }

      if (floorPlanChanged) {
        // Delete old floor plan drive files for this QV
        await DriveFile.destroy({
          where: {
            reference_id: versionId,
            sub_reference_type: {
              [Op.in]: [DRIVE_FILE_SUB_REFERENCE_TYPE.FLOOR_PLAN_SIMPLE_IMAGE, DRIVE_FILE_SUB_REFERENCE_TYPE.FLOOR_PLAN_DETAILED_IMAGE],
            },
          },
          transaction: t,
        });

        if (updateData.floor_plan_id) {
          // Clone new floor plan files
          const floorPlanFiles = await DriveFile.findAll({
            where: {
              reference_id: updateData.floor_plan_id,
              reference_type: DRIVE_FILE_REFERENCE_TYPE.FLOOR_PLAN,
              sub_reference_type: {
                [Op.in]: [DRIVE_FILE_SUB_REFERENCE_TYPE.FLOOR_PLAN_SIMPLE_IMAGE, DRIVE_FILE_SUB_REFERENCE_TYPE.FLOOR_PLAN_DETAILED_IMAGE],
              },
            },
            transaction: t,
          });

          for (const file of floorPlanFiles) {
            const fileData = file.get({ plain: true });
            delete fileData.file_id;
            delete fileData.created_at;
            delete fileData.updated_at;
            delete fileData.deleted_at;

            fileData.reference_id = versionId;
            fileData.reference_type = DRIVE_FILE_REFERENCE_TYPE.QUOTATION;
            fileData.sub_reference_id = updateData.floor_plan_id;
            fileData.file_name = `qv_${versionId}_${Date.now()}_${fileData.original_name}`;
            fileData.lead_id = leadsId;

            await DriveFile.create(fileData, { transaction: t });
          }
        }
      }

      if (!updated) {
        await t.rollback();
        return { success: false, message: "No valid fields provided for update" };
      }

      const newVersion = await quotationRepository.getQuotationVersionDetailsById(versionId, t);
      const leadId = existingVersion.quotation?.lead?.leads_id;
      const refNo = existingVersion.quotation?.reference_number;

      if (leadId) {
        await compareAndLogUpdates(t, {
          userId,
          leadsId: leadId,
          module: "Quotation",
          moduleId: existingVersion.quotation_id,
          recordName: refNo,
          oldData: oldVersion,
          newData: newVersion,
          metadata: { quotationVersionNo: newVersion.quotationVersionNo },
          ignoreFields: ['quotationVersionItems', 'leadContacts', 'property', 'versions']
        });
      }

      await t.commit(); // <-- FIX: Commit transaction to release Sequelize connection

      // Trigger PDF generation in background
      pdfGenerationQueue.add({
        quotation_version_id: versionId,
        builder_id: builderId,
        company_id: companyId
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true
      }).catch(err => console.error("Error adding PDF generation job:", err));

      return {
        success: true,
        data: newVersion,
        message: "Quotation version updated successfully",
      };
    } catch (error) {
      if (t) {
        await t.rollback();
      }
      console.error("DEBUG: Error in updateQuotationVersion service:", error);
      return { success: false, message: error.message };
    }
  }

  async sendEngineerEmail(versionId, builderId, companyId) {
    try {
      const {
        QuotationVersion, StructureEngineer, Quotation, Range, DwellingType,
        FloorPlan, Facade, Package, Leads, PropertyDetail
      } = db.sequelize?.models || db;

      // 1. Fetch QuotationVersion with StructureEngineer and additional PDF data (including nested property details)
      const quotationVersion = await QuotationVersion.findOne({
        where: { quotation_version_id: versionId },
        include: [
          {
            model: StructureEngineer,
            as: "structureEngineer",
          },
          {
            model: Quotation,
            as: "quotation",
            include: [
              {
                model: Leads,
                as: "lead",
                include: [
                  {
                    model: PropertyDetail,
                    as: "propertyDetail"
                  }
                ]
              }
            ]
          },
          {
            model: Range,
            as: "range",
            attributes: ["name", "logo_url", "header_url"]
          },
          {
            model: DwellingType,
            as: "dwellingType",
            attributes: ["name"]
          },
          {
            model: FloorPlan,
            as: "floorPlan",
            attributes: [
              "name", "min_land_width", "min_land_depth", "dwelling_area", "beds",
              "baths", "carpark", "living", "garage_area", "porch_area",
              "total_area", "detailed_image", "simple_image", "description"
            ],
            include: [
              { model: db.sequelize?.models?.DriveFile || db.DriveFile, as: "detailedImageFile", attributes: ["s3_key"] },
              { model: db.sequelize?.models?.DriveFile || db.DriveFile, as: "simpleImageFile", attributes: ["s3_key"] }
            ]
          },
          {
            model: Facade,
            as: "facade",
            attributes: ["name", "cost_type", "cost", "builder_cost", "image"],
            include: [
              { model: db.sequelize?.models?.DriveFile || db.DriveFile, as: "facadeImageFile", attributes: ["s3_key"] }
            ]
          },
          {
            model: Package,
            as: "package",
            attributes: ["name", "cost", "builder_cost"]
          }
        ],
      });

      if (!quotationVersion) {
        return { success: false, message: "Quotation version not found" };
      }

      if (!quotationVersion.structure_engineer_id) {
        return { success: false, message: "No Structure Engineer is assigned to this quotation version" };
      }

      const engineer = quotationVersion.structureEngineer;
      if (!engineer || !engineer.email) {
        return { success: false, message: "Structure Engineer does not have a valid email address" };
      }
      // Temporary placeholder content until user specifies format
      const subject = `Engineering Request - Quotation ${quotationVersion.quotation?.reference_number || versionId}`;
      const text = `Dear ${engineer.name},\n\nPlease review the engineering requirements for this quotation.\n\nMore details will follow.`;
      const html = `<p>Dear ${engineer.name},</p><p>Please review the engineering requirements for this quotation.</p><p>More details will follow.</p>`;

      const versionPlain = quotationVersion.get({ plain: true });

      const s3BaseUrl = `https://${env.AWS.S3_BUCKET_NAME}.s3.amazonaws.com`;
      if (versionPlain.facade && versionPlain.facade.facadeImageFile?.s3_key) {
        versionPlain.facade.image = `${s3BaseUrl}/${versionPlain.facade.facadeImageFile.s3_key}`;
      }
      if (versionPlain.floorPlan) {
        if (versionPlain.floorPlan.detailedImageFile?.s3_key) {
          versionPlain.floorPlan.detailed_image = `${s3BaseUrl}/${versionPlain.floorPlan.detailedImageFile.s3_key}`;
        }
        if (versionPlain.floorPlan.simpleImageFile?.s3_key) {
          versionPlain.floorPlan.simple_image = `${s3BaseUrl}/${versionPlain.floorPlan.simpleImageFile.s3_key}`;
        }
      }

      // Resolve report S3 keys from DriveFile records (replaces direct reads of
      // the legacy upload_report / structure_engineer_report columns, which now
      // hold the DriveFile primary key, not the S3 URL).
      const [uploadReportKey, structureEngineerReportKey] = await Promise.all([
        getQuotationDriveFileS3Key(versionId, DRIVE_FILE_MAPPING.SUB_REFERENCES.STRUCTURE_ENGINEER_UPLOAD),
        getQuotationDriveFileS3Key(versionId, DRIVE_FILE_MAPPING.SUB_REFERENCES.STRUCTURE_ENGINEER_REPORT),
      ]);

      // Extract fetched data for the PDF
      const pdfData = {
        range: versionPlain.range || null,
        dwellingType: versionPlain.dwellingType || null,
        floorPlan: versionPlain.floorPlan || null,
        facade: versionPlain.facade || null,
        package: versionPlain.package || null,
        propertyDetail: versionPlain.quotation?.lead?.propertyDetail || versionPlain.quotation?.lead?.property_detail || null,
        uploadReport: uploadReportKey,
        structureEngineerReport: structureEngineerReportKey,
        leadId: versionPlain.quotation?.lead?.leads_id || versionPlain.quotation?.leads_id || null,
        versionId: versionId || versionPlain.quotation_version_id || null
      };

      // Add to background queue
      engineerEmailQueue.add({
        email: engineer.email,
        subject,
        text,
        html,
        pdfData, // Passing the fetched data to the worker
        versionId: quotationVersion.quotation_version_id // Pass the quotation_version_id
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true
      }).catch(err => console.error("Error adding engineer email job:", err));

      // Mark as sent to engineer and reset is_uploaded to false
      quotationVersion.send_to_engineer = true;
      quotationVersion.is_uploaded = false;
      await quotationVersion.save();

      return { success: true, message: "Engineer email has been queued successfully" };
    } catch (error) {
      console.error("Error in sendEngineerEmail service:", error);
      return { success: false, message: error.message };
    }
  }

  async syncQuotationFromHLP(leadsId, houseLandPackageId, userId, builderId, companyId, transaction = null) {
    const {
      HouseLandPackage, Facade, Quotation, QuotationVersion,
      HLPackagePricelistItemMap, QuotationVersionItem, sequelize
    } = db;
    const isExternalTransaction = !!transaction;
    const t = transaction || await sequelize.transaction();
    try {
      // 1. Fetch HLP details
      const hlp = await HouseLandPackage.findByPk(houseLandPackageId, {
        include: [{ model: Facade, as: "facade", attributes: ["location_id", "cost"] }],
        transaction: t,
      });

      if (!hlp) {
        await t.rollback();
        return { success: false, message: "House Land Package not found" };
      }

      await checkLeadLockStatus(leadsId, t);

      // Check if any other quotation versions exist for this lead
      const existingVersion = await QuotationVersion.findOne({
        include: [{
          model: Quotation,
          as: "quotation",
          where: { leads_id: leadsId }
        }],
        transaction: t
      });

      const hlpConvertStatus = existingVersion ? "Negotiation" : "Proposal";

      // 2. Generate Reference Number
      const reference_number = await generateDynamicReferenceNumber({
        prefix: "QT",
        tableName: "quotation",
        column: "reference_number",
        user: null,
        transaction: t,
      });

      // 3. Create Quotation
      const quotation = await Quotation.create(
        {
          leads_id: leadsId,
          reference_number,
          created_by: userId,
          is_hl_package_quotation: true,
        },
        { transaction: t },
      );

      // 4. Create Quotation Version
      const quotationVersion = await QuotationVersion.create({
        quotation_id: quotation.quotation_id,
        quotation_version_no: 1,
        location_id: hlp.facade?.location_id || null,
        range_id: hlp.range_id,
        dwelling_type_id: hlp.dwelling_type_id,
        floor_plan_id: hlp.floor_plan_id,
        facade_id: hlp.facade_id,
        is_approve: false,
        package_id: null,
        facade_price: hlp.facade?.cost || 0,
      }, { transaction: t });

      // Sync drive files
      await syncQuotationVersionFiles(quotationVersion, leadsId, t);

      // 5. Copy Pricelist Items from HLP
      const hlpItems = await HLPackagePricelistItemMap.findAll({
        where: { house_land_package_id: houseLandPackageId },
        transaction: t,
      });

      if (hlpItems.length > 0) {
        await QuotationVersionItem.bulkCreate(
          hlpItems.map((item) => ({
            quotation_version_id: quotationVersion.quotation_version_id,
            price_list_id: item.price_list_id,
            price_list_name: item.price_list_name,
            price_list_item_id: item.price_list_item_id,
            price_list_item_description: item.price_list_item_description,
            price_list_item_short_description: item.price_list_item_short_description,
            price_list_item_cost_type: item.price_list_item_cost_type,
            price_list_item_cost_option: item.price_list_item_cost_option,
            price_list_item_cost: item.price_list_item_cost,
            price_list_item_builder_cost: item.price_list_item_builder_cost,
            price_list_item_uom: item.price_list_item_uom,
            quantity: item.quantity,
            note: item.note,
            total_price: item.total_price,
          })),
          { transaction: t },
        );
      }

      // 6. Auto-convert lead to opportunity
      await leadsService.convertLeadToOpportunity(leadsId, null, builderId, companyId, hlpConvertStatus, t);

      // Log Activity
      await logActivity(t, {
        userId,
        leadsId,
        module: "Quotation",
        moduleId: quotation.quotation_id,
        recordName: reference_number,
        action: "CREATE",
        description: `Quotation synced from HLP: ${reference_number}`,
      });

      if (!isExternalTransaction) await t.commit();
      return {
        success: true,
        data: quotation,
        message: "Quotation created from House Land Package successfully",
      };
    } catch (error) {
      if (!isExternalTransaction && t) await t.rollback();
      console.error("DEBUG: Error in syncQuotationFromHLP:", error);
      return { success: false, message: error.message };
    }
  }

  async duplicateQuotationVersion(versionId, builderId, companyId, userId) {
    const {
      QuotationVersion, Quotation, Leads,
      QuotationVersionItem, QuotationVersionCustomSection,
    } = db;
    const t = await db.sequelize.transaction();

    try {
      // 1. Fetch source version and verify ownership
      const sourceVersion = await QuotationVersion.findOne({
        where: { quotation_version_id: versionId },
        include: [{
          model: Quotation,
          as: "quotation",
          include: [{
            model: Leads,
            as: "lead",
            where: {
              [Op.or]: [
                { builder_id: builderId },
                { company_id: companyId },
              ],
            },
          }],
        }],
        transaction: t,
      });

      if (!sourceVersion) {
        await t.rollback();
        return { success: false, message: "Quotation version not found or unauthorized" };
      }

      const quotationId = sourceVersion.quotation_id;

      // 2. Get the next version number
      const maxVersion = await QuotationVersion.max('quotation_version_no', {
        where: { quotation_id: quotationId },
        transaction: t
      });
      const newVersionNo = (maxVersion || 0) + 1;

      // 3. Create the new quotation version (resetting approval and sketch number)
      const newVersion = await QuotationVersion.create({
        quotation_id: quotationId,
        quotation_version_no: newVersionNo,
        location_id: sourceVersion.location_id,
        range_id: sourceVersion.range_id,
        dwelling_type_id: sourceVersion.dwelling_type_id,
        floor_plan_id: sourceVersion.floor_plan_id,
        facade_id: sourceVersion.facade_id,
        is_approve: false,
        structure_engineer_id: sourceVersion.structure_engineer_id || null,
        structure_engineer_price: sourceVersion.structure_engineer_price || 0,
        sketch_number: sourceVersion.sketch_number || null,
        package_id: sourceVersion.package_id || null,
        facade_price: sourceVersion.facade_price || 0,
      }, { transaction: t });

      const newVersionId = newVersion.quotation_version_id;

      // Sync drive files
      const leadsId = sourceVersion.quotation?.leads_id;
      await syncQuotationVersionFiles(newVersion, leadsId, t);

      // 4. Copy quotation version items (Snapshots)
      const oldItems = await QuotationVersionItem.findAll({
        where: { quotation_version_id: versionId },
        transaction: t
      });

      if (oldItems.length > 0) {
        await QuotationVersionItem.bulkCreate(
          oldItems.map(item => {
            const itemJson = item.get({ plain: true });
            delete itemJson.quotation_version_item_id;
            delete itemJson.created_at;
            delete itemJson.updated_at;
            return {
              ...itemJson,
              quotation_version_id: newVersionId,
            };
          }),
          { transaction: t }
        );
      }

      // 5. Copy custom sections
      await db.sequelize.query(`
        INSERT INTO quotation_version_custom_section (
          quotation_version_id, file_url, sort_order, created_at, updated_at
        )
        SELECT $1, file_url, sort_order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM quotation_version_custom_section
        WHERE quotation_version_id = $2
      `, {
        bind: [newVersionId, versionId],
        type: db.sequelize.QueryTypes.INSERT,
        transaction: t,
      });

      // 6. Sync compaction report charge
      await syncCompactionReportCharge(sourceVersion.quotation?.leads_id, builderId, companyId, userId, t);

      // 7. Convert Lead to Opportunity (Negotiation)
      await leadsService.convertLeadToOpportunity(sourceVersion.quotation?.leads_id, null, builderId, companyId, "Negotiation", t);

      // 8. Log Activity
      await logActivity(t, {
        userId,
        leadsId: sourceVersion.quotation?.leads_id,
        module: "Quotation",
        moduleId: quotationId,
        recordName: sourceVersion.quotation?.reference_number,
        action: "CREATE",
        description: `Quotation version duplicated: Version ${newVersionNo}`,
      });

      // Fetch fully enriched new version
      const result = await quotationRepository.getQuotationVersionDetailsById(newVersionId, t);

      await t.commit();

      return {
        success: true,
        data: result,
        message: "Quotation version duplicated successfully",
      };
    } catch (error) {
      if (t) await t.rollback();
      console.error("DEBUG: Error in duplicateQuotationVersion service:", error);
      return { success: false, message: error.message };
    }
  }

  async deleteQuotation(quotationId, builderId, companyId, userId) {
    try {
      const { Quotation, Leads } = db.sequelize.models;
      const quotation = await Quotation.findOne({
        where: { quotation_id: quotationId },
        include: [{
          model: Leads,
          as: "lead",
          where: {
            [Op.or]: [
              { builder_id: builderId },
              ...(companyId ? [{ company_id: companyId }] : [])
            ]
          }
        }]
      });

      if (!quotation) {
        return { success: false, message: "Quotation not found or unauthorized" };
      }

      await checkLeadLockStatus(quotation.leads_id);
      const deleted = await quotationRepository.deleteQuotation(quotationId);

      await logActivity(null, {
        userId,
        leadsId: quotation.leads_id,
        module: "Quotation",
        moduleId: quotationId,
        recordName: "Quotation",
        action: "DELETE",
        description: "Quotation deleted",
      });

      return {
        success: true,
        data: deleted,
        message: "Quotation deleted successfully",
      };
    } catch (error) {
      console.error("DEBUG: Error in deleteQuotation service:", error);
      return { success: false, message: error.message };
    }
  }

  async getQuotationPDF(versionId, builderId, companyId) {
    try {
      const { QuotationVersion, Quotation, Leads } = db.sequelize?.models || db;

      // 1. Parallelize initial check and metadata fetch
      const [sourceVersion, versionDetails] = await Promise.all([
        QuotationVersion.findOne({
          where: { quotation_version_id: versionId },
          include: [{
            model: Quotation,
            as: "quotation",
            include: [{
              model: Leads,
              as: "lead",
              where: {
                [Op.or]: [
                  { builder_id: builderId },
                  ...(companyId ? [{ company_id: companyId }] : []),
                ],
              },
            }],
          }],
        }),
        quotationRepository.getQuotationVersionDetailsById(versionId)
      ]);

      if (!sourceVersion || !versionDetails) {
        return { success: false, message: "Quotation version not found or unauthorized" };
      }

      const fileName = `Quotation_v${versionDetails.quotationVersionNo}_${versionDetails.quotationId}.pdf`;

      // 2. Smart Retry Path: read the quotation report S3 key from DriveFile.
      // If not yet present, wait briefly for the background worker.
      let s3Key = await getQuotationDriveFileS3Key(
        versionId,
        DRIVE_FILE_MAPPING.SUB_REFERENCES.QUOTATION_REPORT,
      );
      if (!s3Key) {
        console.log(`[DEBUG] PDF not found for version ${versionId}, waiting for background worker...`);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s
        s3Key = await getQuotationDriveFileS3Key(
          versionId,
          DRIVE_FILE_MAPPING.SUB_REFERENCES.QUOTATION_REPORT,
        );
      }

      if (s3Key) {
        const presigned = await generatePresignedDownloadUrl(s3Key);
        return {
          success: true,
          data: {
            fileName,
            pdfUrl: presigned?.success ? presigned.url : `https://${env.AWS.S3_BUCKET_NAME}.s3.amazonaws.com/${s3Key}`,
            s3Key,
          },
        };
      }

      console.log(`[DEBUG] PDF still missing for ${versionId} after wait, starting sync generation...`);

      // Generate fresh PDF, upload to S3, save DriveFile + column FK
      const htmlContent = generateQuotationHTML(versionDetails);
      const pdfBuffer = await generatePDF(htmlContent);

      const newS3Key = `quotations/${versionId}/${fileName}`;
      const uploadResult = await uploadFile(newS3Key, pdfBuffer, "application/pdf");

      if (uploadResult.success) {
        await quotationRepository.updatePdfUrl(versionId, uploadResult.key, {
          size: pdfBuffer.length,
          originalName: fileName,
          builderId,
          companyId,
        });
      }

      const presigned = uploadResult.success ? await generatePresignedDownloadUrl(uploadResult.key) : null;
      return {
        success: true,
        data: {
          pdfBuffer,
          fileName,
          pdfUrl: presigned?.success ? presigned.url : uploadResult.success ? uploadResult.location : null,
          s3Key: uploadResult.success ? uploadResult.key : null,
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

  async sendQuotationEmail(versionId, userId, builderId, companyId) {
    try {
      const { QuotationVersion, Quotation, Leads } = db.sequelize.models;
      const version = await QuotationVersion.findOne({
        where: { quotation_version_id: versionId },
        include: [{
          model: Quotation,
          as: "quotation",
          include: [{
            model: Leads,
            as: "lead",
            where: {
              [Op.or]: [
                { builder_id: builderId },
                ...(companyId ? [{ company_id: companyId }] : [])
              ]
            }
          }]
        }]
      });

      if (!version) {
        return { success: false, message: "Quotation version not found or unauthorized" };
      }

      if (!version.quotation?.lead?.email) {
        return { success: false, message: "Customer email not available for this quotation" };
      }

      await quotationEmailQueue.add(
        { versionId, userId, builderId, companyId },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );

      return { success: true, message: "Quotation email is being processed and will be sent shortly" };
    } catch (error) {
      console.error("Error queuing quotation email:", error);
      return { success: false, message: error.message };
    }
  }

  async getQuotationByHash(hash) {
    try {
      const { quotationId, leadId } = decodeQuotationHash(hash);
      // pdf_url / signed_pdf_url now hold DriveFile UUIDs — resolve them to the
      // underlying s3_key via subqueries so the public response stays usable.
      const query = `
        SELECT q.quotation_id, q.reference_number,
               l.leads_id, l.name AS lead_name, l.email AS lead_email, l.phone AS lead_phone,
               (
                 SELECT json_agg(json_build_object(
                   'quotation_version_id', qv.quotation_version_id,
                   'quotation_version_no', qv.quotation_version_no,
                   'is_approve', qv.is_approve,
                   'esign_status', qv.esign_status,
                   'pdf_url', (SELECT df.s3_key FROM drive_files df WHERE df.reference_id = qv.quotation_version_id AND df.reference_type = 'QuotationVersion' AND df.sub_reference_type = 'QuotationReport' AND df.deleted_at IS NULL LIMIT 1),
                   'signed_pdf_url', (SELECT df.s3_key FROM drive_files df WHERE df.reference_id = qv.quotation_version_id AND df.reference_type = 'QuotationVersion' AND df.sub_reference_type = 'SignedQuotationReport' AND df.deleted_at IS NULL LIMIT 1),
                   'created_at', qv.created_at
                 ) ORDER BY qv.quotation_version_no DESC)
                 FROM quotation_version qv WHERE qv.quotation_id = q.quotation_id
               ) AS versions
        FROM quotation q
        JOIN leads l ON q.leads_id = l.leads_id
        WHERE q.quotation_id = :quotationId AND l.leads_id = :leadId
      `;
      const rows = await db.sequelize.query(query, {
        replacements: { quotationId, leadId },
        type: db.Sequelize.QueryTypes.SELECT
      });

      if (rows.length === 0) {
        return { success: false, message: "Quotation not found" };
      }

      const data = keysToCamelCase(rows[0]);
      const s3Prefix = `https://${env.AWS.S3_BUCKET_NAME}.s3.${env.AWS.AWS_REGION}.amazonaws.com/`;
      if (data.versions) {
        data.versions = data.versions.map(v => {
          const keysV = keysToCamelCase(v);
          if (keysV.pdfUrl && !keysV.pdfUrl.startsWith("http")) {
            keysV.pdfUrl = `${s3Prefix}${keysV.pdfUrl}`;
          }
          if (keysV.signedPdfUrl && !keysV.signedPdfUrl.startsWith("http")) {
            keysV.signedPdfUrl = `${s3Prefix}${keysV.signedPdfUrl}`;
          }
          return keysV;
        });
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, message: "Invalid or expired link" };
    }
  }

  async compareQuotationVersions(leadsId, versions, showAll, builderId, companyId) {
    try {
      const { QuotationVersion, Quotation, Leads, PropertyDetail, State } = db.sequelize?.models || db;
      const versionId1 = versions[0].version_id;
      const quotationId1 = versions[0].quotation_id;
      const versionId2 = versions[1].version_id;
      const quotationId2 = versions[1].quotation_id;

      // 1. Ownership and sanity checks for both versions
      const checkResults = await QuotationVersion.findAll({
        where: { quotation_version_id: { [Op.in]: [versionId1, versionId2] } },
        include: [{
          model: Quotation,
          as: "quotation",
          include: [{
            model: Leads,
            as: "lead",
            where: {
              leads_id: leadsId,
              [Op.or]: [
                { builder_id: builderId },
                ...(companyId ? [{ company_id: companyId }] : []),
              ],
            },
          }],
        }],
      });

      if (checkResults.length < 2 && versionId1 !== versionId2) {
        return { success: false, message: "One or both quotation versions not found or unauthorized for this lead" };
      }

      const v1Row = checkResults.find(r => r.quotation_version_id === versionId1);
      const v2Row = checkResults.find(r => r.quotation_version_id === versionId2);

      if (!v1Row || !v2Row) {
        return { success: false, message: "Could not find matching version data" };
      }

      const v1Quotation = v1Row.quotation;
      const v2Quotation = v2Row.quotation;

      if (v1Quotation?.quotation_id !== quotationId1 || v2Quotation?.quotation_id !== quotationId2) {
        return { success: false, message: "Version does not belong to the specified quotation" };
      }

      // 2. Fetch property details
      const fetchPropertyDetails = async (propertyDetailId) => {
        if (!propertyDetailId) {
          return null;
        }
        const pd = await PropertyDetail.findByPk(propertyDetailId, {
          include: [{ model: State, as: "state" }],
        });
        if (pd) {
          return {
            lotNumber: pd.lot_number,
            street: pd.street,
            addressLine1: pd.address_line1,
            city: pd.city,
            state: pd.state?.name,
            zipCode: pd.zip_code,
          };
        }
        return null;
      };

      const [propertyAddress1, propertyAddress2] = await Promise.all([
        fetchPropertyDetails(v1Quotation?.lead?.property_detail_id || v1Row.property_detail_id),
        fetchPropertyDetails(v2Quotation?.lead?.property_detail_id || v2Row.property_detail_id),
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

      // 4. Build items array using unified items structure
      const items = [];

      // 4a. Floor Plan
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

      // 4b. Facade
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

      // 4c. Unified items comparison using quotation_version_items
      const allItemKeys = new Set();

      // Collect all unique item identifiers from both versions
      data1.items.forEach(item => {
        if (item.itemType === 'package' && item.packageId) {
          allItemKeys.add(`package_${item.packageId}`);
        } else if (item.itemType === 'item' && item.priceListItemId) {
          allItemKeys.add(`item_${item.priceListItemId}`);
        }
      });

      data2.items.forEach(item => {
        if (item.itemType === 'package' && item.packageId) {
          allItemKeys.add(`package_${item.packageId}`);
        } else if (item.itemType === 'item' && item.priceListItemId) {
          allItemKeys.add(`item_${item.priceListItemId}`);
        }
      });

      for (const itemKey of allItemKeys) {
        const [type, id] = itemKey.split('_');

        // Skip if key is malformed
        if (!type || !id || (type !== 'package' && type !== 'item')) {
          continue;
        }

        const v1Item = data1.items.find(item => {
          if (type === 'package') {
            return item.itemType === 'package' && item.packageId === id;
          } else {
            return item.itemType === 'item' && item.priceListItemId === id;
          }
        });
        const v2Item = data2.items.find(item => {
          if (type === 'package') {
            return item.itemType === 'package' && item.packageId === id;
          } else {
            return item.itemType === 'item' && item.priceListItemId === id;
          }
        });

        const refItem = v1Item || v2Item;

        // Skip if no reference item found
        if (!refItem) {
          continue;
        }

        if (type === 'package') {
          // Package comparison
          const row = {
            type: "package",
            name: refItem.packageName || "-",
            packageId: refItem.packageId,
            version1Value: v1Item ? v1Item.packageCost : null,
            version2Value: v2Item ? v2Item.packageCost : null,
          };

          if (showAll || row.version1Value !== row.version2Value) {
            items.push(row);
          }
        } else {
          // Individual item comparison
          const row = {
            type: "pricelist_item",
            name: refItem.priceListItemDescription || refItem.packageName || "-",
            priceListItemId: refItem.priceListItemId,
            priceListId: refItem.priceListId,
            priceListName: refItem.priceListName,
            itemCost: refItem.priceListItemCost,
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
      const { QuotationVersion, Quotation, Leads } = db.sequelize?.models || db;

      // Verify the version belongs to a lead the user can access
      const sourceVersion = await QuotationVersion.findOne({
        where: { quotation_version_id: versionId },
        include: [{
          model: Quotation,
          as: "quotation",
          include: [{
            model: Leads,
            as: "lead",
            where: {
              [Op.or]: [
                { builder_id: builderId },
                ...(companyId ? [{ company_id: companyId }] : []),
              ],
            },
          }],
        }],
      });

      if (!sourceVersion) {
        return { success: false, message: "Quotation version not found or unauthorized" };
      }

      const existingVersion = sourceVersion;

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
      await logActivity(null, {
        userId,
        leadsId: sourceVersion.quotation?.leads_id,
        module: "Quotation",
        moduleId: versionId,
        recordName: sourceVersion.quotation?.reference_number,
        action: "UPDATE",
        description: "Package removed from quotation version",
      });

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

  async uploadStructureEngineerReport(versionId, reportUrl, builderId, companyId, userId, options = {}) {
    try {
      const { QuotationVersion, Quotation, Leads } = db.sequelize?.models || db;
      const { isExternal = false } = options;

      // External token-authenticated callers (e.g. structural engineers
      // uploading via the emailed link) have no user/builder context, so the
      // request is already authorized upstream by validateExternalToken and we
      // skip the ownership filter on the lead.
      const leadInclude = { model: Leads, as: "lead" };
      if (!isExternal) {
        const orClauses = [];
        if (builderId) orClauses.push({ builder_id: builderId });
        if (companyId) orClauses.push({ company_id: companyId });
        if (orClauses.length > 0) {
          leadInclude.where = { [Op.or]: orClauses };
        }
      }

      // 1. Fetch version and verify ownership (skipped for external requests)
      const existingVersion = await QuotationVersion.findOne({
        where: { quotation_version_id: versionId },
        include: [{
          model: Quotation,
          as: "quotation",
          include: [leadInclude],
        }],
      });

      if (!existingVersion) {
        return { success: false, message: "Quotation version not found or unauthorized" };
      }

      // Check lock status
      await checkLeadLockStatus(existingVersion.quotation?.leads_id);

      // Per the DriveFile blueprint we no longer write
      // structure_engineer_report on the QuotationVersion row. The DriveFile
      // (sub_reference_type=StructureEngineerReport) is upserted by the
      // controller before this service runs, and its upsert overwrites the
      // s3_key in place when an existing record is found. We only flip
      // is_uploaded here.
      existingVersion.is_uploaded = true;
      await existingVersion.save();

      // Log activity
      await logActivity(null, {
        userId,
        leadsId: existingVersion.quotation?.leads_id,
        module: "Quotation",
        moduleId: versionId,
        recordName: existingVersion.quotation?.reference_number,
        action: "UPDATE",
        description: "Structure engineer report PDF uploaded to quotation version",
      });

      return {
        success: true,
        data: {
          quotation_version_id: versionId,
          structure_engineer_report: reportUrl,
        },
        message: "Structure engineer report PDF uploaded successfully",
      };
    } catch (error) {
      console.error("Error in uploadStructureEngineerReport service:", error);
      return { success: false, message: error.message };
    }
  }

  async getPublicDetailsByVersionId(versionId) {
    // Query path: QuotationVersion -> Quotation -> Leads -> [Builder, PropertyDetail]
    const version = await db.QuotationVersion.findOne({
      where: { quotation_version_id: versionId },
      attributes: ["quotation_version_id", "is_uploaded"],
      include: [
        {
          model: db.Quotation,
          as: "quotation",
          required: true,
          include: [
            {
              model: db.Leads,
              as: "lead",
              required: true,
              include: [
                { model: db.Builder, as: "builder", attributes: ["name"] },
                { model: db.PropertyDetail, attributes: ["lot_number", "street", "city", "zip_code", "estate_name", "address_line1", "address_line2"], as: "propertyDetail" },
              ],
            },
          ],
        },
      ],
    });

    if (!version) {
      const error = new Error("Quotation version not found");
      error.status = 404;
      throw error;
    }

    const lead = version.quotation?.lead;
    return {
      success: true,
      data: {
        builder_name: lead?.builder?.name || null,
        property_details: lead?.propertyDetail || null,
        is_uploaded: version.is_uploaded,
      },
      message: "Public quotation version details retrieved successfully",
    };
  }
}

export default new QuotationService();
