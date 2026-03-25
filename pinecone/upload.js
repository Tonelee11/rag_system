import fs from "fs";
import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const CHUNKS_FILE = "./output/chunks.json";
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || "tanzlite";
const BATCH_SIZE = 50; // Pinecone recommends max 100 vectors per upsert

/**
 * Gets the Pinecone index host URL
 */
async function getIndexHost() {
  const response = await axios.get(
    `https://api.pinecone.io/indexes/${PINECONE_INDEX}`,
    {
      headers: {
        "Api-Key": PINECONE_API_KEY,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    }
  );
  return response.data.host;
}

/**
 * Upserts a batch of vectors into Pinecone
 */
async function upsertBatch(host, vectors) {
  await axios.post(
    `https://${host}/vectors/upsert`,
    { vectors },
    {
      headers: {
        "Api-Key": PINECONE_API_KEY,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );
}

/**
 * Formats a chunk into Pinecone vector format
 */
function formatVector(chunk) {
  return {
    id: chunk.id,
    values: chunk.vector,
    metadata: {
      url: chunk.metadata.url,
      title: chunk.metadata.title,
      type: chunk.metadata.type,
      language: chunk.metadata.language,
      chunkIndex: chunk.metadata.chunkIndex,
      totalChunks: chunk.metadata.totalChunks,
      text: chunk.text.slice(0, 1000), // Pinecone metadata limit — store preview
    },
  };
}

/**
 * Verifies the upload by checking index stats
 */
async function verifyUpload(host) {
  const response = await axios.get(`https://${host}/describe_index_stats`, {
    headers: {
      "Api-Key": PINECONE_API_KEY,
      "Content-Type": "application/json",
    },
    timeout: 10000,
  });
  return response.data;
}

async function run() {
  console.log("\n========================================");
  console.log("  TANZLITE AGENT — STAGE 3: PINECONE");
  console.log("========================================\n");

  // Security checks
  if (!PINECONE_API_KEY) {
    console.error("Error: PINECONE_API_KEY is missing in your .env file.");
    process.exit(1);
  }

  if (!fs.existsSync(CHUNKS_FILE)) {
    console.error("Error: output/chunks.json not found. Run Stage 2 first.");
    process.exit(1);
  }

  // Load chunks from Stage 2
  const chunks = JSON.parse(fs.readFileSync(CHUNKS_FILE, "utf-8"));
  console.log(`Loaded ${chunks.length} chunks from Stage 2.`);

  // Validate all chunks have vectors
  const validChunks = chunks.filter(
    (c) => c.vector && Array.isArray(c.vector) && c.vector.length === 1536
  );

  if (validChunks.length !== chunks.length) {
    console.warn(
      `Warning: ${chunks.length - validChunks.length} chunks missing vectors — skipping them.`
    );
  }

  console.log(`Uploading ${validChunks.length} vectors to Pinecone...\n`);

  // Step 1: Get index host
  console.log("Step 1: Connecting to Pinecone index...");
  let host;
  try {
    host = await getIndexHost();
    console.log(`Connected. Host: ${host}\n`);
  } catch (err) {
    console.error(
      "Error connecting to Pinecone:",
      err.response?.data?.message || err.message
    );
    console.error(
      "Check your PINECONE_API_KEY and PINECONE_INDEX in .env file."
    );
    process.exit(1);
  }

  // Step 2: Upload in batches
  console.log("Step 2: Uploading vectors...\n");
  const totalBatches = Math.ceil(validChunks.length / BATCH_SIZE);
  let uploaded = 0;

  for (let i = 0; i < validChunks.length; i += BATCH_SIZE) {
    const batch = validChunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    process.stdout.write(
      `  Batch ${batchNum}/${totalBatches} (${batch.length} vectors)... `
    );

    try {
      const vectors = batch.map(formatVector);
      await upsertBatch(host, vectors);
      uploaded += batch.length;
      console.log("done");
    } catch (err) {
      console.error(
        `\n  Error on batch ${batchNum}:`,
        err.response?.data?.message || err.message
      );
      throw err;
    }

    // Small delay between batches
    if (i + BATCH_SIZE < validChunks.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Step 3: Verify
  console.log("\nStep 3: Verifying upload...");
  await new Promise((r) => setTimeout(r, 3000)); // Wait for index to update
  const stats = await verifyUpload(host);

  console.log("\n========================================");
  console.log("         PINECONE UPLOAD SUMMARY");
  console.log("========================================");
  console.log(`Vectors uploaded: ${uploaded}`);
  console.log(`Vectors in index: ${stats.totalVectorCount}`);
  console.log(`Index dimension:  ${stats.dimension}`);
  console.log("========================================\n");

  if (stats.totalVectorCount >= uploaded) {
    console.log("Stage 3 complete. All vectors confirmed in Pinecone.");
    console.log("Ready for Stage 4 — AI Agent + RAG.\n");
  } else {
    console.warn("Warning: Vector count mismatch. Some vectors may not have uploaded.");
    console.warn("Wait a few seconds and check your Pinecone dashboard.\n");
  }
}

run().catch((err) => {
  console.error("\nUpload failed:", err.message);
  process.exit(1);
});