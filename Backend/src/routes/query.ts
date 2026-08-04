import { Router, Response } from 'express';
import Meeting from '../models/Meeting';
import { embedQuery } from '../services/embedding.service';
import { searchAcrossMeetings } from '../services/vectorSearch.service';
import { answerQuery } from '../services/summarization.service';
import { formatTimestamp } from '../utils/time';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/query', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { question, meetingId } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    const queryEmbedding = await embedQuery(question);
    const chunks = await searchAcrossMeetings(queryEmbedding, { meetingId, limit: 8 });

    if (!chunks.length) {
      return res.json({
        answer: "I couldn't find anything relevant in your meetings.",
        citations: [],
        confidence: 'low'
      });
    }

    const ids = [...new Set(chunks.map(c => c.meetingId.toString()))];
    const meetings = await Meeting.find({ _id: { $in: ids } })
      .select('title startedAt')
      .lean();

    const meetingMap = Object.fromEntries(
      meetings.map(m => [m._id.toString(), m])
    );

    const context = chunks
      .map((c, i) => {
        const m = meetingMap[c.meetingId.toString()];
        const timestamp = c.metadata?.startTime != null
          ? formatTimestamp(c.metadata.startTime)
          : 'unknown';
        return `[${i + 1}] Meeting: "${m?.title}" | Date: ${m?.startedAt?.toString()} | Timestamp: ${timestamp}\n${c.content}`;
      })
      .join('\n\n');

    const result = await answerQuery(question, context);

    res.json(result);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

export default router;