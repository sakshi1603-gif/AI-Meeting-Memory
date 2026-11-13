# AI Meeting Memory

Record meetings, get a live transcript and AI-generated notes, then ask questions across your whole meeting history and get answers with citations.

**Live demo:** https://ai-meeting-memory.vercel.app · **Backend:** https://ai-meeting-memory.onrender.com

## Features

- **Live transcription:** browser mic audio streams over Socket.IO to Deepgram; transcript appears in 1-2 s.
- **AI meeting notes:** title, summary, decisions, and action items (owner, due date) with Zod-validated structured output. Summaries can be regenerated.
- **Meeting management:** meeting list and detail views; deleting a meeting also removes its transcript and memory chunks.
- **Cross-meeting search (RAG):** ask a question in natural language; answers cite the source meeting and timestamp, optionally filtered to one meeting. If the excerpts don't contain the answer, the model says so instead of guessing.
- **Auth and isolation:** JWT auth, bcrypt password hashing, and user-scoped queries with ownership checks on every meeting operation.

## Tech stack

| Area | Technologies |
|---|---|
| Frontend | React, Vite, React Router |
| Backend | Node.js, Express, TypeScript |
| Real-time | Socket.IO, Deepgram streaming |
| LLM and embeddings | Google Gemini (`@google/genai`), `gemini-embedding-001` |
| Database and vector search | MongoDB, Mongoose, MongoDB Atlas Vector Search |
| Auth and validation | JWT, bcrypt, Zod |
| Deployment | Vercel (frontend), Render (backend) |

## Architecture

```text
Browser (React) ──MediaRecorder──▶ Socket.IO ──▶ Express backend ──▶ Deepgram
        ▲                                              │
        └──────── partial / final transcript ──────────┘

Meeting ends:
  persist transcript ─▶ MongoDB
  ─▶ Gemini structured summarization ─▶ save title, summary, decisions, action items
  ─▶ chunk transcript ─▶ embed ─▶ store memory chunks

Search:
  question ─▶ embed ─▶ Atlas Vector Search (scoped to user)
  ─▶ load meeting metadata ─▶ Gemini grounded answer ─▶ answer + citations
```

### RAG pipeline

1. Split the transcript into chunks and embed each one (768 dimensions).
2. Store chunk text, embedding, `userId`, `meetingId`, speakers, and start/end times in MongoDB.
3. Embed the question and run Atlas Vector Search (index `vector_index`, field `embedding`, limit 8, candidates `limit * 15`), filtered by `userId` and optionally `meetingId`.
4. Build excerpts with meeting title, date, and timestamps, and ask Gemini to answer only from them, returning JSON.
5. Validate the response (with a coercion path for malformed or overlong fields) and return the answer with citations.

The Atlas index must match the embedding field and dimensions above.

## Project structure

```text
Backend/    src/{models,services,controllers,routes}, server.ts
Frontend/   src/{components,pages}
```

## Environment variables

Create `Backend/.env` (never commit it):

```env
PORT=5000
FRONTEND_URL=http://localhost:5173

MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=7d

DEEPGRAM_API_KEY=your_deepgram_api_key
GEMINI_API_KEY=your_gemini_api_key

GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_MODEL=your_supported_gemini_generation_model
GEMINI_FALLBACK_MODEL=your_supported_fallback_model
```

Model names change; use models available to your Google AI API key. In production, set these in the Render dashboard.

## Local setup

Prerequisites: Node.js, a MongoDB Atlas cluster with the vector index above, and Gemini and Deepgram API keys.

```bash
git clone https://github.com/sakshi1603-gif/AI-Meeting-Memory.git
cd AI-Meeting-Memory

# backend (http://localhost:5000)
cd Backend && npm install && npm run dev

# frontend (http://localhost:5173), in a second terminal
cd Frontend && npm install && npm run dev
```

Type-check the backend with `npx tsc --noEmit`.

## Performance

Measured on 13 November 2026. These are real observations from different environments, not a controlled load test.

**Production `/query`, browser Network panel (6 requests):** 2.28, 9.51, 2.80, 27.68, 1.87, 3.88 s

| | Median | Mean | Min | Max |
|---|---:|---:|---:|---:|
| End-to-end | 3.34 s | 8.00 s | 1.87 s | 27.68 s |

**Local RAG stage timings (3 runs):**

| Stage | Run 1 | Run 2 | Run 3 |
|---|---:|---:|---:|
| Embedding | 1,149 ms | 939 ms | 619 ms |
| Vector search | 155 ms | 264 ms | 90 ms |
| Metadata lookup | 46 ms | 50 ms | 49 ms |
| Gemini | 2,120 ms | 1,592 ms | 3,997 ms |
| **Total** | **3,470 ms** | **2,845 ms** | **4,755 ms** |

Mean total 3.69 s; mean Gemini stage 2.57 s.

**Other:** meetings list ~439 ms, meeting detail ~454 ms, end meeting to summary visible ~4 s, live transcript 1-2 s.

- Gemini generation is the largest share of RAG latency and the source of the variance (earlier local diagnostics ranged from ~1.9 s to over 35 s for that stage).
- The 27.68 s request skews the production mean; the median is the better typical figure.
- Six requests are too few for p95/p99. Concurrency and sustained load are not measured.

## Testing

Manually verified (no automated test suite yet):

- Live streaming, Deepgram transcription, and transcript persistence
- Summary and title generation, regenerate summary, meeting deletion including memory records
- Cross-user isolation (a second account cannot access another user's meetings)
- Multi-meeting RAG, unsupported questions (graceful "not found"), no-speech meetings
- Mic permission denied, duplicate "End meeting" clicks
- Atlas chunks contain `userId`, `meetingId`, and 768-dim embeddings
- Production `/query` through the deployed app; backend `tsc --noEmit` passes

## Known limitations

- **LLM latency varies** widely between requests (1.87-27.68 s in production sampling).
- **Citation quotes** longer than the schema's 200-character limit are truncated; a validation warning has still appeared in local logs.
- **Deepgram** timeouts and reconnects have been observed; possible audio loss has not been ruled out.
- **Meeting duration** can display longer than the actual recording.
- **Not yet tested:** concurrent users, p95/p99 latency, sustained load.

## Planned

- Fixed-question production benchmark with enough samples for p50/p95/p99
- Concurrency and load testing
- Reconnection handling for Deepgram and a corrected duration calculation
- Loading states or streaming for slow LLM responses
