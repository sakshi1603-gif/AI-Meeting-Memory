import 'dotenv/config';
import mongoose from 'mongoose';

import Meeting from '../models/Meeting.js';
import { embedMeeting } from '../services/memory.service.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting-memory';

async function main(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[embed] Connected to MongoDB.');
    const meetingIdArg = process.argv.find((a) => a.startsWith('--meetingId='))?.split('=')[1];

    // need userId alongside _id now — embedMeeting requires it
    let meetings: { _id: any; userId: any }[];
    if (meetingIdArg) {
      const m = await Meeting.findById(meetingIdArg, { _id: 1, userId: 1 }).lean();
      meetings = m ? [m as any] : [];
    } else {
      meetings = await Meeting.find({}, { _id: 1, userId: 1 }).lean() as any[];
    }

    console.log(`[embed] Found ${meetings.length} meeting(s) to process.`);

    for (const m of meetings) {
      const id = m._id.toString();

      if (!m.userId) {
        console.warn(`[embed] Skipping meeting ${id} — no userId on the meeting itself (pre-fix data).`);
        continue;
      }

      console.log(`[embed] Processing meeting ${id}...`);
      await embedMeeting(id, m.userId.toString());
      console.log(`[embed] Done with meeting ${id}.`);
    }
  } catch (err) {
    console.error('[embed] Fatal error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[embed] Disconnected from MongoDB.');
  }
}

main();