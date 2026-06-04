import { Op, fn, col, literal, QueryTypes } from "sequelize";
import db from "../../config/database/models/postgre-models/index.js";
import quotationService from "../quotation/quotation.service.js";
import { generateDynamicReferenceNumber, keysToCamelCase, formatCamelCaseToReadable } from "../../utils/common.js";
import { checkLeadLockStatus } from "../../helper/leadLock.helper.js";
import { orderTaskFields } from "../task/task.service.js";
import { DRIVE_FILE_MAPPING } from "../../constants/driveFile.js";
import { env } from "../../config/env.config.js";
import welcomeEmailQueue from "../../workers/welcomeEmailWorker.js";

class LeadsService {
  async createLead(leadData, userId, builderId, companyId, forceCreate = false) {
    const t = await db.sequelize.transaction();
    try {
      const { Leads, SalesModuleSettings, LeadSource, Role, Users, LeadsContactMap, Address } = db;

      // 1. Fetch sales module settings
      const settings = await SalesModuleSettings.findOne({
        where: { builder_id: builderId, company_id: companyId },
        transaction: t,
      });

      const leadMandatoryOption = settings?.lead_mandatory_option || "email_and_phone";

      if (!leadData.name) throw new Error("Name is required");

      const emailProvided = !!(leadData.email && leadData.email.trim());
      const phoneProvided = !!(leadData.phone && leadData.phone.trim());

      switch (leadMandatoryOption) {
        case "email_and_phone":
          if (!emailProvided || !phoneProvided) throw new Error("Email and Phone are required");
          break;
        case "either_email_or_phone":
          if (!emailProvided && !phoneProvided) throw new Error("Either Email or Phone must be provided");
          break;
        case "email_not_mandatory":
          if (!phoneProvided) throw new Error("Phone is required");
          break;
        case "phone_not_mandatory":
          if (!emailProvided) throw new Error("Email is required");
          break;
      }

      // 2. Duplicate check
      const existingLead = await Leads.findOne({
        where: {
          email: leadData.email,
          [Op.or]: [{ builder_id: builderId }, { company_id: companyId }],
        },
        transaction: t,
      });

      if (existingLead) {
        const allowDuplicateLeads = settings?.allow_duplicate_leads || false;
        if (!allowDuplicateLeads || !forceCreate) {
          await t.rollback();
          return {
            success: false,
            emailExists: true,
            message: !allowDuplicateLeads
              ? "A lead with this email already exists. Duplicate leads are disabled in settings."
              : "A lead with this email already exists",
            existingLead: keysToCamelCase(existingLead.get({ plain: true })),
          };
        }
      }

      // 3. Reference Number
      let referenceNumber = leadData.reference_number;
      if (!referenceNumber) {
        const year = new Date().getFullYear().toString();
        const base = `LD${year}`;
        const maxRef = await Leads.max("reference_number", {
          where: {
            builder_id: builderId,
            company_id: companyId,
            reference_number: { [Op.iLike]: `${base}%` },
          },
          transaction: t,
        });
        const nextNo = maxRef ? parseInt(maxRef.replace(base, ""), 10) + 1 : 1;
        referenceNumber = `${base}${String(nextNo).padStart(4, "0")}`;
      }

      // 4. Create Lead
      const lead = await Leads.create({
        ...leadData,
        reference_number: referenceNumber,
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
        send_letter: !!(leadData.send_letter === true || leadData.send_letter === "true"),
      }, { transaction: t });

      // 5. Contact Mapping
      const contactRole = await Role.findOne({ where: { name: "Contact" }, transaction: t });

      if (contactRole && leadData.email) {
        const [contactUser] = await Users.findOrCreate({
          where: { email: leadData.email, builder_id: builderId, is_deleted: false },
          defaults: {
            name: leadData.name,
            phone: leadData.phone,
            role_id: contactRole.role_id,
            is_active: true,
          },
          transaction: t,
        });

        await LeadsContactMap.findOrCreate({
          where: { leads_id: lead.leads_id, contact_id: contactUser.users_id },
          transaction: t,
        });
      }

      // 6. HLP Sync
      if (leadData.house_land_package_id) {
        await this.syncPropertyDetailFromHLP(lead.leads_id, leadData.house_land_package_id, t);
        await quotationService.syncQuotationFromHLP(lead.leads_id, leadData.house_land_package_id, userId, builderId, companyId, t);
      }

      // 7. Fetch populated for response parity
      const populated = await Leads.findByPk(lead.leads_id, {
        include: [
          { model: LeadSource, as: "leadSource", attributes: ["name"] },
          {
            model: LeadsContactMap,
            as: "contactMaps",
            include: [{
              model: Users,
              as: "contact",
              include: [{ model: Address, as: "address", attributes: ["city", "state_id", "zip_code", "country_id", "address_line1", "address_line2"] }]
            }],
          },
        ],
        transaction: t,
      });

      const l = populated.get({ plain: true });
      const resultData = {
        ...keysToCamelCase(l),
        leadSourceName: l.leadSource?.name || null,
        leadContacts: (l.contactMaps || []).map(map => ({
          id: map.id,
          usersId: map.contact?.users_id,
          name: map.contact?.name,
          email: map.contact?.email,
          phone: map.contact?.phone,
          address: {
            city: map.contact?.address?.city || null,
            stateId: map.contact?.address?.state_id || null,
            zipCode: map.contact?.address?.zip_code || null,
            countryId: map.contact?.address?.country_id || null,
            addressLine1: map.contact?.address?.address_line1 || null,
            addressLine2: map.contact?.address?.address_line2 || null,
          },
        })),
      };

      await t.commit();

      welcomeEmailQueue.add(
        "welcomeEmail",
        { leadsId: lead.leads_id, builderId, companyId, userId },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: true },
      ).catch((err) => console.error("Error adding welcome email job:", err));

      return { success: true, data: resultData, message: "Lead created successfully" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async createPublicLead(leadData, builderId, companyId, featurFacadeId) {
    const { LeadSource, FeaturedFacadeLead } = db;
    let leadSource = await LeadSource.findOne({
      where: {
        name: { [Op.iLike]: "Inbuildify Website" },
        builder_id: builderId,
      },
    });

    if (!leadSource) {
      leadSource = await LeadSource.create({
        name: "Inbuildify Website",
        builder_id: builderId,
        company_id: companyId || null,
        is_active: true,
        allow_change: false,
        sort_order: 1,
      });
    }

    const result = await this.createLead(
      { ...leadData, lead_source_id: leadSource.lead_source_id },
      null,
      builderId,
      companyId || null,
      false,
    );

    let targetLeadsId = null;
    if (result.success) {
      targetLeadsId = result.data.leadsId;
    } else if (result.emailExists && result.existingLead) {
      targetLeadsId = result.existingLead.leadsId;
    }

    if (targetLeadsId && featurFacadeId) {
      try {
        const featuredFacadeLead = await FeaturedFacadeLead.create({
          leads_id: targetLeadsId,
          company_id: companyId || null,
          featur_facade_id: featurFacadeId,
        });
        if (result.success) {
          result.data.featuredFacadeLead = keysToCamelCase(featuredFacadeLead.get({ plain: true }));
        } else {
          result.featuredFacadeLead = keysToCamelCase(featuredFacadeLead.get({ plain: true }));
        }
      } catch (error) {
        console.error("Error saving to FeaturedFacadeLead:", error.message);
        // We don't fail the whole request if this optional step fails
      }
    }

    return result;
  }

  async getAllLeads(builderId, companyId, filters = {}) {
    try {
      const { page = 1, limit = 25, status, rating, lead_source_id, client_type_id, region_id, assignee_id, search, email, created_at, sort_by = "created_at", sort_order = "desc" } = filters;
      const offset = (page - 1) * limit;

      const where = {
        [Op.or]: [{ builder_id: builderId }, { company_id: companyId }],
      };

      if (created_at) {
        const now = new Date();
        let start;
        let end;
        switch (created_at.toLowerCase()) {
          case "last_15_minutes": start = new Date(now.getTime() - 15 * 60 * 1000); break;
          case "last_1_hour": start = new Date(now.getTime() - 60 * 60 * 1000); break;
          case "last_2_hours": start = new Date(now.getTime() - 2 * 60 * 60 * 1000); break;
          case "last_24_hours": start = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
          case "today": start = new Date(now.setHours(0, 0, 0, 0)); break;
          case "yesterday":
            start = new Date(new Date().setHours(0, 0, 0, 0) - 24 * 60 * 60 * 1000);
            end = new Date(new Date().setHours(0, 0, 0, 0));
            break;
          case "last_7_days": start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
          case "last_15_days": start = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); break;
          case "last_30_days": start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        }
        if (start) {
          where.created_at = end ? { [Op.gte]: start, [Op.lt]: end } : { [Op.gte]: start };
        }
      }

      if (status) {
        where[Op.or] = [
          { status },
          literal(`EXISTS (SELECT 1 FROM opportunity WHERE opportunity.leads_id = "Leads"."leads_id" AND opportunity.status = '${status}')`)
        ];
      }

      if (rating?.length) where.rating = { [Op.in]: rating };
      if (lead_source_id?.length) where.lead_source_id = { [Op.in]: lead_source_id };
      if (client_type_id) where.client_type_id = client_type_id;
      if (region_id) where.region_id = region_id;
      if (assignee_id?.length) where.assignee_id = { [Op.in]: assignee_id };
      if (email) where.email = email;

      if (search) {
        const s = `%${search}%`;
        where[Op.or] = [
          { name: { [Op.iLike]: s } },
          { email: { [Op.iLike]: s } },
          { phone: { [Op.iLike]: s } },
        ];
      }

      const { rows, count } = await db.Leads.findAndCountAll({
        where,
        attributes: {
          include: [
            [literal(`(SELECT status FROM opportunity WHERE leads_id = "Leads"."leads_id" LIMIT 1)`), "opportunityStatus"],
            [literal(`(SELECT out_come FROM opportunity WHERE leads_id = "Leads"."leads_id" LIMIT 1)`), "opportunityOutcome"],
            [literal(`(SELECT j.job_id FROM job j JOIN opportunity o ON j.opportunity_id = o.opportunity_id WHERE o.leads_id = "Leads"."leads_id" LIMIT 1)`), "jobId"]
          ]
        },
        include: [
          { model: db.LeadSource, as: "leadSource", attributes: ["name"] },
          { model: db.PropertyDetail, as: "propertyDetail", include: [{ model: db.State, as: "state", attributes: ["name"] }] },
          { model: db.ClientType, as: "clientType", attributes: ["client_type"] },
          { model: db.State, as: "state", attributes: ["name"] },
          { model: db.Users, as: "assignee", attributes: ["name"] },
          { model: db.Users, as: "createdByUser", attributes: ["name"] },
          { model: db.Users, as: "updatedByUser", attributes: ["name"] },
          {
            model: db.LeadsContactMap,
            as: "contactMaps",
            include: [{ model: db.Users, as: "contact", attributes: ["users_id", "name", "email", "phone"] }]
          }
        ],
        order: [[sort_by || "created_at", sort_order || "DESC"], ["updated_at", "DESC"], ["reference_number", "DESC"]],
        limit,
        offset,
        distinct: true,
      });

      const leads = rows.map(item => {
        const l = item.get({ plain: true });

        return {
          leadsId: l.leads_id,
          referenceNumber: l.reference_number,
          companyId: l.company_id,
          builderId: l.builder_id,
          name: l.name,
          email: l.email,
          phone: l.phone,
          notes: l.notes,
          sendLetter: l.send_letter,
          status: l.status,
          createdBy: l.created_by,
          updatedBy: l.updated_by,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
          createdByName: l.createdByUser?.name || null,
          updatedByName: l.updatedByUser?.name || null,
          opportunityStatus: l.opportunityStatus || null,
          opportunityOutcome: l.opportunityOutcome || null,
          jobId: l.jobId || null,
        };
      });

      return {
        success: true,
        data: {
          leads,
        },
        message: "Leads fetched successfully"
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getLeadById(leadId, builderId, companyId) {
    try {
      const orConditions = [];
      if (builderId) orConditions.push({ builder_id: builderId });
      if (companyId) orConditions.push({ company_id: companyId });

      const lead = await db.Leads.findOne({
        where: {
          leads_id: leadId,
          [Op.or]: orConditions.length ? orConditions : [{ leads_id: null }],
        },
        include: [
          { model: db.LeadSource, as: "leadSource", attributes: ["name"] },
          { model: db.ClientType, as: "clientType", attributes: ["client_type"] },
          { model: db.State, as: "state", attributes: ["name"] },
          { model: db.HouseLandPackage, as: "houseLandPackage", attributes: ["title"] },
          { model: db.Users, as: "assignee", attributes: ["name"] },
          { model: db.Users, as: "createdByUser", attributes: ["name"] },
          { model: db.Users, as: "updatedByUser", attributes: ["name"] },
          {
            model: db.LeadsContactMap,
            as: "contactMaps",
            include: [{ model: db.Users, as: "contact", attributes: ["name", "email", "phone"] }],
          },
          {
            model: db.PropertyDetail,
            as: "propertyDetail",
            include: [
              {
                model: db.Lot,
                as: "lot",
                include: [
                  { model: db.State, as: "state", attributes: ["name"] },
                  { model: db.Estate, as: "estate", attributes: ["name"] },
                  { model: db.EstateStages, as: "estateStage", attributes: ["name"] },
                ],
              },
            ],
          },
          {
            model: db.Quotation,
            as: "quotations",
            include: [
              {
                model: db.QuotationVersion,
                as: "versions",
                include: [
                  {
                    model: db.QuotationVersionPricelistItemMap,
                    as: "pricelistItemMaps",
                    include: [{ model: db.PriceListItem, as: "priceListItem", attributes: ["item_description"] }],
                  },
                  { model: db.QuotationVersionCustomSection, as: "customSections" },
                  { model: db.Package, as: "package", attributes: ["package_id", "name", "cost"] },
                ],
              },
            ],
          },
          { model: db.BusinessContact, as: "businessContacts" },
          { model: db.Invoice, as: "invoices" },
          { model: db.Opportunity, as: "opportunities" },
        ],
        order: [
          [{ model: db.Quotation, as: "quotations" }, "created_at", "DESC"],
          [{ model: db.Quotation, as: "quotations" }, { model: db.QuotationVersion, as: "versions" }, "quotation_version_no", "DESC"],
          [{ model: db.Quotation, as: "quotations" }, { model: db.QuotationVersion, as: "versions" }, { model: db.QuotationVersionCustomSection, as: "customSections" }, "sort_order", "ASC"],
          [{ model: db.Invoice, as: "invoices" }, "created_at", "DESC"],
        ],
      });

      if (!lead) return { success: false, message: "Lead not found" };

      const p = lead.get({ plain: true });
      const resultData = {
        ...keysToCamelCase(p),
        leadSourceName: p.leadSource?.name || null,
        clientTypeName: p.clientType?.client_type || null,
        regionName: p.state?.name || null,
        houseLandPackageName: p.houseLandPackage?.title || null,
        assigneeName: p.assignee?.name || null,
        createdByName: p.createdByUser?.name || null,
        updatedByName: p.updatedByUser?.name || null,
        leadContacts: (p.contactMaps || []).map(lcm => ({
          id: lcm.id,
          contactId: lcm.contact_id,
          name: lcm.contact?.name || null,
          email: lcm.contact?.email || null,
          phone: lcm.contact?.phone || null,
        })),
        lotDetails: p.propertyDetail?.lot ? {
          ...keysToCamelCase(p.propertyDetail.lot),
          stateName: p.propertyDetail.lot.state?.name || null,
          estateName: p.propertyDetail.lot.estate?.name || null,
          estateStageName: p.propertyDetail.lot.estateStage?.name || null,
        } : null,
        houseLandPackageDetails: p.houseLandPackage ? {
          houseLandPackageId: p.house_land_package_id,
          title: p.houseLandPackage.title,
          lotId: p.lot_id,
          facadeId: p.facade_id,
          floorPlanId: p.floor_plan_id,
          attachFiles: p.attach_files,
        } : null,
        quotations: (p.quotations || []).map(q => ({
          quotationId: q.quotation_id,
          referenceNumber: q.reference_number,
          createdAt: q.created_at,
          versions: (q.versions || []).map(qv => {
            const totalPackageCost = parseFloat(qv.package?.cost || 0);
            const totalPricelistCost = (qv.pricelistItemMaps || []).reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);
            return {
              ...keysToCamelCase(qv),
              totalPackageCost,
              totalPricelistCost,
              grandTotalCost: totalPackageCost + totalPricelistCost,
              package: qv.package ? { packageId: qv.package.package_id, packageName: qv.package.name } : null,
              pricelistItemMaps: (qv.pricelistItemMaps || []).map(qpim => ({
                id: qpim.id,
                priceListItemId: qpim.price_list_item_id,
                itemName: qpim.priceListItem?.item_description || null,
                quantity: qpim.quantity,
                note: qpim.note,
                totalPrice: qpim.total_price,
              })),
              customSections: (qv.customSections || []).map(qcs => ({
                customSectionId: qcs.custom_section_id,
                fileUrl: qcs.file_url,
                sortOrder: qcs.sort_order,
              })),
            };
          }),
        })),
        businessContacts: (p.businessContacts || []).map(bc => keysToCamelCase(bc)),
        invoices: (p.invoices || []).map(inv => keysToCamelCase(inv)),
        opportunityStatus: p.opportunities?.[0]?.status || null,
        opportunityId: p.opportunities?.[0]?.opportunity_id || null,
      };

      return { success: true, data: resultData, message: "Lead fetched successfully" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Aggregate every active DriveFile linked to a lead — directly (lead_id) or
   * polymorphically through its PropertyDetail and QuotationVersions — and
   * shape them into the hierarchical folder tree the frontend renders:
   *
   *   Documents
   *   ├─ Compaction Report        (CompactionReport)
   *   └─ Quotation
   *      └─ <QT reference no.>     (one per quotation that has files)
   *         ├─ Quotation Report    (QuotationReport, SignedQuotationReport)
   *         ├─ Engineering Requirement (EngineeringRequirement, StructureEngineerReport, StructureEngineerUpload)
   *         ├─ Floor Plan          (FloorPlanSimpleImage, FloorPlanDetailedImage)
   *         └─ Facade              (FacadeImage)
   */
  async getLeadDocuments(leadId, builderId, companyId) {
    try {
      const SUB = DRIVE_FILE_MAPPING.SUB_REFERENCES;

      const orConditions = [];
      if (builderId) orConditions.push({ builder_id: builderId });
      if (companyId) orConditions.push({ company_id: companyId });

      // 1. Lead (scoped to caller) with its property + quotations -> versions.
      const lead = await db.Leads.findOne({
        where: {
          leads_id: leadId,
          [Op.or]: orConditions.length ? orConditions : [{ leads_id: null }],
        },
        attributes: ["leads_id", "property_detail_id"],
        include: [
          {
            model: db.Quotation,
            as: "quotations",
            attributes: ["quotation_id", "reference_number", "created_at"],
            include: [
              { model: db.QuotationVersion, as: "versions", attributes: ["quotation_version_id"] },
            ],
          },
        ],
        order: [[{ model: db.Quotation, as: "quotations" }, "created_at", "ASC"]],
      });

      if (!lead) return { success: false, message: "Lead not found" };

      // 2. Collect every reference id + a version -> quotation lookup so version
      //    scoped files can be grouped under their parent quotation folder.
      const propertyDetailId = lead.property_detail_id || null;
      const quotations = lead.quotations || [];
      const versionToQuotation = new Map();
      const quotationVersionIds = [];
      for (const q of quotations) {
        for (const v of q.versions || []) {
          quotationVersionIds.push(v.quotation_version_id);
          versionToQuotation.set(v.quotation_version_id, q.quotation_id);
        }
      }

      const referenceIds = [leadId];
      if (propertyDetailId) referenceIds.push(propertyDetailId);
      referenceIds.push(...quotationVersionIds);

      // 3. Active drive files (paranoid model excludes deleted_at IS NOT NULL)
      //    matching any collected reference id OR directly tagged with lead_id.
      const driveFiles = await db.DriveFile.findAll({
        where: {
          [Op.or]: [
            { reference_id: { [Op.in]: referenceIds } },
            { lead_id: leadId },
          ],
        },
        order: [["created_at", "ASC"]],
      });

      // 4. Serialize each file, resolving s3_key into a fully-qualified public
      //    S3 URL. The frontend opens `file.s3Key` directly, so it must be a
      //    real URL — not a bare object key like
      //    "quotation-structure-engineer-reports/....pdf". This mirrors the
      //    `${s3BaseUrl}/${s3_key}` convention used across the facade, floor
      //    plan and quotation modules. Rows whose s3_key is already a full URL
      //    (legacy data) are passed through untouched.
      const s3BaseUrl = `https://${env.AWS.S3_BUCKET_NAME}.s3.amazonaws.com`;
      const toPublicUrl = (key) => {
        if (!key) return key;
        if (/^https?:\/\//i.test(key)) return key;
        return `${s3BaseUrl}/${key.replace(/^\/+/, "")}`;
      };

      const files = driveFiles.map((f) => {
        const plain = f.get({ plain: true });
        const url = toPublicUrl(plain.s3_key);
        return { ...keysToCamelCase(plain), s3Key: url, url };
      });

      // 5. Bucket files by sub_reference_type (and parent quotation for
      //    version-scoped files).
      const COMPACTION = new Set([SUB.COMPACTION_REPORT]);
      const QUOTATION_REPORT = new Set([SUB.QUOTATION_REPORT, SUB.SIGNED_QUOTATION_REPORT]);
      const ENGINEERING = new Set([SUB.ENGINEERING_REQUIREMENT, SUB.STRUCTURE_ENGINEER_REPORT, SUB.STRUCTURE_ENGINEER_UPLOAD]);
      const FLOOR_PLAN = new Set([SUB.FLOOR_PLAN_SIMPLE, SUB.FLOOR_PLAN_DETAILED]);
      const FACADE = new Set([SUB.FACADE_IMAGE]);

      const compactionFiles = [];
      const rootFiles = []; // unknown / unmapped types
      const quotationBuckets = new Map(); // quotation_id -> { quotationReport, engineering, floorPlan, facade }
      const bucketFor = (qid) => {
        if (!quotationBuckets.has(qid)) {
          quotationBuckets.set(qid, { quotationReport: [], engineering: [], floorPlan: [], facade: [] });
        }
        return quotationBuckets.get(qid);
      };

      for (const file of files) {
        const sub = file.subReferenceType;
        if (COMPACTION.has(sub)) {
          compactionFiles.push(file);
          continue;
        }

        const quotationId = versionToQuotation.get(file.referenceId);
        if (quotationId) {
          const bucket = bucketFor(quotationId);
          if (QUOTATION_REPORT.has(sub)) bucket.quotationReport.push(file);
          else if (ENGINEERING.has(sub)) bucket.engineering.push(file);
          else if (FLOOR_PLAN.has(sub)) bucket.floorPlan.push(file);
          else if (FACADE.has(sub)) bucket.facade.push(file);
          else rootFiles.push(file);
          continue;
        }

        rootFiles.push(file);
      }

      // 6. Build folders. count = own files + sum of subfolder counts.
      const makeFolder = (folderId, folderName, folderFiles = [], subFolders = []) => ({
        folderId,
        folderName,
        count: folderFiles.length + subFolders.reduce((sum, sf) => sum + sf.count, 0),
        files: folderFiles,
        subFolders,
      });

      // One folder per quotation that actually has files (preserving order).
      const quotationSubFolders = [];
      for (const q of quotations) {
        const bucket = quotationBuckets.get(q.quotation_id);
        if (!bucket) continue;

        const categories = [];
        if (bucket.quotationReport.length) categories.push(makeFolder(`quotation_report_${q.quotation_id}`, "Quotation Report", bucket.quotationReport));
        if (bucket.engineering.length) categories.push(makeFolder(`engineering_${q.quotation_id}`, "Engineering Requirement", bucket.engineering));
        if (bucket.floorPlan.length) categories.push(makeFolder(`floor_plan_${q.quotation_id}`, "Floor Plan", bucket.floorPlan));
        if (bucket.facade.length) categories.push(makeFolder(`facade_${q.quotation_id}`, "Facade", bucket.facade));
        if (!categories.length) continue;

        quotationSubFolders.push(makeFolder(`qt_${q.quotation_id}`, q.reference_number || "Quotation", [], categories));
      }

      const rootSubFolders = [
        makeFolder("compaction_root", "Compaction Report", compactionFiles),
        makeFolder("quotation_root", "Quotation", [], quotationSubFolders),
      ];

      const root = {
        folderId: "root_documents",
        folderName: "Documents",
        ownerName: "System",
        count: rootFiles.length + rootSubFolders.reduce((sum, sf) => sum + sf.count, 0),
        files: rootFiles,
        subFolders: rootSubFolders,
      };

      return { success: true, data: [root], message: "Lead documents fetched successfully" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateLead(leadId, leadData, userId, builderId, companyId) {
    try {
      const existing = await db.Leads.findOne({
        where: { leads_id: leadId, [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] }
      });
      if (!existing) return { success: false, message: "Lead not found" };

      await checkLeadLockStatus(leadId);

      if (leadData.email && leadData.email !== existing.email) {
        const dup = await db.Leads.findOne({
          where: { email: leadData.email, [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] }
        });
        if (dup) throw new Error("A lead with this email already exists");
      }

      // Validations
      if (leadData.region_id) await this.validateRegion(leadData.region_id);
      if (leadData.client_type_id) await this.validateClientType(leadData.client_type_id, builderId, companyId);
      if (leadData.house_land_package_id) await this.validateHouseLandPackage(leadData.house_land_package_id, builderId, companyId);

      if (existing.status === "New" && !leadData.status) leadData.status = "Working";

      await db.Leads.update({ ...leadData, updated_by: userId, updated_at: new Date() }, { where: { leads_id: leadId } });

      if (leadData.house_land_package_id && leadData.house_land_package_id !== existing.house_land_package_id) {
        await this.syncPropertyDetailFromHLP(leadId, leadData.house_land_package_id);
        await quotationService.syncQuotationFromHLP(leadId, leadData.house_land_package_id, userId, builderId, companyId);
      }

      return this.getLeadById(leadId, builderId, companyId);
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteLead(leadId, builderId, companyId) {
    try {
      const existing = await db.Leads.findOne({
        where: { leads_id: leadId, [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] }
      });
      if (!existing) return { success: false, message: "Lead not found" };

      await checkLeadLockStatus(leadId);

      await db.Leads.destroy({ where: { leads_id: leadId } });
      return { success: true, message: "Lead deleted successfully" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async convertLeadToOpportunity(leadId, opportunityNotes, builderId, companyId, status = "Negotiation", transaction = null) {
    const isExternalTransaction = !!transaction;
    const t = transaction || await db.sequelize.transaction();
    try {
      const lead = await db.Leads.findOne({
        where: { leads_id: leadId, [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] },
        transaction: t,
        lock: t.LOCK?.UPDATE || false
      });

      if (!lead) throw new Error("Lead not found or unauthorized");

      if (lead.status === "Convert") {
        const opp = await db.Opportunity.findOne({ where: { leads_id: leadId }, transaction: t });
        if (opp) {
          await opp.update({ status: status || "Negotiation" }, { transaction: t });
          if (!isExternalTransaction) await t.commit();
          return { success: true, data: keysToCamelCase(opp.get({ plain: true })), message: "Lead converted to opportunity successfully" };
        }
      }

      if (!lead.property_detail_id) throw new Error("Lead must have a property detail before converting to an opportunity");

      const opportunity = await db.Opportunity.create({
        leads_id: leadId,
        opportunity_notes: opportunityNotes || null,
        status: status || "Negotiation",
      }, { transaction: t });

      await lead.update({ status: "Convert" }, { transaction: t });

      if (!isExternalTransaction) await t.commit();
      return { success: true, data: keysToCamelCase(opportunity.get({ plain: true })), message: "Lead converted to opportunity successfully" };
    } catch (error) {
      if (!isExternalTransaction && t) await t.rollback();
      return { success: false, message: error.message };
    }
  }

  async getLeadStats(builderId, companyId) {
    try {
      const stats = await db.Leads.findOne({
        where: { [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] },
        attributes: [
          [fn("COUNT", col("*")), "totalLeads"],
          [literal(`COUNT(CASE WHEN status = 'New' THEN 1 END)`), "newLeads"],
          [literal(`COUNT(CASE WHEN status = 'Working' THEN 1 END)`), "workingLeads"],
          [literal(`COUNT(CASE WHEN status = 'Qualified' THEN 1 END)`), "qualifiedLeads"],
          [literal(`COUNT(CASE WHEN rating = 'Hot' THEN 1 END)`), "hotLeads"],
          [literal(`COUNT(CASE WHEN rating = 'Warm' THEN 1 END)`), "warmLeads"],
          [literal(`COUNT(CASE WHEN rating = 'Cold' THEN 1 END)`), "coldLeads"]
        ],
        raw: true
      });

      return {
        success: true,
        data: {
          ...stats,
          totalLeads: parseInt(stats.totalLeads || 0),
          newLeads: parseInt(stats.newLeads || 0),
          workingLeads: parseInt(stats.workingLeads || 0),
          qualifiedLeads: parseInt(stats.qualifiedLeads || 0),
          wonLeads: 0,
          lostLeads: 0,
          hotLeads: parseInt(stats.hotLeads || 0),
          warmLeads: parseInt(stats.warmLeads || 0),
          coldLeads: parseInt(stats.coldLeads || 0),
        },
        message: "Lead statistics fetched successfully"
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getSalesDashboard(builderId, filters = {}) {
    try {
      const { userId, createdAtFrom, createdAtTo, createdAt } = filters;
      const replacements = { builderId };
      let whereClause = "l.builder_id = :builderId";

      if (userId) {
        whereClause += " AND l.assignee_id = :userId";
        replacements.userId = userId;
      }
      if (createdAtFrom) {
        whereClause += " AND l.created_at >= :createdAtFrom";
        replacements.createdAtFrom = createdAtFrom;
      }
      if (createdAtTo) {
        whereClause += " AND l.created_at <= :createdAtTo";
        replacements.createdAtTo = createdAtTo;
      }
      if (createdAt && !createdAtFrom && !createdAtTo) {
        const now = new Date();
        let start;
        switch (createdAt.toLowerCase()) {
          case "last_7_days": start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
          case "last_15_days": start = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); break;
          case "last_30_days": start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        }
        if (start) {
          whereClause += " AND l.created_at >= :createdAtStart";
          replacements.createdAtStart = start.toISOString();
        }
      }

      const monthlyLeads = await db.sequelize.query(
        `SELECT TO_CHAR(DATE_TRUNC('month', l.created_at), 'Mon') AS month, COUNT(*)::int AS total, COUNT(CASE WHEN l.status = 'New' THEN 1 END)::int AS new_count, COUNT(CASE WHEN l.status = 'Working' THEN 1 END)::int AS working_count, COUNT(CASE WHEN l.status IN ('Convert', 'Qualified') THEN 1 END)::int AS converted_count FROM leads l WHERE ${whereClause} AND l.created_at >= DATE_TRUNC('month', NOW() - INTERVAL '5 months') GROUP BY DATE_TRUNC('month', l.created_at) ORDER BY DATE_TRUNC('month', l.created_at) ASC`,
        { replacements, type: QueryTypes.SELECT }
      );

      const leadSources = await db.sequelize.query(
        `SELECT COALESCE(ls.name, 'Unknown') AS source, COUNT(l.leads_id)::int AS lead_count FROM leads l LEFT JOIN lead_source ls ON l.lead_source_id = ls.lead_source_id WHERE ${whereClause} GROUP BY COALESCE(ls.name, 'Unknown') ORDER BY lead_count DESC LIMIT 10`,
        { replacements, type: QueryTypes.SELECT }
      );

      const topPerformers = await db.sequelize.query(
        `SELECT u.name, COUNT(l.leads_id)::int AS lead_count FROM leads l JOIN users u ON l.assignee_id = u.users_id WHERE ${whereClause} AND l.assignee_id IS NOT NULL GROUP BY u.users_id, u.name ORDER BY lead_count DESC LIMIT 5`,
        { replacements, type: QueryTypes.SELECT }
      );

      const overallSummary = await db.sequelize.query(
        `SELECT COUNT(*)::int AS total_leads, COUNT(CASE WHEN status = 'New' THEN 1 END)::int AS new_leads, COUNT(CASE WHEN status = 'Working' THEN 1 END)::int AS working_leads, COUNT(CASE WHEN status IN ('Convert', 'Qualified') THEN 1 END)::int AS converted_leads FROM leads l WHERE ${whereClause}`,
        { replacements, type: QueryTypes.SELECT }
      );

      const topFloorplans = await db.sequelize.query(
        `SELECT fp.name, COUNT(l.leads_id)::int AS lead_count FROM leads l JOIN house_land_package hlp ON l.house_land_package_id = hlp.house_land_package_id JOIN floor_plan fp ON hlp.floor_plan_id = fp.floor_plan_id WHERE ${whereClause} GROUP BY fp.floor_plan_id, fp.name ORDER BY lead_count DESC LIMIT 10`,
        { replacements, type: QueryTypes.SELECT }
      );

      const topFacades = await db.sequelize.query(
        `SELECT f.name, COUNT(l.leads_id)::int AS lead_count FROM leads l JOIN house_land_package hlp ON l.house_land_package_id = hlp.house_land_package_id JOIN facade f ON hlp.facade_id = f.facade_id WHERE ${whereClause} GROUP BY f.facade_id, f.name ORDER BY lead_count DESC LIMIT 10`,
        { replacements, type: QueryTypes.SELECT }
      );

      const lostReasons = await db.sequelize.query(
        `SELECT llr.lost_reason AS name, 0::int AS lead_count FROM lead_lost_reason llr WHERE llr.builder_id = :builderId AND llr.is_active = true ORDER BY llr.sort_order ASC`,
        { replacements, type: QueryTypes.SELECT }
      );

      return {
        success: true,
        data: {
          monthlyLeads: monthlyLeads.map(r => keysToCamelCase(r)),
          leadSources: leadSources.map(r => ({ source: r.source, count: r.lead_count })),
          topPerformers: topPerformers.map(r => ({ name: r.name, count: r.lead_count })),
          overallSummary: overallSummary.length > 0 ? keysToCamelCase(overallSummary[0]) : { totalLeads: 0, newLeads: 0, workingLeads: 0, convertedLeads: 0 },
          topFloorplans: topFloorplans.map(r => ({ name: r.name, count: r.lead_count })),
          topFacades: topFacades.map(r => ({ name: r.name, count: r.lead_count })),
          leadLostReasons: lostReasons.map(r => ({ name: r.name, count: r.lead_count })),
        },
        message: "Sales dashboard data fetched successfully"
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateLeadStatus(leadId, status, userId, builderId, companyId) {
    return this.updateLead(leadId, { status }, userId, builderId, companyId);
  }

  async assignLead(leadId, assigneeId, assigneeNote, userId, builderId) {
    try {
      const user = await db.Users.findOne({ where: { users_id: assigneeId, builder_id: builderId, is_active: true, is_deleted: false } });
      if (!user) return { success: false, message: "Invalid assignee: User not found or inactive" };

      const result = await this.updateLead(leadId, { assignee_id: assigneeId, assignee_note: assigneeNote }, userId, builderId);
      if (result.success) {
        result.data.assigneeName = user.name;
      }
      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async removeHLPackage(leadId, options, builderId, companyId) {
    const t = await db.sequelize.transaction();
    try {
      await checkLeadLockStatus(leadId, t);
      const { remove_hl_package_lot_quotation } = options;

      const lead = await db.Leads.findOne({
        where: { leads_id: leadId, [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] },
        transaction: t
      });
      if (!lead) throw new Error("Lead not found or unauthorized");

      const propertyDetailId = lead.property_detail_id;
      await lead.update({ house_land_package_id: null, updated_at: new Date() }, { transaction: t });

      if (remove_hl_package_lot_quotation) {
        if (propertyDetailId) {
          const pd = await db.PropertyDetail.findByPk(propertyDetailId, { transaction: t });
          if (pd && pd.is_hl_package_lot) {
            await lead.update({ property_detail_id: null }, { transaction: t });
            await pd.destroy({ transaction: t });
          }
        }
        await db.Quotation.destroy({ where: { leads_id: leadId, is_hl_package_quotation: true }, transaction: t });
      }

      await t.commit();
      return { success: true, message: "House Land Package removed successfully" };
    } catch (error) {
      if (t) await t.rollback();
      return { success: false, message: error.message };
    }
  }

  async syncPropertyDetailFromHLP(leadId, houseLandPackageId, t) {
    const { HouseLandPackage, Lot, PropertyDetail, Leads, Estate } = db;
    const hlp = await HouseLandPackage.findByPk(houseLandPackageId, { attributes: ["lot_id"], transaction: t });
    if (!hlp?.lot_id) return;

    const lot = await Lot.findByPk(hlp.lot_id, { include: [{ model: Estate, as: "estate", attributes: ["name"] }], transaction: t });
    if (!lot) return;

    const lead = await Leads.findByPk(leadId, { attributes: ["property_detail_id"], transaction: t });
    if (lead?.property_detail_id) {
      const oldId = lead.property_detail_id;
      await Leads.update({ property_detail_id: null }, { where: { leads_id: leadId }, transaction: t });
      await PropertyDetail.destroy({ where: { property_detail_id: oldId }, transaction: t });
    }

    const newPd = await PropertyDetail.create({
      lot_id: lot.lot_id,
      lot_number: lot.lot_number,
      street: lot.street,
      city: lot.city,
      state_id: lot.state_id,
      zip_code: lot.zip_code,
      estate_id: lot.estate_id,
      estate_stage_id: lot.estate_stage_id,
      estate_name: lot.estate?.name || null,
      title_status: lot.title_status,
      title_date: lot.title_date,
      land_type: lot.lot_type || "REGULAR",
      corner_block: lot.corner_block,
      width_m: lot.width_m,
      depth_m: lot.depth_m,
      total_size_m2: lot.total_size_m2,
      price: lot.price,
      site_fall_mm: lot.site_fall_mm,
      land_fill_mm: lot.land_fill_mm,
      is_hl_package_lot: true,
    }, { transaction: t });

    await Leads.update({ property_detail_id: newPd.property_detail_id }, { where: { leads_id: leadId }, transaction: t });
  }

  async getAllLeadActions(leadId, builderId, companyId) {
    const { Leads, Notes, Task, Appointment, Sms, Users, NotesTag } = db;
    try {
      const orConditions = [];
      if (builderId) orConditions.push({ builder_id: builderId });
      if (companyId) orConditions.push({ company_id: companyId });

      const lead = await Leads.findOne({
        where: { leads_id: leadId, [Op.or]: orConditions.length ? orConditions : [{ leads_id: null }] },
        include: [{ model: Users, as: "createdByUser", attributes: ["name"] }],
      });
      if (!lead) return { success: false, message: "Lead not found or access denied" };

      const leadCreatedByName = lead.createdByUser?.name || null;

      const notes = await Notes.findAll({ where: { leads_id: leadId }, order: [["created_at", "DESC"]] });
      const allTagIds = [...new Set(notes.flatMap(n => n.note_tag_id || []))];
      const tags = allTagIds.length ? await NotesTag.findAll({ where: { notes_tag_id: allTagIds }, attributes: ["notes_tag_id", "name"] }) : [];
      const tagMap = tags.reduce((acc, t) => ({ ...acc, [t.notes_tag_id]: t.name }), {});
      const processedNotes = notes.map(n => ({ ...keysToCamelCase(n.get({ plain: true })), notetag: (n.note_tag_id || []).map(id => ({ id, name: tagMap[id] })), createdbyname: leadCreatedByName }));

      const tasks = await Task.findAll({ where: { lead_id: leadId }, include: [{ model: Users, as: "assignee", attributes: ["name"] }, { model: Users, as: "createdByUser", attributes: ["name"] }], order: [["created_at", "DESC"]] });
      const processedTasks = tasks.map(t => {
        const camel = keysToCamelCase(t.get({ plain: true }));
        camel.assigneeName = t.assignee?.name || null;
        camel.createdbyname = t.createdByUser?.name || null;
        return orderTaskFields(camel);
      });

      const appointments = await Appointment.findAll({
        where: { lead_id: leadId },
        include: [
          { model: Users, as: "createdByUser", attributes: ["name"] },
        ],
        order: [
          ["date", "DESC"],
          ["start_time", "DESC"],
        ],
      });

      const processedAppointments = await Promise.all(
        appointments.map(async (row) => {
          const appt = row.get({ plain: true });
          let selectUsersData = [];
          if (appt.select_users && appt.select_users.length > 0) {
            const users = await Users.findAll({
              where: {
                users_id: { [Op.in]: appt.select_users },
                is_deleted: false,
              },
              attributes: ["users_id", "name"],
            });
            selectUsersData = users.map((u) => ({
              id: u.users_id,
              name: u.name,
            }));
          }
          return {
            ...keysToCamelCase(appt),
            selectUsers: selectUsersData,
            createdbyname: appt.createdByUser?.name || null,
          };
        })
      );

      const sms = await Sms.findAll({ where: { leads_id: leadId }, include: [{ model: Users, as: "recipient", attributes: ["name"] }], order: [["created_at", "DESC"]] });
      const processedSms = sms.map(s => ({ ...keysToCamelCase(s.get({ plain: true })), recipientName: s.recipient?.name || null, createdbyname: leadCreatedByName }));

      return { success: true, data: { notes: processedNotes, tasks: processedTasks, appointments: processedAppointments, sms: processedSms }, message: "Lead actions fetched successfully" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getLeadActivityLog(leadId, builderId, companyId, filters = {}) {
    try {
      const orConditions = [];
      if (builderId) orConditions.push({ builder_id: builderId });
      if (companyId) orConditions.push({ company_id: companyId });

      const lead = await db.Leads.findOne({ where: { leads_id: leadId, [Op.or]: orConditions.length ? orConditions : [{ leads_id: null }] } });
      if (!lead) return { success: false, message: "Lead not found or access denied" };

      const { page = 1, limit = 20, module, action, search } = filters;
      const offset = (page - 1) * limit;

      const replacements = { leadId, limit, offset };
      let whereClause = "al.leads_id = :leadId";

      if (module) {
        whereClause += " AND al.module = :module";
        replacements.module = module;
      }
      if (action) {
        whereClause += " AND al.action = :action";
        replacements.action = action;
      }
      if (search) {
        whereClause += " AND (u.name ILIKE :search OR al.description ILIKE :search)";
        replacements.search = `%${search}%`;
      }

      const logs = await db.sequelize.query(
        `SELECT al.*, u.name AS user_name FROM lead_activity_log al LEFT JOIN users u ON al.user_id = u.users_id WHERE ${whereClause} ORDER BY al.created_at DESC LIMIT :limit OFFSET :offset`,
        { replacements, type: QueryTypes.SELECT }
      );

      const countResult = await db.sequelize.query(
        `SELECT COUNT(*)::int AS total FROM lead_activity_log al LEFT JOIN users u ON al.user_id = u.users_id WHERE ${whereClause}`,
        { replacements, type: QueryTypes.SELECT }
      );
      const total = countResult[0].total;

      const activityLogs = keysToCamelCase(logs);
      activityLogs.forEach(log => {
        // Helper to clean up technical/JSON values
        const formatValue = (val) => {
          if (val === null || val === undefined || val === 'null' || val === 'undefined' || val === '') return 'None';

          // Try to parse if it looks like JSON
          if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
            try {
              const parsed = JSON.parse(val);
              if (parsed && typeof parsed === 'object') {
                return parsed.name || parsed.label || parsed.title || 'Data';
              }
            } catch (e) {
              // Not valid JSON, continue with original value
            }
          }
          return val;
        };

        // Capitalize names and modules
        if (log.userName) log.userName = formatCamelCaseToReadable(log.userName);
        if (log.recordName && !log.recordName.startsWith('QT')) {
          log.recordName = formatCamelCaseToReadable(log.recordName);
        }
        if (log.module) log.module = formatCamelCaseToReadable(log.module);

        if (log.action === 'UPDATE' && log.fieldName) {
          const readableField = formatCamelCaseToReadable(log.fieldName);
          const oldValue = formatValue(log.oldValue);
          const newValue = formatValue(log.newValue);

          let context = "";
          if (log.module === "Quotation") {
            const refNo = log.recordName || "";
            const versionNo = log.metadata?.quotationVersionNo ? ` V${log.metadata.quotationVersionNo}` : "";
            if (refNo || versionNo) {
              context = ` in ${refNo}${versionNo}`.replace(/\s+/g, ' ');
            }
          }

          const isUrlOrReport = 
            /url|report/i.test(log.fieldName) || 
            (typeof log.oldValue === 'string' && /^https?:\/\//i.test(log.oldValue)) || 
            (typeof log.newValue === 'string' && /^https?:\/\//i.test(log.newValue));

          if (isUrlOrReport) {
            log.description = `Updated ${readableField}${context}`;
          } else {
            log.description = `Updated ${readableField}${context} from ${oldValue} to ${newValue}`;
          }
        } else if (log.action === 'CREATE') {
          log.description = `Created ${log.module} ${log.recordName || ""}`.trim();
        } else if (log.action === 'DELETE') {
          log.description = `Deleted ${log.module} ${log.recordName || ""}`.trim();
        }
      });

      return {
        success: true,
        data: {
          activityLogs,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        },
        message: "Lead activity log fetched successfully"
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Validation helpers
  async validateRegion(regionId) {
    const state = await db.State.findByPk(regionId);
    if (!state) throw new Error("Region not found");
    return { valid: true };
  }

  async validateClientType(clientTypeId, builderId, companyId) {
    const ct = await db.ClientType.findOne({ where: { client_type_id: clientTypeId, [Op.or]: [{ builder_id: builderId }, { company_id: companyId }, { builder_id: null, company_id: null }], is_active: true } });
    if (!ct) throw new Error("Client type not found or inactive");
    return { valid: true };
  }

  async validateHouseLandPackage(hlpId, builderId, companyId) {
    const hlp = await db.HouseLandPackage.findOne({ where: { house_land_package_id: hlpId, [Op.or]: [{ builder_id: builderId }, { company_id: companyId }, { builder_id: null, company_id: null }] } });
    if (!hlp) throw new Error("House Land Package not found");
    return { valid: true };
  }
}

export default new LeadsService();
