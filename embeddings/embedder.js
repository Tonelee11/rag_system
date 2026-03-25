import axios from "axios";

const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";
const BATCH_SIZE = 20; // OpenAI allows up to 100 per request — we keep it conservative

/**
 * Sends a batch of texts to OpenAI and returns their vectors
 */
async function embedBatch(texts, apiKey) {
  const response = await axios.post(
    OPENAI_API_URL,
    {
      input: texts,
      model: MODEL,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  return response.data.data.map((item) => item.embedding);
}

/**
 * Embeds all chunks in batches, returns chunks with vectors attached
 */
export async function embedChunks(chunks, apiKey) {
  const results = [];
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    process.stdout.write(
      `  Embedding batch ${batchNum}/${totalBatches} (${batch.length} chunks)... `
    );

    try {
      const vectors = await embedBatch(
        batch.map((c) => c.text),
        apiKey
      );

      batch.forEach((chunk, idx) => {
        results.push({
          ...chunk,
          vector: vectors[idx],
        });
      });

      console.log("done");
    } catch (err) {
      // Handle rate limiting gracefully
      if (err.response?.status === 429) {
        console.log("rate limited, waiting 10s...");
        await new Promise((r) => setTimeout(r, 10000));
        i -= BATCH_SIZE; // retry this batch
        continue;
      }
      console.error(`\n  Error on batch ${batchNum}:`, err.response?.data?.error?.message || err.message);
      throw err;
    }

    // Small delay between batches to be safe
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}