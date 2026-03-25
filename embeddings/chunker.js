/**
 * Splits a page's content into overlapping chunks
 * Each chunk is ~500 words with 50-word overlap to preserve context
 */

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

/**
 * Splits text into word array
 */
function tokenize(text) {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Chunks a single page into overlapping segments
 */
export function chunkPage(page) {
  const words = tokenize(page.content);
  const chunks = [];

  if (words.length === 0) return chunks;

  // If content is short enough, keep as single chunk
  if (words.length <= CHUNK_SIZE) {
    chunks.push({
      id: `${sanitizeId(page.url)}_chunk_0`,
      text: page.content.trim(),
      metadata: {
        url: page.url,
        title: page.title,
        type: page.type,
        language: page.language,
        chunkIndex: 0,
        totalChunks: 1,
      },
    });
    return chunks;
  }

  // Split into overlapping chunks
  let start = 0;
  let chunkIndex = 0;

  while (start < words.length) {
    const end = Math.min(start + CHUNK_SIZE, words.length);
    const chunkWords = words.slice(start, end);
    const text = chunkWords.join(" ");

    chunks.push({
      id: `${sanitizeId(page.url)}_chunk_${chunkIndex}`,
      text,
      metadata: {
        url: page.url,
        title: page.title,
        type: page.type,
        language: page.language,
        chunkIndex,
        totalChunks: -1, // updated after all chunks created
      },
    });

    chunkIndex++;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  // Update totalChunks now that we know the count
  chunks.forEach((c) => (c.metadata.totalChunks = chunks.length));

  return chunks;
}

/**
 * Converts a URL into a safe ID string for Pinecone
 */
function sanitizeId(url) {
  return url
    .replace(/https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

/**
 * Chunks all pages and returns flat array of all chunks
 */
export function chunkAllPages(pages) {
  const allChunks = [];

  for (const page of pages) {
    if (!page.content || page.content.length < 50) continue;
    const chunks = chunkPage(page);
    allChunks.push(...chunks);
  }

  return allChunks;
}