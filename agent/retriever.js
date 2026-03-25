import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || "tanzlite";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TOP_K = 5; // Number of most relevant chunks to retrieve

/**
 * Converts a user question into a vector using OpenAI
 */
async function embedQuery(question) {
  const response = await axios.post(
    "https://api.openai.com/v1/embeddings",
    {
      input: question,
      model: "text-embedding-3-small",
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );
  return response.data.data[0].embedding;
}

/**
 * Gets the Pinecone index host
 */
async function getIndexHost() {
  const response = await axios.get(
    `https://api.pinecone.io/indexes/${PINECONE_INDEX}`,
    {
      headers: { "Api-Key": PINECONE_API_KEY },
      timeout: 10000,
    }
  );
  return response.data.host;
}

/**
 * Searches Pinecone for the most relevant chunks
 */
async function searchPinecone(host, queryVector, filter = {}) {
  const body = {
    vector: queryVector,
    topK: TOP_K,
    includeMetadata: true,
  };

  // Optional filter e.g. by language
  if (Object.keys(filter).length > 0) {
    body.filter = filter;
  }

  const response = await axios.post(
    `https://${host}/query`,
    body,
    {
      headers: {
        "Api-Key": PINECONE_API_KEY,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );

  return response.data.matches || [];
}

/**
 * Full retrieval pipeline — embed question then search Pinecone
 */
export async function retrieve(question, filter = {}) {
  const queryVector = await embedQuery(question);
  const host = await getIndexHost();
  const matches = await searchPinecone(host, queryVector, filter);

  return matches.map((match) => ({
    score: match.score,
    text: match.metadata.text,
    url: match.metadata.url,
    title: match.metadata.title,
    type: match.metadata.type,
    language: match.metadata.language,
  }));
}