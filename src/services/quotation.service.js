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

      const client = await getPool().connect();
      try {
        await client.query('BEGIN');

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

        // Insert new Quotation
        const insertQuotationQuery = `
          INSERT INTO quotation (leads_id, reference_number, created_by)
          VALUES ($1, $2, $3)
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
            sketch_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NULL)
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
        ]);
        const quotationVersion = versionResult.rows[0];

        if (latestVersion) {
          // Copy Package Maps
          await client.query(`
            INSERT INTO quotation_version_package_map (quotation_version_id, package_id)
            SELECT $1, package_id
            FROM quotation_version_package_map
            WHERE quotation_version_id = $2
          `, [quotationVersion.quotation_version_id, latestVersion.quotation_version_id]);

          // Copy Pricelist Item Maps
          await client.query(`
            INSERT INTO quotation_version_pricelist_item_map (quotation_version_id, price_list_item_id, quantity, note, total_price)
            SELECT $1, price_list_item_id, quantity, note, total_price
            FROM quotation_version_pricelist_item_map
            WHERE quotation_version_id = $2
          `, [quotationVersion.quotation_version_id, latestVersion.quotation_version_id]);
          
          // Note: we can copy custom sections similarly if they apply to the new quotation's version
          await client.query(`
            INSERT INTO quotation_version_custom_section (quotation_version_id, file_url, sort_order)
            SELECT $1, file_url, sort_order
            FROM quotation_version_custom_section
            WHERE quotation_version_id = $2
          `, [quotationVersion.quotation_version_id, latestVersion.quotation_version_id]);
        }

        await client.query('COMMIT');

        // Fetch fully enriched version to include lead and contact details mapping
        const enrichedVersion = await quotationRepository.getQuotationVersionDetailsById(quotationVersion.quotation_version_id);

        // Format result like original response
        const { keysToCamelCase } = require("../utils/common");
        
        const formattedQuotation = keysToCamelCase(quotation);
        formattedQuotation.versions = enrichedVersion ? [enrichedVersion] : [keysToCamelCase(quotationVersion)];

        return {
          success: true,
          data: formattedQuotation,
          message: "Quotation created successfully",
        };
      } catch (innerError) {
        await client.query('ROLLBACK');
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

      // Block updates to older versions (only the latest version can be updated)
      const currentMaxVersion = await quotationRepository.getLatestQuotationVersionNo(existingVersion.quotation_id);
      if (existingVersion.quotation_version_no !== currentMaxVersion) {
        return {
          success: false,
          message: "Only the latest quotation version can be updated",
        };
      }

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
        // Set facade_id and floor_plan_id to NULL only if not explicitly updating them right now
        if (updateData.facade_id === undefined) updateData.facade_id = null;
        if (updateData.floor_plan_id === undefined) updateData.floor_plan_id = null;

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

  async duplicateQuotationVersion(versionId, builderId, companyId) {
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

      await client.query('BEGIN');

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
          sketch_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NULL)
        RETURNING quotation_version_id
      `;
      const insertVersionValues = [
        quotationId,
        newVersionNo,
        sourceVersion.location_id,
        sourceVersion.range_id,
        sourceVersion.dwelling_type_id,
        sourceVersion.floor_plan_id,
        sourceVersion.facade_id
      ];
      
      const newVersionResult = await client.query(insertVersionQuery, insertVersionValues);
      const newVersionId = newVersionResult.rows[0].quotation_version_id;

      // 4. Copy package maps
      await client.query(`
        INSERT INTO quotation_version_package_map (quotation_version_id, package_id)
        SELECT $1, package_id 
        FROM quotation_version_package_map 
        WHERE quotation_version_id = $2
      `, [newVersionId, versionId]);

      // 5. Copy pricelist item maps
      await client.query(`
        INSERT INTO quotation_version_pricelist_item_map (
          quotation_version_id, price_list_item_id, quantity, note, total_price
        )
        SELECT $1, price_list_item_id, quantity, note, total_price
        FROM quotation_version_pricelist_item_map
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

      await client.query('COMMIT');

      // Fetch the full newly created version using repository to return all enriched fields
      const enrichedNewVersion = await quotationRepository.getQuotationVersionDetailsById(newVersionId);

      return {
        success: true,
        data: enrichedNewVersion,
        message: "Quotation version duplicated successfully",
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("DEBUG: Error in duplicateQuotationVersion service:", error);
      return {
        success: false,
        message: error.message,
      };
    } finally {
      client.release();
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

  async compareQuotationVersions(quotationId, versionId1, versionId2, showAll, builderId, companyId) {
    try {
      const client = getPool();

      // 1. Ownership check — verify quotation belongs to builder/company via lead
      const checkQuery = `
        SELECT q.quotation_id, q.reference_number, l.leads_id, l.lot_id
        FROM quotation q
        JOIN leads l ON q.leads_id = l.leads_id
        WHERE q.quotation_id = $1 AND (l.builder_id = $2 OR (l.company_id = $3 AND $3 IS NOT NULL))
      `;
      const checkResult = await client.query(checkQuery, [quotationId, builderId, companyId]);

      if (checkResult.rowCount === 0) {
        return { success: false, message: "Quotation not found or unauthorized" };
      }

      const quotationRow = checkResult.rows[0];
      const lotId = quotationRow.lot_id;

      // 2. Validate both versions belong to this quotation
      const versionsCheck = await client.query(
        `SELECT quotation_version_id, quotation_id FROM quotation_version 
         WHERE quotation_version_id IN ($1, $2)`,
        [versionId1, versionId2]
      );

      if (versionsCheck.rowCount < 2) {
        return { success: false, message: "One or both quotation versions not found" };
      }

      const allBelongToQuotation = versionsCheck.rows.every(
        r => r.quotation_id === quotationId
      );
      if (!allBelongToQuotation) {
        return { success: false, message: "Both versions must belong to the same quotation" };
      }

      // 3. Fetch property address from lot
      let propertyAddress = null;
      if (lotId) {
        const lotResult = await client.query(
          `SELECT lot.lot_number, lot.street, lot.city, lot.zip_code,
                  s.name as state_name
           FROM lot
           LEFT JOIN state s ON lot.state_id = s.state_id
           WHERE lot.lot_id = $1`,
          [lotId]
        );
        if (lotResult.rowCount > 0) {
          const lot = lotResult.rows[0];
          propertyAddress = {
            lotNumber: lot.lot_number,
            street: lot.street,
            city: lot.city,
            state: lot.state_name,
            zipCode: lot.zip_code,
          };
        }
      }

      // 4. Fetch comparison data for both versions
      const [data1, data2] = await Promise.all([
        quotationRepository.getVersionComparisonData(versionId1),
        quotationRepository.getVersionComparisonData(versionId2),
      ]);

      if (!data1 || !data2) {
        return { success: false, message: "Could not fetch version comparison data" };
      }

      // 5. Build items array
      const items = [];

      // 5a. Packages — union by package_id
      const allPackageIds = new Set([
        ...data1.packages.map(p => p.packageId),
        ...data2.packages.map(p => p.packageId),
      ]);

      for (const pkgId of allPackageIds) {
        const v1Pkg = data1.packages.find(p => p.packageId === pkgId);
        const v2Pkg = data2.packages.find(p => p.packageId === pkgId);

        const row = {
          type: "package",
          name: (v1Pkg || v2Pkg).packageName,
          packageId: pkgId,
          version1Value: v1Pkg ? v1Pkg.packageCost : null,
          version2Value: v2Pkg ? v2Pkg.packageCost : null,
        };

        if (showAll || row.version1Value !== row.version2Value) {
          items.push(row);
        }
      }

      // 5b. Facade
      const facadeRow = {
        type: "facade",
        name: data1.version.facadeName || data2.version.facadeName || "-",
        version1Value: data1.version.facadeName || "-",
        version2Value: data2.version.facadeName || "-",
      };
      if (showAll || facadeRow.version1Value !== facadeRow.version2Value) {
        items.push(facadeRow);
      }

      // 5c. Pricelist items — union by price_list_item_id
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
          referenceNumber: quotationRow.reference_number,
          propertyAddress,
          version1: {
            quotationVersionId: data1.version.quotationVersionId,
            quotationVersionNo: data1.version.quotationVersionNo,
            grandTotalCost: data1.version.grandTotalCost,
          },
          version2: {
            quotationVersionId: data2.version.quotationVersionId,
            quotationVersionNo: data2.version.quotationVersionNo,
            grandTotalCost: data2.version.grandTotalCost,
          },
          items,
        },
        message: "Quotation versions compared successfully",
      };
    } catch (error) {
      console.error("DEBUG: Error in compareQuotationVersions service:", error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new QuotationService();
