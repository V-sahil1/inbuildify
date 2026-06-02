import db from "../../config/database/models/postgre-models/index.js";
import { keysToCamelCase } from "../../utils/common.js";
import { Op } from "sequelize";

class JobService {
  async getAllJobs(queryParams, user) {
    const { Opportunity, Leads, Job, PropertyDetail, State, Users } = db.sequelize.models;
    const builderId = user?.builder_id;
    const companyId = user?.company_id;

    const {
      page = 1,
      limit = 25,
      search,
      status,
      reference_id,
      customer_name,
      job_address,
      estate_name,
      consultant,
      created_at_from,
      created_at_to,
      title_date_from,
      title_date_to,
      assignee_id,
      sort_by = "created_at",
      sort_order = "desc",
    } = queryParams;

    const toArray = (value) => {
      if (!value) {
        return undefined;
      }
      if (Array.isArray(value)) {
        return value;
      }
      return String(value).split(",").map((s) => s.trim()).filter(Boolean);
    };

    const statusList = toArray(status);
    const assigneeList = toArray(assignee_id);
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));

    // ── Tenant Scope ────────────────────────────────────────────────────────
    const tenantScope = {
      [Op.or]: [
        { builder_id: builderId },
        { company_id: companyId ? companyId : { [Op.is]: null } }, // Handling null correctly
      ],
    };

    // If companyId is not provided, we should only trust builderId
    if (builderId && !companyId) {
      tenantScope[Op.or] = [{ builder_id: builderId }];
    } else if (!builderId && companyId) {
      tenantScope[Op.or] = [{ company_id: companyId }];
    } else if (builderId && companyId) {
      tenantScope[Op.or] = [{ builder_id: builderId }, { company_id: companyId }];
    }

    const where = { [Op.and]: [tenantScope] };

    // ── Filters ─────────────────────────────────────────────────────────────
    if (statusList?.length) {
      where[Op.and].push({ status: { [Op.in]: statusList } });
    }

    if (reference_id) {
      where[Op.and].push({ reference_number: { [Op.iLike]: `%${reference_id}%` } });
    }

    if (customer_name) {
      where[Op.and].push({ "$opportunity.lead.name$": { [Op.iLike]: `%${customer_name}%` } });
    }

    if (job_address) {
      where[Op.and].push({
        [Op.or]: [
          { "$opportunity.lead.propertyDetail.lot_number$": { [Op.iLike]: `%${job_address}%` } },
          { "$opportunity.lead.propertyDetail.street$": { [Op.iLike]: `%${job_address}%` } },
          { "$opportunity.lead.propertyDetail.address_line1$": { [Op.iLike]: `%${job_address}%` } },
          { "$opportunity.lead.propertyDetail.city$": { [Op.iLike]: `%${job_address}%` } },
        ],
      });
    }

    if (estate_name) {
      where[Op.and].push({ "$opportunity.lead.propertyDetail.estate_name$": { [Op.iLike]: `%${estate_name}%` } });
    }

    if (consultant) {
      where[Op.and].push({ "$opportunity.lead.assignee.name$": { [Op.iLike]: `%${consultant}%` } });
    }

    if (assigneeList?.length) {
      where[Op.and].push({ "$opportunity.lead.assignee_id$": { [Op.in]: assigneeList } });
    }

    if (created_at_from) {
      where[Op.and].push({ createdAt: { [Op.gte]: created_at_from } });
    }

    if (created_at_to) {
      where[Op.and].push({ createdAt: { [Op.lte]: created_at_to } });
    }

    if (title_date_from) {
      where[Op.and].push({ "$opportunity.lead.propertyDetail.title_date$": { [Op.gte]: title_date_from } });
    }

    if (title_date_to) {
      where[Op.and].push({ "$opportunity.lead.propertyDetail.title_date$": { [Op.lte]: title_date_to } });
    }

    // ── Global Search ───────────────────────────────────────────────────────
    if (search) {
      where[Op.and].push({
        [Op.or]: [
          { reference_number: { [Op.iLike]: `%${search}%` } },
          { "$opportunity.lead.name$": { [Op.iLike]: `%${search}%` } },
          { "$opportunity.lead.email$": { [Op.iLike]: `%${search}%` } },
          { "$opportunity.lead.phone$": { [Op.iLike]: `%${search}%` } },
          { "$opportunity.lead.propertyDetail.estate_name$": { [Op.iLike]: `%${search}%` } },
          { "$opportunity.lead.assignee.name$": { [Op.iLike]: `%${search}%` } },
        ],
      });
    }

    // ── Sorting ─────────────────────────────────────────────────────────────
    const orderMap = {
      created_at: [["created_at", sort_order]],
      updated_at: [["updated_at", sort_order]],
      reference_id: [["reference_number", sort_order]],
      customer_name: [[{ model: Opportunity, as: "opportunity" }, { model: Leads, as: "lead" }, "name", sort_order]],
      status: [["status", sort_order]],
      title_date: [[{ model: Opportunity, as: "opportunity" }, { model: Leads, as: "lead" }, { model: PropertyDetail, as: "propertyDetail" }, "title_date", sort_order]],
      estate_name: [[{ model: Opportunity, as: "opportunity" }, { model: Leads, as: "lead" }, { model: PropertyDetail, as: "propertyDetail" }, "estate_name", sort_order]],
    };

    const order = orderMap[sort_by] || orderMap.created_at;

    // ── Main Query ──────────────────────────────────────────────────────────
    const { rows, count } = await Job.findAndCountAll({
      where,
      include: [
        {
          model: Opportunity,
          as: "opportunity",
          required: true,
          include: [
            {
              model: Leads,
              as: "lead",
              required: true,
              include: [
                {
                  model: PropertyDetail,
                  as: "propertyDetail",
                  include: [{ model: State, as: "state" }],
                },
                {
                  model: Users,
                  as: "assignee",
                },
              ],
            },
          ],
        },
      ],
      order,
      limit: pageSize,
      offset,
      distinct: true, // Crucial for count accuracy with joins
    });

    // ── Aggregations (Independent of filters except tenant scope) ────────────
    const [statusCounts, totalJobs] = await Promise.all([
      Job.findAll({
        attributes: [
          "status",
          [db.sequelize.fn("COUNT", db.sequelize.col("job_id")), "count"],
        ],
        where: tenantScope,
        group: ["status"],
        raw: true,
      }),
      Job.count({ where: tenantScope }),
    ]);

    const statusSummary = {
      "In Progress": 0,
      "Completed": 0,
      "On Hold": 0,
      "Cancelled": 0,
      "Archived": 0,
    };
    statusCounts.forEach(row => {
      if (Object.prototype.hasOwnProperty.call(statusSummary, row.status)) {
        statusSummary[row.status] = parseInt(row.count);
      }
    });

    // ── Data Formatting ─────────────────────────────────────────────────────
    const formattedJobs = rows.map(job => {
      const plainJob = job.get({ plain: true });
      const lead = plainJob.opportunity?.lead;
      const pd = lead?.propertyDetail;
      const st = pd?.state;
      const u = lead?.assignee;

      const addressParts = [
        pd?.lot_number,
        pd?.street,
        pd?.address_line1,
        pd?.address_line2,
        pd?.city,
        st?.name,
        pd?.zip_code,
      ].map(s => s?.trim()).filter(s => !!s);

      const jobAddress = addressParts.length > 0 ? addressParts.join(", ") : "N/A";

      return {
        jobId: plainJob.job_id,
        referenceNumber: plainJob.reference_number,
        status: plainJob.status,
        jobNote: plainJob.job_note,
        builderId: plainJob.builder_id,
        companyId: plainJob.company_id,
        createdAt: plainJob.created_at,
        updatedAt: plainJob.updated_at,
        leadsId: lead?.leads_id,
        customerName: lead?.name,
        customerEmail: lead?.email,
        customerPhone: lead?.phone,
        estateName: pd?.estate_name,
        titleDate: pd?.title_date,
        jobAddress,
        consultantId: u?.users_id,
        consultantName: u?.name,
        consultantInitials: u?.initials,
        consultantEmail: u?.email,
      };
    });

    return {
      success: true,
      data: {
        jobs: formattedJobs,
        pagination: {
          page: parseInt(page),
          limit: pageSize,
          total: count,
          totalPages: Math.ceil(count / pageSize),
        },
        statusSummary,
        totalJobs,
      },
      message: "Jobs fetched successfully",
    };
  } async getJobById(jobId, user) {
    const {
      Job, Opportunity, Leads, PropertyDetail, State, Users, Builder, LeadSource,
      QuotationVersionItem, Invoice,
    } = db.sequelize.models;
    const builderId = user?.builder_id;
    const companyId = user?.company_id;

    const tenantScope = {
      [Op.or]: [
        { builder_id: builderId },
        { company_id: companyId ? companyId : { [Op.is]: null } },
      ],
    };

    if (builderId && !companyId) {
      tenantScope[Op.or] = [{ builder_id: builderId }];
    } else if (!builderId && companyId) {
      tenantScope[Op.or] = [{ company_id: companyId }];
    } else if (builderId && companyId) {
      tenantScope[Op.or] = [{ builder_id: builderId }, { company_id: companyId }];
    }

    try {
      // 1. Fetch main job detail with associations
      const job = await Job.findOne({
        where: { job_id: jobId, ...tenantScope },
        include: [
          {
            model: Opportunity,
            as: "opportunity",
            include: [
              {
                model: Leads,
                as: "lead",
                include: [
                  {
                    model: PropertyDetail,
                    as: "propertyDetail",
                    include: [{ model: State, as: "state" }],
                  },
                  { model: Users, as: "assignee" },
                  { model: LeadSource, as: "leadSource" },
                ],
              },
            ],
          },
          { model: Builder, as: "builder" },
        ],
      });

      if (!job) {
        return { success: false, statusCode: 404, message: "Job not found or unauthorized" };
      }

      const plainJob = job.get({ plain: true });
      const opportunity = plainJob.opportunity;
      const lead = opportunity?.lead;
      const propertyDetail = lead?.propertyDetail;
      const state = propertyDetail?.state;
      const consultant = lead?.assignee;
      const builder = plainJob.builder;
      const leadSource = lead?.leadSource;

      // 2. Fetch Aggregations & Invoices in parallel
      const [quotationTotalResult, totalPaidResult, invoices] = await Promise.all([
        // Quotation Total
        QuotationVersionItem.sum("total_price", {
          where: { quotation_version_id: plainJob.quotation_version_id },
        }),
        // Total Paid
        Invoice.sum("deposite_amount", {
          where: { leads_id: lead?.leads_id },
        }),
        // Invoice List
        Invoice.findAll({
          where: { leads_id: lead?.leads_id },
          attributes: [
            ["invoice_id", "invoiceId"],
            ["reference_number", "referenceNumber"],
            ["invoice_amount", "invoiceAmount"],
            ["deposite_amount", "depositAmount"],
            "status",
          ],
          order: [["created_at", "ASC"]],
          raw: true,
        }),
      ]);

      // 3. Format Address
      const addressParts = [
        propertyDetail?.lot_number,
        propertyDetail?.street,
        propertyDetail?.address_line1,
        propertyDetail?.address_line2,
        propertyDetail?.city,
        state?.name,
        propertyDetail?.zip_code,
      ].map(s => s?.trim()).filter(s => !!s);

      const jobAddress = addressParts.length > 0 ? addressParts.join(", ") : "N/A";

      // 4. Final Response Object
      const data = {
        jobId: plainJob.job_id,
        referenceNumber: plainJob.reference_number,
        status: plainJob.status,
        jobNote: plainJob.job_note,
        builderId: plainJob.builder_id,
        companyId: plainJob.company_id,
        quotationVersionId: plainJob.quotation_version_id,
        createdAt: plainJob.created_at,
        updatedAt: plainJob.updated_at,
        leadsId: lead?.leads_id,
        customerName: lead?.name,
        customerEmail: lead?.email,
        customerPhone: lead?.phone,
        estateName: propertyDetail?.estate_name,
        titleDate: propertyDetail?.title_date,
        titleStatus: propertyDetail?.title_status,
        jobAddress,
        builderName: builder?.name,
        leadSourceName: leadSource?.name,
        consultantId: consultant?.users_id,
        consultantName: consultant?.name,
        consultantInitials: consultant?.initials,
        consultantEmail: consultant?.email,
        quotationTotal: (quotationTotalResult || 0).toString(),
        totalPaid: (totalPaidResult || 0).toString(),
        invoices: invoices || [],
      };

      return {
        success: true,
        data,
        message: "Job detail fetched successfully",
      };
    } catch (error) {
      console.error("JobService.getJobById error:", error);
      throw error;
    }
  }

  async convertOpportunityToJob(opportunityId, updateData) {
    const {
      out_come,
      quotation_version_id,
      job_note,
      send_email,
      lead_lost_reason_id,
      lead_lost_comment,
    } = updateData;

    const { Opportunity, Leads, Job, QuotationVersion } = db.sequelize.models;
    const t = await db.sequelize.transaction();

    try {
      // 1. Fetch opportunity + lead details
      const opportunity = await Opportunity.findOne({
        where: { opportunity_id: opportunityId },
        include: [
          {
            model: Leads,
            as: "lead",
            required: true, // Forces INNER JOIN to prevent FOR UPDATE postgres errors
          },
        ],
        transaction: t,
      });

      if (!opportunity) {
        await t.rollback();
        return { success: false, statusCode: 404, message: "Opportunity not found" };
      }

      // ── Lost Outcome ────────────────────────────────────────────────────────
      if (out_come === "lost") {
        await opportunity.update(
          {
            status: "Close",
            out_come: "lost",
            updatedAt: new Date(),
          },
          { transaction: t },
        );

        if (opportunity.lead) {
          await opportunity.lead.update(
            {
              lead_lost_reason_id,
              lead_lost_comment: lead_lost_comment || null,
              updatedAt: new Date(),
            },
            { transaction: t },
          );
        }

        await t.commit();
        return {
          success: true,
          statusCode: 200,
          message: "Opportunity marked as lost and closed.",
          data: {},
        };
      }

      // ── Won Outcome ─────────────────────────────────────────────────────────
      if (out_come === "won") {
        // Check if job already exists
        const jobCheck = await Job.findOne({
          where: { opportunity_id: opportunityId },
          transaction: t,
        });

        if (jobCheck) {
          await t.rollback();
          return { success: false, statusCode: 400, message: "A job already exists for this opportunity." };
        }

        if (!quotation_version_id) {
          await t.rollback();
          return { success: false, statusCode: 400, message: "Quotation version ID is required when status is WON" };
        }

        // Check if quotation version is approved
        const qvCheck = await QuotationVersion.findOne({
          where: {
            quotation_version_id,
            is_approve: true,
          },
          transaction: t,
        });

        if (!qvCheck) {
          await t.rollback();
          return { success: false, statusCode: 404, message: "Quotation version not found or not approved" };
        }

        // Close opportunity
        await opportunity.update(
          {
            status: "Close",
            out_come: "won",
            updatedAt: new Date(),
          },
          { transaction: t },
        );

        // Create new Job
        const newJob = await Job.create(
          {
            reference_number: opportunity.lead?.reference_number,
            opportunity_id: opportunityId,
            quotation_version_id,
            job_note: job_note || null,
            send_email: send_email || false,
            status: "In Progress",
            builder_id: opportunity.lead?.builder_id,
            company_id: opportunity.lead?.company_id,
          },
          { transaction: t },
        );

        await t.commit();
        return {
          success: true,
          statusCode: 200,
          message: "Opportunity converted to job successfully.",
          data: keysToCamelCase(newJob.get({ plain: true })),
        };
      }

      await t.rollback();
      return { success: false, statusCode: 400, message: "Invalid out_come value. Must be 'won' or 'lost'." };

    } catch (error) {
      if (t) {
        await t.rollback();
      }
      console.error("JobService.convertOpportunityToJob error:", error);
      throw error;
    }
  }

  async updateJobStatus(jobId, status, user) {
    const { Job } = db.sequelize.models;
    const builderId = user?.builder_id;
    const companyId = user?.company_id;

    const tenantScope = {
      [Op.or]: [
        { builder_id: builderId },
        { company_id: companyId ? companyId : { [Op.is]: null } },
      ],
    };

    if (builderId && !companyId) {
      tenantScope[Op.or] = [{ builder_id: builderId }];
    } else if (!builderId && companyId) {
      tenantScope[Op.or] = [{ company_id: companyId }];
    } else if (builderId && companyId) {
      tenantScope[Op.or] = [{ builder_id: builderId }, { company_id: companyId }];
    }

    try {
      const job = await Job.findOne({
        where: {
          job_id: jobId,
          ...tenantScope,
        },
      });

      if (!job) {
        return { success: false, statusCode: 404, message: "Job not found or unauthorized" };
      }

      await job.update({ status });

      return {
        success: true,
        data: keysToCamelCase(job.get({ plain: true })),
        message: "Job status updated",
      };
    } catch (error) {
      console.error("JobService.updateJobStatus error:", error);
      throw error;
    }
  }
}

export default new JobService();
