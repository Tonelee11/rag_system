import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import * as dotenv from "dotenv";
import { chatRoute } from "./routes/chat.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://tonelee11.github.io";

// ── Security Middleware ─────────────────────────────────────────────

// CORS — only allow requests from tanzlite.com (or localhost for testing)
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
  ALLOWED_ORIGIN,
  "http://localhost",
  "http://localhost:5500",
  "http://127.0.0.1",
  "http://127.0.0.1:5500",
  "https://tonelee11.github.io",
  "https://tonelee11.github.io/rag_system",
  "https://www.tanzlite.com",
  "https://tanzlite.com",
  "https://ragsystem-production-f1b2.up.railway.app",
];
    // Allow requests with no origin (Postman, curl) during development
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: origin ${origin} not allowed`));
    }
  },
  methods: ["POST"],
  allowedHeaders: ["Content-Type", "x-api-key"],
}));

// Rate limiting — max 30 requests per 10 minutes per IP
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: {
    error: "Too many requests. Please wait a moment and try again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Parse JSON bodies — max 10kb to prevent abuse
app.use(express.json({ limit: "10kb" }));

// ── API Key Middleware ──────────────────────────────────────────────
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key || key !== process.env.AGENT_API_KEY) {
    return res.status(401).json({ error: "Unauthorized. Invalid or missing API key." });
  }
  next();
}

// ── Routes ─────────────────────────────────────────────────────────
app.use("/api/chat", requireApiKey, chatRoute);

// Health check — no auth needed
app.get("/health", (req, res) => {
  res.json({ status: "ok", agent: "Tanzlite Zara", version: "1.0.0" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found." });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(500).json({ error: "Internal server error." });
});

// ── Start Server ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("\n========================================");
  console.log("   TANZLITE AGENT — STAGE 5: REST API");
  console.log("========================================");
  console.log(`  Status:  Running`);
  console.log(`  Port:    ${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log(`  Chat:    http://localhost:${PORT}/api/chat`);
  console.log("========================================\n");
});
