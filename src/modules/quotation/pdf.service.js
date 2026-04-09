import puppeteer from "puppeteer";

/**
 * Generate PDF buffer from HTML content
 * @param {string} htmlContent - The HTML string to convert to PDF
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generatePDF = async (htmlContent) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Set content and wait for network to be idle to ensure any external assets (if any) are loaded
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: "20mm",
        left: "20mm",
      },
    });

    // Convert Uint8Array to Node.js Buffer for Nodemailer/Express compatibility
    return Buffer.from(pdfUint8Array);
  } catch (error) {
    console.error("Error generating PDF with Puppeteer:", error);
    throw new Error("Failed to generate PDF");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
