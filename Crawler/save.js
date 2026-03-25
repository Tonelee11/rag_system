import fs from "fs";
import path from "path";

const OUTPUT_DIR = "./output";
const OUTPUT_FILE = path.join(OUTPUT_DIR, "pages.json");

/**
 * Ensures the output directory exists and resets the file for a fresh crawl
 */
export function initOutput() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  // Always start fresh on a new crawl
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 2), "utf-8");
  console.log("Output cleared — starting fresh crawl.\n");
}

/**
 * Appends a single page result to the output JSON file
 */
export function savePage(pageData) {
  const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));

  // Avoid duplicate URLs
  const alreadyExists = existing.some((p) => p.url === pageData.url);
  if (alreadyExists) return false;

  existing.push(pageData);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existing, null, 2), "utf-8");
  return true;
}

/**
 * Prints a summary of the crawl results
 */
export function printSummary() {
  const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));

  const byType = data.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {});

  const byLang = data.reduce((acc, p) => {
    acc[p.language] = (acc[p.language] || 0) + 1;
    return acc;
  }, {});

  console.log("\n========================================");
  console.log("         CRAWL SUMMARY");
  console.log("========================================");
  console.log(`Total pages saved: ${data.length}`);
  console.log("\nBy type:");
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log("\nBy language:");
  Object.entries(byLang).forEach(([lang, count]) => {
    console.log(`  ${lang}: ${count}`);
  });
  console.log(`\nOutput: ./output/pages.json`);
  console.log("========================================\n");
}