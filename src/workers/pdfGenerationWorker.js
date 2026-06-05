import Bull from "bull";
import { env } from "../config/env.config.js";
import db from "../config/database/models/postgre-models/index.js";
import quotationRepository from "../modules/quotation/quotation.repository.js";
import { generatePDF } from "../modules/quotation/pdf.service.js";
import { generateQuotationHTML } from "../utils/template.js";
import { uploadFile, generatePresignedDownloadUrl } from "../service/s3.service.js";
import { Op } from "sequelize";

import { createSharedBullClient } from "../config/redisBull.config.js";

const pdfGenerationQueue = new Bull("pdfGenerationQueue", { createClient: createSharedBullClient });

pdfGenerationQueue.process(async (job) => {
  const { quotation_version_id, builder_id, company_id } = job.data;
  const { QuotationVersion, Quotation, Leads } = db;

  console.log(`[PDFWorker] Starting generation for version: ${quotation_version_id}`);

  // Check if PDF already exists in DriveFile
  const existingPdf = await quotationRepository.getPdfUrl(quotation_version_id);
  if (existingPdf) {
    console.log(`[PDFWorker] PDF already exists for version: ${quotation_version_id}, skipping generation.`);
    return { success: true, s3Key: existingPdf };
  }

  // 1. Verify access and fetch basic data
  const sourceVersion = await QuotationVersion.findOne({
    where: { quotation_version_id },
    include: [{
      model: Quotation,
      as: "quotation",
      include: [{
        model: Leads,
        as: "lead",
        where: {
          [Op.or]: [
            { builder_id: builder_id },
            ...(company_id ? [{ company_id: company_id }] : []),
          ],
        },
      }],
    }],
  });

  if (!sourceVersion) {
    throw new Error(`Quotation version ${quotation_version_id} not found or unauthorized`);
  }

  // 2. Fetch full details for HTML generation
  const versionDetails = await quotationRepository.getQuotationVersionDetailsById(quotation_version_id);
  if (!versionDetails) {
    throw new Error(`Details not found for version ${quotation_version_id}`);
  }

  // 3. Resolve floor plan / facade image UUIDs → presigned S3 URLs so
  //    Puppeteer can load them (the PDF renderer allows amazonaws.com requests).
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = (v) => typeof v === "string" && uuidRe.test(v);
  const fp = versionDetails.floorPlan || {};
  const fc = versionDetails.facade || {};
  const uuidsToResolve = [fp.detailedImage, fp.simpleImage, fc.image].filter(isUuid);
  const uuidToKey = new Map();
  if (uuidsToResolve.length) {
    const { DriveFile } = db.sequelize?.models || db;
    const rows = await DriveFile.findAll({ where: { file_id: uuidsToResolve }, attributes: ["file_id", "s3_key"] });
    rows.forEach((r) => uuidToKey.set(r.file_id, r.s3_key));
  }
  const resolveKey = (val) => {
    if (!val || typeof val !== "string") return null;
    if (isUuid(val)) return uuidToKey.get(val) || null;
    if (val.startsWith("https://") || val.startsWith("http://")) {
      try { return decodeURIComponent(new URL(val).pathname.replace(/^\//, "")); } catch (_) { return null; }
    }
    return val;
  };
  const toPresigned = async (val) => {
    const key = resolveKey(val);
    if (!key) return null;
    try {
      const r = await generatePresignedDownloadUrl(key, 3600);
      return r?.success ? r.url : null;
    } catch (_) { return null; }
  };
  const [fpDetailed, fpSimple, facadeImg] = await Promise.all([
    toPresigned(fp.detailedImage), toPresigned(fp.simpleImage), toPresigned(fc.image),
  ]);
  if (versionDetails.floorPlan) { versionDetails.floorPlan.detailedImage = fpDetailed; versionDetails.floorPlan.simpleImage = fpSimple; }
  if (versionDetails.facade) { versionDetails.facade.image = facadeImg; }

  // 4. Generate HTML and PDF
  const htmlContent = generateQuotationHTML(versionDetails);
  const pdfBuffer = await generatePDF(htmlContent);
  
  console.log(`[PDFWorker] PDF generated for ${quotation_version_id}, size: ${pdfBuffer.length} bytes`);

  // 4. Upload to S3
  const fileName = `Quotation_v${versionDetails.quotationVersionNo}_${versionDetails.quotationId}.pdf`;
  const s3Key = `quotations/${quotation_version_id}/${fileName}`;
  
  const uploadResult = await uploadFile(s3Key, pdfBuffer, "application/pdf");

  if (!uploadResult.success) {
    throw new Error(`Failed to upload PDF to S3: ${uploadResult.error}`);
  }

  // 5. Upsert DriveFile + write its PK onto the legacy pdf_url column
  await quotationRepository.updatePdfUrl(quotation_version_id, uploadResult.key, {
    size: pdfBuffer.length,
    originalName: fileName,
  });

  console.log(`[PDFWorker] Job complete — versionId: ${quotation_version_id}, key: ${uploadResult.key}`);

  return { success: true, s3Key: uploadResult.key, location: uploadResult.location };
});

pdfGenerationQueue.on("failed", (job, err) => {
  console.error(`[PDFWorker] Job ${job.id} failed for versionId ${job.data.quotation_version_id}:`, err.message);
});

pdfGenerationQueue.on("completed", (job) => {
  console.log(`[PDFWorker] Job ${job.id} completed successfully`);
});

console.log("Quotation PDF generation worker started...");

export default pdfGenerationQueue;
