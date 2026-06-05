import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

let cachedBrowser = null;
let browserLaunchPromise = null;

/**
 * Resolve the Chrome executable path.
 * Priority:
 *   1. PUPPETEER_EXECUTABLE_PATH env var (explicit, works on Render)
 *   2. puppeteer.executablePath() — the path bundled with the puppeteer package
 *      (works locally after `npm install` downloads Chromium)
 * Throws a clear, actionable error at startup instead of a cryptic one at
 * request time when neither path exists.
 */
const resolveChromePath = () => {
  // 1. Explicit override (set in .env / Render environment variables)
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && envPath.trim()) {
    if (fs.existsSync(envPath.trim())) {
      console.log(`[pdf] Using Chrome from PUPPETEER_EXECUTABLE_PATH: ${envPath.trim()}`);
      return envPath.trim();
    }
    // Env var is set but path doesn't exist — try to find it under the cache dir
    const cacheDir = process.env.PUPPETEER_CACHE_DIR;
    if (cacheDir && fs.existsSync(cacheDir)) {
      // Walk one level: <cache>/chrome/<version>/chrome-linux64/chrome
      try {
        const chromeSub = path.join(cacheDir, "chrome");
        const versions = fs.readdirSync(chromeSub);
        for (const ver of versions) {
          const candidates = [
            path.join(chromeSub, ver, "chrome-linux64", "chrome"),
            path.join(chromeSub, ver, "chrome-win64", "chrome.exe"),
            path.join(chromeSub, ver, "chrome-mac-x64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
          ];
          for (const c of candidates) {
            if (fs.existsSync(c)) {
              console.log(`[pdf] Auto-resolved Chrome under PUPPETEER_CACHE_DIR: ${c}`);
              return c;
            }
          }
        }
      } catch (_) { /* fall through */ }
    }
    console.warn(`[pdf] PUPPETEER_EXECUTABLE_PATH set to "${envPath}" but file not found — falling back to bundled Chromium.`);
  }

  // 2. puppeteer.executablePath() — resolves using the package's own install record
  try {
    const bundled = puppeteer.executablePath();
    if (bundled && fs.existsSync(bundled)) {
      console.log(`[pdf] Using bundled Chromium: ${bundled}`);
      return bundled;
    }
  } catch (_) { /* puppeteer-core has no bundled binary */ }

  // 3. Scan the default Puppeteer cache dir (~/.cache/puppeteer) for any installed Chrome
  //    This handles local dev on Windows/Mac/Linux without any env var needed.
  const homeCacheDir = path.join(
    process.env.HOME || process.env.USERPROFILE || "",
    ".cache", "puppeteer", "chrome"
  );
  if (fs.existsSync(homeCacheDir)) {
    try {
      const versions = fs.readdirSync(homeCacheDir);
      for (const ver of versions) {
        const candidates = [
          path.join(homeCacheDir, ver, "chrome-win64", "chrome.exe"),
          path.join(homeCacheDir, ver, "chrome-linux64", "chrome"),
          path.join(homeCacheDir, ver, "chrome-mac-x64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
        ];
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            console.log(`[pdf] Auto-resolved Chrome from home cache: ${c}`);
            return c;
          }
        }
      }
    } catch (_) { /* fall through */ }
  }


  throw new Error(
    "[pdf] No Chrome/Chromium binary found. " +
    "On Render: set PUPPETEER_EXECUTABLE_PATH in your environment variables to the full path of the chrome binary inside PUPPETEER_CACHE_DIR. " +
    "Locally: run `npx puppeteer browsers install chrome` to download Chromium."
  );
};

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

  const executablePath = resolveChromePath();

  browserLaunchPromise = puppeteer
    .launch({
      headless: "new",
      executablePath,
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

    // Allow data URIs and requests to our own S3 bucket (for floor plan /
    // facade images). Block everything else (Google Fonts, CDNs, etc.) so a
    // slow external asset can't stall or timeout PDF generation.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      const s3Bucket = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || "";
      const isS3 = s3Bucket && url.includes(s3Bucket);
      const isAmazonS3 = url.includes(".s3.") && url.includes("amazonaws.com");
      if (url.startsWith("data:") || isS3 || isAmazonS3) {
        req.continue().catch(() => {});
      } else if (url.startsWith("http://") || url.startsWith("https://")) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    // "networkidle2" waits until no more than 2 network connections for at
    // least 500ms — handles the async S3 image loads gracefully.
    await page.setContent(htmlContent, { waitUntil: "networkidle2", timeout: 30000 });
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
