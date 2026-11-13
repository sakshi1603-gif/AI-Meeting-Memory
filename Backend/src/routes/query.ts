
import { Router, Response } from "express";
import { performance } from "node:perf_hooks";

import Meeting from "../models/Meeting";
import { embedQuery } from "../services/embedding.service";
import { searchAcrossMeetings } from "../services/vectorSearch.service";
import { answerQuery } from "../services/summarization.service";
import { formatTimestamp } from "../utils/time";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

router.post(
  "/query",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { question, meetingId } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!question?.trim()) {
      return res.status(400).json({ error: "question is required" });
    }

    const totalStart = performance.now();

    let embeddingTime = 0;
    let vectorSearchTime = 0;
    let metadataTime = 0;
    let llmTime = 0;

    try {
      // Stage 1: Query embedding
      let start = performance.now();

      const queryEmbedding = await embedQuery(question);

      embeddingTime = performance.now() - start;

      // Stage 2: MongoDB Atlas Vector Search
      start = performance.now();

      const chunks = await searchAcrossMeetings(queryEmbedding, {
        userId,
        meetingId: meetingId || undefined,
        limit: 8,
      });

      vectorSearchTime = performance.now() - start;

      if (!chunks.length) {
        const totalTime = performance.now() - totalStart;

        console.log("[RAG Performance]", {
          embeddingMs: Math.round(embeddingTime),
          vectorSearchMs: Math.round(vectorSearchTime),
          metadataMs: 0,
          llmMs: 0,
          totalMs: Math.round(totalTime),
          retrievedChunks: 0,
        });

        return res.json({
          answer: "I couldn't find anything relevant in your meetings.",
          citations: [],
          confidence: "low",
        });
      }

      const ids = [
        ...new Set(chunks.map((c) => c.meetingId.toString())),
      ];

      // Stage 3: Meeting metadata lookup
      start = performance.now();

      const meetings = await Meeting.find({
        _id: { $in: ids },
        userId,
      })
        .select("title startedAt")
        .lean();

      metadataTime = performance.now() - start;

      const meetingMap = Object.fromEntries(
        meetings.map((m) => [m._id.toString(), m]),
      );

      const context = chunks
        .map((c, i) => {
          const m = meetingMap[c.meetingId.toString()];

          const timestamp =
            c.metadata?.startTime != null
              ? formatTimestamp(c.metadata.startTime)
              : "unknown";

          return `[${i + 1}] Meeting: "${m?.title}" | Date: ${m?.startedAt?.toString()} | Timestamp: ${timestamp}\n${c.content}`;
        })
        .join("\n\n");

      // Stage 4: LLM answer generation
      start = performance.now();

      const result = await answerQuery(question, context);

      llmTime = performance.now() - start;

      const totalTime = performance.now() - totalStart;

      console.log("[RAG Performance]", {
        embeddingMs: Math.round(embeddingTime),
        vectorSearchMs: Math.round(vectorSearchTime),
        metadataMs: Math.round(metadataTime),
        llmMs: Math.round(llmTime),
        totalMs: Math.round(totalTime),
        retrievedChunks: chunks.length,
      });

      res.json({
        ...result,
        sources: ids.map((id) => ({
          meetingId: id,
          title: meetingMap[id]?.title,
          startedAt: meetingMap[id]?.startedAt,
        })),
      });
    } catch (err) {
      const totalTime = performance.now() - totalStart;

      console.error("Query error:", err);

      console.log("[RAG Performance - Failed]", {
        embeddingMs: Math.round(embeddingTime),
        vectorSearchMs: Math.round(vectorSearchTime),
        metadataMs: Math.round(metadataTime),
        llmMs: Math.round(llmTime),
        totalMs: Math.round(totalTime),
      });

      res.status(500).json({ error: "Failed to process query" });
    }
  },
);

export default router;
