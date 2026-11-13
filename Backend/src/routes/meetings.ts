
import { Router, Response } from 'express';
import { isValidObjectId } from 'mongoose';

import {
  Meeting,
  TranscriptChunk,
  MemoryChunk,
} from '../models';

import { authMiddleware, AuthRequest } from '../middleware/auth';

import { generateAndSaveMemory } from '../services/memory.service';

const router = Router();

// GET /api/meetings - list view (lighter payload, no rawTranscript)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const meetings = await Meeting.find({ userId })
      .select(
        'title status startedAt endedAt durationSeconds participants summary keyTopics createdAt'
      )
      .sort({ createdAt: -1 });

    res.json(meetings);
  } catch (err) {
    console.error('Failed to fetch meetings:', err);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// POST /api/meetings/:id/regenerate-summary
router.post(
  '/:id/regenerate-summary',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Validate MongoDB ObjectId
      if (!isValidObjectId(req.params.id)) {
        res.status(400).json({ error: 'Invalid meeting ID' });
        return;
      }

      // Verify meeting ownership
      const meeting = await Meeting.findOne({
        _id: req.params.id,
        userId,
      });

      if (!meeting) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }

      // Only ended or failed meetings can be regenerated
      if (
        meeting.status === 'active' ||
        meeting.status === 'processing'
      ) {
        res.status(409).json({
          error: 'Cannot regenerate summary while meeting is active or processing.',
        });
        return;
      }

      // Prefer the saved full transcript
      let rawTranscript = meeting.rawTranscript?.trim() ?? '';

      // Fallback: reconstruct transcript from transcript chunks
      if (!rawTranscript) {
        const transcriptChunks = await TranscriptChunk.find({
          meetingId: meeting._id,
        })
          .sort({ startTime: 1 })
          .lean();

        rawTranscript = transcriptChunks
          .map((chunk) => chunk.text)
          .join(' ')
          .trim();
      }

      if (!rawTranscript) {
        res.status(400).json({
          error: 'No transcript available. Cannot regenerate summary.',
        });
        return;
      }

      console.log(
        `Regenerating summary for meeting: ${meeting._id}`,
      );

      // Reuse existing AI summarization service
      const result = await generateAndSaveMemory(
        meeting._id.toString(),
        rawTranscript,
      );

      console.log(
        `Summary regenerated for meeting: ${meeting._id}`,
      );

      res.status(200).json({
        message: 'Summary regenerated successfully',
        meetingId: meeting._id,
        ...result,
      });
    } catch (err) {
      console.error('Summary regeneration failed:', err);

      res.status(500).json({
        error: 'Failed to regenerate summary. Please try again.',
      });
    }
  },
);

// DELETE /api/meetings/:id - atomically delete meeting and associated data
router.delete(
  '/:id',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid meeting ID' });
      return;
    }

    const session = await Meeting.startSession();

    try {
      let meetingFound = false;

      await session.withTransaction(async () => {
        const meeting = await Meeting.findOne({
          _id: req.params.id,
          userId,
        }).session(session);

        if (!meeting) {
          return;
        }

        meetingFound = true;

        const meetingId = meeting._id;

        await TranscriptChunk.deleteMany({
          meetingId,
        }).session(session);

        await MemoryChunk.deleteMany({
          meetingId,
          userId,
        }).session(session);

        const result = await Meeting.deleteOne({
          _id: meetingId,
          userId,
        }).session(session);

        if (result.deletedCount !== 1) {
          throw new Error('Meeting deletion failed');
        }
      });

      if (!meetingFound) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }

      res.status(200).json({
        message: 'Meeting and associated data deleted successfully',
        meetingId: req.params.id,
      });
    } catch (err) {
      console.error('Failed to delete meeting transaction:', err);

      res.status(500).json({
        error: 'Failed to delete meeting. No changes were committed.',
      });
    } finally {
      await session.endSession();
    }
  },
);

// GET /api/meetings/:id - full detail
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid meeting ID' });
      return;
    }

    const meeting = await Meeting.findOne({
      _id: req.params.id,
      userId,
    });

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    res.json(meeting);
  } catch (err) {
    console.error('Failed to fetch meeting:', err);
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
});

export default router;
