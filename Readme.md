# AI Meeting Memory System

Teams make real decisions in meetings, but that decision-making disappears into scattered notes, memory, and chat threads. Weeks later, nobody can answer "what did we actually agree on last time" without hunting through people's memory or re-reading transcripts nobody has time for.

**AI Meeting Memory turns every meeting into a searchable, permanent institutional memory** — record a meeting, get an AI-generated summary with decisions and action items automatically, then ask it a plain-language question across *all* your meetings and get a grounded answer with a citation to exactly which meeting it came from.

---

## Features

| Feature | Status |
|---|---|
| Live mic capture + real-time transcription (Deepgram streaming) | ✅ Working |
| Persistent meeting storage (MongoDB) | ✅ Working |
| AI-generated summary per meeting | ✅ Working |
| Decision & action item extraction with owners | ✅ Working |
| Semantic memory search across all meetings (RAG) | ✅ Working |
| Cited, grounded answers (meeting + timestamp) | ✅ Working |
| Meeting dashboard (list + detail view) | ✅ Working |
| Auth / user accounts, data scoped per user | ✅ Working |
| Speaker diarization | ⬜ Not implemented |
| Action item tracker with due dates | ⬜ Not implemented (schema supports it, no UI) |
| Export summary as PDF / email | ⬜ Not implemented |
| Live deployment | 🚧 In progress |

The first 8 are the core product — everything above the line works end-to-end today, not just in isolation. The bottom three are intentionally out of scope for now rather than half-built.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite, TypeScript |
| Realtime | Socket.io (live audio streaming + live transcript) |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Vector search | MongoDB Atlas Vector Search |
| Speech-to-text | Deepgram (streaming API, `nova-3`) |
| LLM (summarization + RAG answers) | Google Gemini |
| Embeddings | Gemini embeddings, 768 dimensions |
| Auth | JWT + bcrypt |
| Styling | Plain CSS, custom design tokens (no framework) |
| Frontend hosting | Vercel *(pending)* |
| Backend hosting | Render *(pending — needs a persistent server, not serverless, for long-lived sockets)* |

---

## Architecture

**Flow A — Live recording**

1. Browser's `MediaRecorder` captures mic audio in small chunks.
2. Each chunk streams to the backend over an authenticated Socket.io connection.
3. Backend forwards each chunk to Deepgram's streaming endpoint as it arrives.
4. Deepgram returns transcript segments in real time; backend relays them back to the client as live captions.
5. On "End meeting," the backend saves the full transcript to MongoDB and kicks off two background jobs: summarization (summary, decisions, action items via Gemini) and embedding (chunk the transcript, embed each chunk, store vectors) — both async so the user isn't blocked.

**Flow B — Memory query (RAG)**

1. User asks a question, either scoped to one meeting or across all of them.
2. The question is embedded and matched against stored vectors via Atlas Vector Search, filtered to the current user (and meeting, if scoped).
3. The top matching transcript chunks are passed to Gemini along with the question.
4. Gemini returns an answer grounded only in those excerpts, with citations back to the source meeting and timestamp.

---

## Setup

```bash
# backend
cd backend
npm install
```

Create `backend/.env`:

```
MONGODB_URI=your_atlas_connection_string
JWT_SECRET=your_secret
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_key
GEMINI_EMBEDDING_MODEL=text-embedding-004
DEEPGRAM_API_KEY=your_key
```

You'll also need an Atlas Vector Search index named `vector_index` on the `memorychunks` collection:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "userId" },
    { "type": "filter", "path": "meetingId" }
  ]
}
```

```bash
npm run dev
```

```bash
# frontend
cd frontend
npm install
npm run dev
```

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:5000
```

---

## Notable engineering decisions & bugs fixed along the way

Worth mentioning in an interview, not hiding:

- **WebM header buffering** — `MediaRecorder` only sends full container headers in the first chunk, which broke Deepgram's stream parsing on later chunks. Fixed by buffering chunks until the Deepgram connection is confirmed open, then flushing them in order.
- **Cross-user data leakage** — meetings and memory chunks initially had no owner field at all, meaning any logged-in user could see every user's meetings. Fixed by adding `userId` to both the `Meeting` and `MemoryChunk` schemas, scoping every route and socket handler by the authenticated user, and authenticating the Socket.io handshake itself (not just REST requests) with the same JWT.
- **Silent RAG failures** — search returned empty results even with valid data because the Atlas Vector Search index didn't have `userId`/`meetingId` registered as filterable fields, so every filtered query matched nothing without throwing an error. Fixed by rebuilding the index with the correct field types.

---

## What's intentionally not built

- Speaker diarization — Deepgram supports it, but per-speaker attribution wasn't core to proving the memory/RAG concept, so it was deferred.
- Action item completion tracking — the data model supports a `done` flag, but there's no UI to toggle it yet.
- PDF/email export of summaries.

These were left out deliberately rather than attempted and left broken — the core recording → transcription → summarization → search loop was prioritized to be solid end-to-end first.