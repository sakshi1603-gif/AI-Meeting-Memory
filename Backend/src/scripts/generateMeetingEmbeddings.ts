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

    let meetingIds: string[];
    if (meetingIdArg) {
      meetingIds = [meetingIdArg];
    } else {
      const meetings = await Meeting.find({}, { _id: 1 }).lean();
      meetingIds = meetings.map((m: any) => m._id.toString());
    }

    console.log(`[embed] Found ${meetingIds.length} meeting(s) to process.`);

    for (const id of meetingIds) {
      console.log(`[embed] Processing meeting ${id}...`);
      await embedMeeting(id);
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