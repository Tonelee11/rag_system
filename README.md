# Tanzlite AI Agent — Zara

An AI-powered customer support agent for [Tanzlite Digita], built with RAG (Retrieval-Augmented Generation). Zara crawls the Tanzlite website, stores content as vectors in Pinecone, and answers customer questions using GPT-4o-mini with full conversation memory.

## Architecture

```
tanzlite.com → Crawler → Chunker → OpenAI Embeddings → Pinecone
                                                           ↓
site page ← REST API ← RAG Agent ← Vector Search ──┘
```

## Tech Stack

- **Crawler** — Node.js + Axios + Cheerio + WordPress REST API
- **Embeddings** — OpenAI `text-embedding-3-small`
- **Vector DB** — Pinecone (serverless)
- **LLM** — OpenAI `gpt-4o-mini`
- **API** — Express.js with rate limiting + CORS + API key auth
- **Frontend** — Vanilla HTML/JS chat widget

## Project Structure

```
tanzlite-agent/
├── crawler/          # Stage 1 — web crawler
├── embeddings/       # Stage 2 — chunking + embedding
├── pinecone/         # Stage 3 — vector upload
├── agent/            # Stage 4 — RAG agent + terminal chat
├── api/              # Stage 5 — REST API
│   └── routes/
├── widget/           # Stage 6 — chat UI
├── output/           # Generated files (gitignored)
├── .env.example      # Environment variable template
└── package.json
```

## Setup

### 1. Clone and install

### 3. Run the pipeline

```bash
# Crawl the website
npm run crawl

# Generate embeddings
npm run embed

# Upload to Pinecone
npm run upload

# Test in terminal
npm run chat

# Start the API
npm run dev
```

### 4. Test the API
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -d '{"question": "What services does Tanzlite offer?"}'
```

## Security

- All API keys stored in `.env` — never committed to git
- API protected with `x-api-key` header authentication
- Rate limiting: 30 requests per 10 minutes per IP
- CORS locked to allowed origins only
- Input sanitized against prompt injection attacks
- Conversation history validated and capped at 10 turns

## Stages

| Stage | Status | Description |
|-------|--------|-------------|
| 1 — Crawler | ✅ Done | Crawls tanzlite.com via sitemap + WP REST API |
| 2 — Embeddings | ✅ Done | Chunks content and generates OpenAI vectors |
| 3 — Pinecone | ✅ Done | Stores and retrieves vectors |
| 4 — AI Agent | ✅ Done | RAG agent with conversation memory |
| 5 — REST API | ✅ Done | Secure Express API |
| 6 — Widget | ✅ Done | WordPress chat widget |

## License

MIT — built for Tanzlite Digital, Dar es Salaam, Tanzania.
