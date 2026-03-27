import express from "express";
import { ask } from "../../agent/agent.js";

export const chatRoute = express.Router();

/**
 * POST /api/chat
 * Public endpoint — no API key required
 * Protected by CORS + rate limiting in server.js
 *
 * Body: {
 *   question: string,
 *   history?: [{role: "user"|"assistant", content: string}]
 * }
 */
chatRoute.post("/", async (req, res) => {
  const { question, history = [] } = req.body;

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
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "History must be an array." });
  }

  // Sanitize history
  const validRoles = ["user", "assistant"];
  const cleanHistory = history
    .filter((h) => h && validRoles.includes(h.role) && typeof h.content === "string")
    .map((h) => ({ role: h.role, content: h.content.slice(0, 1000) }))
    .slice(-20);

  try {
    const result = await ask(question, cleanHistory);

    return res.json({
      answer: result.answer,
      // Sources stripped — titles only, no raw text exposed
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