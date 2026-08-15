import { Router, Response } from 'express';
import { Meeting } from '../models';
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
      .select('title status startedAt endedAt durationSeconds participants summary keyTopics createdAt')
      .sort({ createdAt: -1 }); // newest meeting appears first
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/meetings/:id - full detail
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const meeting = await Meeting.findOne({ _id: req.params.id, userId });
    if (!meeting) {
      // same response whether it doesn't exist or belongs to someone else —
      // don't leak which one it is
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
