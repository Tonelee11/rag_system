import express from "express";
import { ask } from "../../agent/agent.js";

export const chatRoute = express.Router();

/**
 * POST /api/chat
 * Body: {
 *   question: string,
 *   history?: [{role: "user"|"assistant", content: string}],
 *   language?: "en" | "sw"
 * }
 * Headers: x-api-key: your-key
 */
chatRoute.post("/", async (req, res) => {
  const { question, history = [], language } = req.body;

  // Input validation
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'question' field." });
  }
  if (question.trim().length < 2) {
    return res.status(400).json({ error: "Question is too short." });
  }
  if (question.length > 500) {
    return res.status(400).json({ error: "Question too long. Maximum 500 characters." });
  }

  // Validate history format — must be array of {role, content}
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "History must be an array." });
  }

  // Sanitize history — only keep valid turns, max last 10 turns
  const validRoles = ["user", "assistant"];
  const cleanHistory = history
    .filter((h) => h && validRoles.includes(h.role) && typeof h.content === "string")
    .map((h) => ({ role: h.role, content: h.content.slice(0, 1000) }))
    .slice(-20); // max 10 turns (20 messages)

  // Optional language filter
  const filter = {};
  if (language && ["en", "sw"].includes(language)) {
    filter.language = language;
  }

  try {
    const result = await ask(question, cleanHistory, filter);

    return res.json({
      answer: result.answer,
      sources: result.sources.map((s) => ({
        title: s.title,
        url: s.url,
      })),
    });
  } catch (err) {
    console.error("Chat route error:", err.message);
    return res.status(500).json({
      error: "The agent encountered an error. Please try again.",
    });
  }
});