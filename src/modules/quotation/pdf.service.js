import puppeteer from "puppeteer";

let cachedBrowser = null;

/**
 * Get or launch the shared Puppeteer browser instance
 */
const getBrowser = async () => {
  if (cachedBrowser && cachedBrowser.connected) {
    return cachedBrowser;
  }

  cachedBrowser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  cachedBrowser.on("disconnected", () => {
    cachedBrowser = null;
  });

  return cachedBrowser;
};

/**
 * Generate PDF buffer from HTML content
 * @param {string} htmlContent - The HTML string to convert to PDF
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generatePDF = async (htmlContent) => {
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Set content and wait for network to be idle to ensure any external assets (if any) are loaded
    // networkidle2 is usually faster than networkidle0 and sufficient for most templates
    await page.setContent(htmlContent, { waitUntil: "networkidle2", timeout: 30000 });

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

    return Buffer.from(pdfUint8Array);
  } catch (error) {
    console.error("Error generating PDF with Puppeteer:", error);
    // If the browser crashed, null it out so it regenerates next time
    cachedBrowser = null;
    throw new Error("Failed to generate PDF");
  } finally {
    if (page) {
      await page.close();
    }
  }
};
