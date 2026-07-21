import { Router, Request, Response } from 'express';
import { Meeting } from '../models';

const router = Router();

// GET /api/meetings - list view (lighter payload, no rawTranscript)
router.get('/', async (req: Request, res: Response) => {
  try {
    const meetings = await Meeting.find({})
      .select('title status startedAt endedAt durationSeconds participants summary keyTopics createdAt')
      .sort({ createdAt: -1 }); // newest meeting appears first 
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/meetings/:id - full detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;