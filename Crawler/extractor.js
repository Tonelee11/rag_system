import * as cheerio from "cheerio";

/**
 * Detects language - basic English vs Swahili check
 */
function detectLanguage(url, text) {
  const swahiliIndicators = [
    "/makala-za-kiswahili/",
    "/sw/",
    "habari",
    "karibu",
    "biashara",
    "huduma",
  ];
  const urlLower = url.toLowerCase();
  const textLower = text.toLowerCase();
  for (const indicator of swahiliIndicators) {
    if (urlLower.includes(indicator) || textLower.includes(indicator)) {
      return "sw";
    }
  }
  return "en";
}

/**
 * Detects page type from URL pattern
 */
function detectPageType(url) {
  if (
    url.includes("/blog") ||
    url.includes("/makala") ||
    url.includes("/digital-economy") ||
    url.includes("/blog-articles")
  ) {
    return "blog";
  }
  if (url.includes("/project/")) return "case-study";
  if (
    url.includes("/services") ||
    url.includes("/social-media") ||
    url.includes("/web-design") ||
    url.includes("/linkedin") ||
    url.includes("/paid-ads") ||
    url.includes("/content-marketing") ||
    url.includes("/marketing-strategy")
  ) {
    return "service";
  }
  if (url.includes("/contact")) return "contact";
  if (url.includes("/our-work")) return "portfolio";
  return "page";
}

/**
 * Extracts clean text from raw HTML, stripping all Divi/WP noise
 */
export function extractContent(html, url) {
  const $ = cheerio.load(html);

  // Remove all non-content elements
  $(
    [
      "script",
      "style",
      "noscript",
      "iframe",
      "nav",
      "header",
      "footer",
      ".et-pb-arrow-prev",
      ".et-pb-arrow-next",
      ".et_pb_menu",
      ".et_pb_header",
      ".et_pb_footer",
      "#main-footer",
      "#main-header",
      ".et_mobile_nav_menu",
      "#et-secondary-nav",
      ".et_pb_widget",
      ".wpcf7",
      ".cookie-notice",
      ".pum-overlay",
      '[class*="cookie"]',
      '[class*="popup"]',
      '[class*="modal"]',
      '[id*="cookie"]',
      ".wp-block-navigation",
      ".site-header",
      ".site-footer",
      ".breadcrumb",
      ".pagination",
      ".comments-area",
      "#comments",
    ].join(", ")
  ).remove();

  // Get page title
  const title =
    $("h1").first().text().trim() ||
    $("title").text().replace(" | Tanzlite Digital", "").trim() ||
    "Untitled";

  // Extract meta description
  const metaDesc =
    $('meta[name="description"]').attr("content")?.trim() || "";

  // Collect all meaningful text blocks
  const textBlocks = [];

  // Headings
  $("h1, h2, h3, h4").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 3) textBlocks.push(text);
  });

  // Paragraphs
  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) textBlocks.push(text);
  });

  // List items
  $("li").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 10) textBlocks.push(text);
  });

  // Divi text modules
  $(".et_pb_text_inner, .et_pb_blurb_content").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) textBlocks.push(text);
  });

  // Deduplicate adjacent identical blocks
  const seen = new Set();
  const unique = textBlocks.filter((block) => {
    const key = block.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const content = unique.join(" ").replace(/\s+/g, " ").trim();

  const pageType = detectPageType(url);
  const language = detectLanguage(url, content);

  return {
    url,
    title,
    metaDescription: metaDesc,
    type: pageType,
    language,
    content,
    charCount: content.length,
    crawledAt: new Date().toISOString(),
  };
}