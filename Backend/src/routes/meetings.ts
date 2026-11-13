
import { Router, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Meeting, TranscriptChunk, MemoryChunk } from '../models';
import { authMiddleware, AuthRequest } from '../middleware/auth';

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

    // Validate MongoDB ObjectId
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid meeting ID' });
      return;
    }

    const session = await Meeting.startSession();

    try {
      let meetingFound = false;

      await session.withTransaction(async () => {
        // Verify meeting ownership inside the transaction
        const meeting = await Meeting.findOne({
          _id: req.params.id,
          userId,
        }).session(session);

        if (!meeting) {
          return;
        }

        meetingFound = true;

        const meetingId = meeting._id;

        // Delete all transcript chunks
        await TranscriptChunk.deleteMany({
          meetingId,
        }).session(session);

        // Delete all memory chunks belonging to this user and meeting
        await MemoryChunk.deleteMany({
          meetingId,
          userId,
        }).session(session);

        // Delete the parent meeting document
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
  }
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
      // Same response whether missing or owned by someone else
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
