const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const demoUrl = pathToFileURL(path.join(root, "index.html")).href;
const screenshotDir = path.join(root, "screenshots");

async function main() {
  const browserCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  const executablePath = browserCandidates.find((candidate) => fs.existsSync(candidate));
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const runtimeErrors = [];

  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });

  await page.goto(demoUrl, { waitUntil: "load" });
  await page.locator("#trend-chart svg").waitFor();

  const kpiCount = await page.locator(".kpi-card").count();
  const riskCount = await page.locator(".risk-item").count();
  if (kpiCount !== 5) throw new Error(`Expected 5 KPI cards, found ${kpiCount}`);
  if (riskCount !== 4) throw new Error(`Expected 4 risk items, found ${riskCount}`);

  await page.screenshot({
    path: path.join(screenshotDir, "desktop-overview.png"),
    fullPage: true,
  });

  const beforeForecast = await page.locator("#forecast-income").innerText();
  await page.locator("#growth-range").evaluate((element) => {
    element.value = "8";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const afterForecast = await page.locator("#forecast-income").innerText();
  if (beforeForecast === afterForecast) {
    throw new Error("Forecast KPI did not update after changing revenue growth.");
  }

  await page.locator("#file-input").setInputFiles(path.join(root, "data", "sample_financials.csv"));
  await page.locator("#toast").waitFor({ state: "visible" });
  if (!(await page.locator("#company-name").innerText()).includes("本地导入")) {
    throw new Error("Imported CSV did not update the dashboard state.");
  }

  await page.reload({ waitUntil: "load" });
  await page.locator("#trend-chart svg").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileDimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (mobileDimensions.scrollWidth > mobileDimensions.clientWidth) {
    throw new Error(`Mobile layout overflows: ${JSON.stringify(mobileDimensions)}`);
  }
  await page.screenshot({
    path: path.join(screenshotDir, "mobile-overview.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 320, height: 720 });
  const narrowDimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (narrowDimensions.scrollWidth > narrowDimensions.clientWidth) {
    throw new Error(`Narrow layout overflows: ${JSON.stringify(narrowDimensions)}`);
  }

  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: path.join(screenshotDir, "demo-report.pdf"),
    printBackground: true,
    format: "A4",
  });

  if (runtimeErrors.length) {
    throw new Error(runtimeErrors.join("\n"));
  }

  console.log(
    JSON.stringify(
      {
        demoUrl,
        kpiCount,
        riskCount,
        forecastChangedFrom: beforeForecast,
        forecastChangedTo: afterForecast,
        mobileDimensions,
        narrowDimensions,
        screenshots: [
          "screenshots/desktop-overview.png",
          "screenshots/mobile-overview.png",
          "screenshots/demo-report.pdf",
        ],
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
