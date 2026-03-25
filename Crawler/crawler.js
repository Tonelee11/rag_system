import axios from "axios";
import { parseStringPromise } from "xml2js";
import * as dotenv from "dotenv";
import { extractContent } from "./extractor.js";
import { initOutput, savePage, printSummary } from "./save.js";

dotenv.config();

const TARGET_URL = process.env.TARGET_URL || "https://www.tanzlite.com";
const SITEMAP_URL = process.env.SITEMAP_URL || "https://www.tanzlite.com/sitemap.xml";
const CRAWL_DELAY_MS = parseInt(process.env.CRAWL_DELAY_MS || "1500");
const MAX_PAGES = parseInt(process.env.MAX_PAGES || "200");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches all URLs from sitemap (including nested sitemaps)
 */
async function getUrlsFromSitemap(sitemapUrl, visited = new Set()) {
  if (visited.has(sitemapUrl)) return [];
  visited.add(sitemapUrl);

  console.log(`  Reading sitemap: ${sitemapUrl}`);
  const urls = [];

  try {
    const res = await axios.get(sitemapUrl, {
      timeout: 10000,
      headers: { "User-Agent": "TanzliteBot/1.0 (internal crawler)" },
    });

    const parsed = await parseStringPromise(res.data);

    if (parsed.sitemapindex) {
      const nested = parsed.sitemapindex.sitemap || [];
      for (const s of nested) {
        const nestedUrl = s.loc?.[0];
        if (nestedUrl) {
          const nestedUrls = await getUrlsFromSitemap(nestedUrl, visited);
          urls.push(...nestedUrls);
        }
      }
    }

    if (parsed.urlset) {
      const entries = parsed.urlset.url || [];
      for (const entry of entries) {
        const loc = entry.loc?.[0];
        if (loc && loc.startsWith(TARGET_URL)) {
          urls.push(loc);
        }
      }
    }
  } catch (err) {
    console.warn(`  Warning: Could not read sitemap ${sitemapUrl} — ${err.message}`);
  }

  return urls;
}

/**
 * Fetches ALL blog posts via WordPress REST API
 * This gets every post including ones not in the sitemap
 */
async function getPostsFromWPAPI() {
  console.log("  Fetching posts via WordPress REST API...");
  const posts = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    try {
      const res = await axios.get(
        `${TARGET_URL}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_fields=id,link,title,content,excerpt,categories,date`,
        {
          timeout: 15000,
          headers: { "User-Agent": "TanzliteBot/1.0 (internal crawler)" },
        }
      );

      const data = res.data;
      if (!data || data.length === 0) break;

      for (const post of data) {
        posts.push({
          url: post.link,
          title: post.title?.rendered || "Untitled",
          content: stripHtml(post.content?.rendered || ""),
          excerpt: stripHtml(post.excerpt?.rendered || ""),
          type: "blog",
          language: detectLanguage(post.link, post.title?.rendered || ""),
          charCount: (post.content?.rendered || "").length,
          crawledAt: new Date().toISOString(),
          metaDescription: stripHtml(post.excerpt?.rendered || "").slice(0, 160),
        });
      }

      console.log(`    Page ${page}: fetched ${data.length} posts`);

      // Check if there are more pages
      const totalPages = parseInt(res.headers["x-wp-totalpages"] || "1");
      if (page >= totalPages) break;
      page++;

      await delay(500);
    } catch (err) {
      if (err.response?.status === 400) break; // No more pages
      console.warn(`  Warning: WP API error — ${err.message}`);
      break;
    }
  }

  console.log(`  Total posts from WP API: ${posts.length}`);
  return posts;
}

/**
 * Fetches all pages via WordPress REST API
 */
async function getPagesFromWPAPI() {
  console.log("  Fetching pages via WordPress REST API...");
  const pages = [];

  try {
    const res = await axios.get(
      `${TARGET_URL}/wp-json/wp/v2/pages?per_page=100&_fields=id,link,title,content,excerpt,date`,
      {
        timeout: 15000,
        headers: { "User-Agent": "TanzliteBot/1.0 (internal crawler)" },
      }
    );

    for (const page of res.data) {
      pages.push({
        url: page.link,
        title: page.title?.rendered || "Untitled",
        content: stripHtml(page.content?.rendered || ""),
        type: detectPageType(page.link),
        language: detectLanguage(page.link, page.title?.rendered || ""),
        charCount: (page.content?.rendered || "").length,
        crawledAt: new Date().toISOString(),
        metaDescription: stripHtml(page.excerpt?.rendered || "").slice(0, 160),
      });
    }

    console.log(`  Total pages from WP API: ${pages.length}`);
  } catch (err) {
    console.warn(`  Warning: Could not fetch pages from WP API — ${err.message}`);
  }

  return pages;
}

/**
 * Strips HTML tags from text
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects language from URL and title
 */
function detectLanguage(url, text = "") {
  const swahiliKeywords = [
    "/makala", "/kiswahili", "/matumizi", "/kuza-biashara",
    "/fahamu", "/kazi-ya", "/je-mtandao", "/biashara",
  ];
  const urlLower = url.toLowerCase();
  for (const kw of swahiliKeywords) {
    if (urlLower.includes(kw)) return "sw";
  }
  return "en";
}

/**
 * Detects page type from URL
 */
function detectPageType(url) {
  const urlLower = url.toLowerCase();

  // Skip author pages, category archives, tag pages
  if (urlLower.includes("/author/") || urlLower.includes("/category/") || urlLower.includes("/tag/")) {
    return "archive";
  }
  if (urlLower.includes("/contact")) return "contact";
  if (urlLower.includes("/our-work") || urlLower.includes("/project/")) return "case-study";
  if (
    urlLower.includes("/services") ||
    urlLower.includes("/social-media-marketing") ||
    urlLower.includes("/social-media-for-business") ||
    urlLower.includes("/social-media-in-tanzania") ||
    urlLower.includes("/web-design") ||
    urlLower.includes("/linkedin") ||
    urlLower.includes("/paid-ads") ||
    urlLower.includes("/content-marketing") ||
    urlLower.includes("/marketing-strategy")
  ) return "service";

  return "page";
}

/**
 * Crawls a single URL using HTTP (fallback for pages not in WP API)
 */
async function crawlPage(url) {
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "TanzliteBot/1.0 (internal crawler)",
        Accept: "text/html",
      },
      maxRedirects: 5,
    });

    const contentType = res.headers["content-type"] || "";
    if (!contentType.includes("text/html")) return null;

    return extractContent(res.data, url);
  } catch (err) {
    console.warn(`  Skipped ${url} — ${err.message}`);
    return null;
  }
}

/**
 * Main crawl function
 */
async function run() {
  console.log("\n========================================");
  console.log("    TANZLITE AGENT — STAGE 1: CRAWLER");
  console.log("           (Enhanced Version)");
  console.log("========================================\n");

  // Clear old output and start fresh
  initOutput();

  let saved = 0;

  // ── Method 1: WordPress REST API (best quality) ──────────────
  console.log("Method 1: WordPress REST API\n");

  const wpPosts = await getPostsFromWPAPI();
  const wpPages = await getPagesFromWPAPI();

  // Save all WP API results — skip archives and very short content
  const skipTypes = ["archive"];
  for (const item of [...wpPosts, ...wpPages]) {
    if (skipTypes.includes(item.type)) continue;
    if (item.content.length < 100) continue;
    const wasSaved = savePage(item);
    if (wasSaved) saved++;
  }

  console.log(`\nSaved ${saved} items from WordPress API.\n`);

  // ── Method 2: Sitemap crawler (catches non-WP pages) ─────────
  console.log("Method 2: Sitemap crawler for remaining pages\n");

  const allUrls = await getUrlsFromSitemap(SITEMAP_URL);
  const uniqueUrls = [...new Set(allUrls)].slice(0, MAX_PAGES);
  console.log(`\nFound ${uniqueUrls.length} URLs in sitemap.`);

  // Filter out URLs already saved and skip archive/author pages
  const { default: fs } = await import("fs");
  const existing = JSON.parse(fs.readFileSync("./output/pages.json", "utf-8"));
  const savedUrls = new Set(existing.map((p) => p.url));

  const skipPatterns = ["/author/", "/category/", "/tag/", "/feed/", "/page/", "?", "#"];
  const remainingUrls = uniqueUrls.filter(
    (url) => !savedUrls.has(url) && !skipPatterns.some((p) => url.includes(p))
  );

  console.log(`Crawling ${remainingUrls.length} additional URLs not yet saved...\n`);

  for (let i = 0; i < remainingUrls.length; i++) {
    const url = remainingUrls[i];
    const progress = `[${i + 1}/${remainingUrls.length}]`;

    process.stdout.write(`${progress} ${url} ... `);

    const pageData = await crawlPage(url);

    if (pageData && pageData.content.length > 100) {
      const wasSaved = savePage(pageData);
      if (wasSaved) {
        console.log(`saved (${pageData.charCount} chars, ${pageData.type}, ${pageData.language})`);
        saved++;
      } else {
        console.log("duplicate, skipped");
      }
    } else {
      console.log("no content, skipped");
    }

    if (i < remainingUrls.length - 1) await delay(CRAWL_DELAY_MS);
  }

  printSummary();
}

run().catch((err) => {
  console.error("\nCrawler failed:", err.message);
  process.exit(1);
});