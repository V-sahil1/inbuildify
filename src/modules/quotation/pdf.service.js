import puppeteer from "puppeteer";

let cachedBrowser = null;
let browserLaunchPromise = null;

/**
 * Get or launch the shared Puppeteer browser instance.
 * Concurrent callers share a single launch promise so we never spawn more than
 * one Chromium (launching is the most expensive step, ~2-5s cold).
 */
const getBrowser = async () => {
  if (cachedBrowser && cachedBrowser.connected) {
    return cachedBrowser;
  }
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = puppeteer
    .launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--disable-extensions",
        "--disable-background-networking",
      ],
    })
    .then((browser) => {
      cachedBrowser = browser;
      browser.on("disconnected", () => {
        cachedBrowser = null;
      });
      return browser;
    })
    .finally(() => {
      browserLaunchPromise = null;
    });

  return browserLaunchPromise;
};

/**
 * Launch the browser ahead of the first request so users never pay the cold
 * Chromium launch (~2-5s) inside a request. Safe to call at server startup;
 * failures are swallowed (the next getBrowser will retry).
 */
export const warmupBrowser = async () => {
  try {
    await getBrowser();
    console.log("[pdf] Puppeteer browser pre-warmed");
  } catch (err) {
    console.warn("[pdf] Browser pre-warm failed (will retry on demand):", err.message);
  }
};

/**
 * Generate PDF buffer from HTML content
 * @param {string} htmlContent - The HTML string to convert to PDF
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generatePDF = async (htmlContent) => {
  let page;
  const t0 = Date.now();
  try {
    const browser = await getBrowser();
    const tBrowser = Date.now();
    page = await browser.newPage();

    // All images are inlined as data URIs before we get here, so the PDF needs
    // no network access. Block any external (http/https) request as a hard
    // safeguard: a slow/blocked asset (e.g. a Google Fonts @import) under
    // "networkidle2" used to stall rendering until the 30s timeout and surface
    // as a 504. Aborting them keeps generation fast and deterministic.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("http://") || url.startsWith("https://")) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    // "load" fires once the DOM and inlined (data-URI) assets are ready. With
    // external requests aborted above there is nothing to wait on the network
    // for, so this resolves quickly instead of hanging on "networkidle2".
    await page.setContent(htmlContent, { waitUntil: "load", timeout: 30000 });
    const tContent = Date.now();

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
    const tPdf = Date.now();

    console.log(
      `[pdf] timings ms — browser:${tBrowser - t0} setContent:${tContent - tBrowser} render:${tPdf - tContent} total:${tPdf - t0} htmlKB:${Math.round(htmlContent.length / 1024)}`,
    );

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
