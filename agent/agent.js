import axios from "axios";
import * as dotenv from "dotenv";
import { retrieve } from "./retriever.js";
import { buildSystemPrompt, buildUserMessage } from "./prompt.js";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4o-mini";

/**
 * Sends full conversation history to GPT and returns the response
 */
async function chat(systemPrompt, history) {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
      ],
      temperature: 0.2,
      max_tokens: 700,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  return response.data.choices[0].message.content;
}

/**
 * Main agent function
 * - question: current user message
 * - history: array of {role, content} from previous turns
 */
export async function ask(question, history = []) {
  // Retrieve relevant chunks based on the current question
  const chunks = await retrieve(question);

  if (chunks.length === 0) {
    return {
      answer: "I don't have enough information to answer that right now. Please visit tanzlite.com/contact and the team will be happy to help you.",
      sources: [],
    };
  }

  // Build system prompt with retrieved context
  const systemPrompt = buildSystemPrompt(chunks);

  // Build conversation history — previous turns + current question
  const conversationHistory = [
    ...history,
    { role: "user", content: buildUserMessage(question) },
  ];

  const answer = await chat(systemPrompt, conversationHistory);

  return {
    answer,
    sources: chunks.map((c) => ({ title: c.title, url: c.url, score: c.score })),
  };
}