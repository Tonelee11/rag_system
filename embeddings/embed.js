import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { chunkAllPages } from "./chunker.js";
import { embedChunks } from "./embedder.js";

dotenv.config();

const PAGES_FILE = "./output/pages.json";
const CHUNKS_FILE = "./output/chunks.json";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function run() {
  console.log("\n========================================");
  console.log("  TANZLITE AGENT — STAGE 2: EMBEDDINGS");
  console.log("========================================\n");

  // Security check — ensure API key is present
  if (!OPENAI_API_KEY || !OPENAI_API_KEY.startsWith("sk-")) {
    console.error("Error: OPENAI_API_KEY is missing or invalid in your .env file.");
    console.error("Make sure it starts with 'sk-'");
    process.exit(1);
  }

  // Load pages from Stage 1
  if (!fs.existsSync(PAGES_FILE)) {
    console.error("Error: output/pages.json not found. Run the crawler first.");
    process.exit(1);
  }

  const pages = JSON.parse(fs.readFileSync(PAGES_FILE, "utf-8"));
  console.log(`Loaded ${pages.length} pages from Stage 1.\n`);

  // Step 1: Chunk all pages
  console.log("Step 1: Chunking pages...");
  const chunks = chunkAllPages(pages);
  console.log(`Created ${chunks.length} chunks from ${pages.length} pages.\n`);

  // Show chunk distribution
  const byType = chunks.reduce((acc, c) => {
    acc[c.metadata.type] = (acc[c.metadata.type] || 0) + 1;
    return acc;
  }, {});
  console.log("Chunks by type:");
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log();

  // Step 2: Embed all chunks
  console.log("Step 2: Generating embeddings via OpenAI...");
  console.log(`Model: text-embedding-3-small`);
  console.log(`Estimated cost: ~$${((chunks.length * 500) / 1_000_000 * 0.02).toFixed(4)}\n`);

  const embeddedChunks = await embedChunks(chunks, OPENAI_API_KEY);

  // Step 3: Save to output
  console.log("\nStep 3: Saving chunks.json...");
  fs.writeFileSync(CHUNKS_FILE, JSON.stringify(embeddedChunks, null, 2), "utf-8");

  // Summary
  const vectorDimension = embeddedChunks[0]?.vector?.length || 0;
  console.log("\n========================================");
  console.log("         EMBEDDING SUMMARY");
  console.log("========================================");
  console.log(`Total chunks embedded: ${embeddedChunks.length}`);
  console.log(`Vector dimensions: ${vectorDimension}`);
  console.log(`Output: ./output/chunks.json`);
  console.log("========================================\n");

  console.log("Stage 2 complete. Ready for Stage 3 — Pinecone upload.");
}

run().catch((err) => {
  console.error("\nEmbedding failed:", err.message);
  process.exit(1);
});