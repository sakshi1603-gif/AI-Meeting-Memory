import 'dotenv/config';
import mongoose from 'mongoose';

import Meeting from '../models/Meeting.js';
import MemoryChunk from '../models/MemoryChunk.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting-memory';
const EXPECTED_DIM = 768; 

async function main(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[verify] Connected to MongoDB.\n');

    const meetingIdArg = process.argv.find((a) => a.startsWith('--meetingId='))?.split('=')[1];

    const meetings = meetingIdArg
      ? await Meeting.find({ _id: meetingIdArg }, { _id: 1 }).lean()
      : await Meeting.find({}, { _id: 1 }).lean();

    let totalOk = 0;
    let totalBad = 0;

    for (const meeting of meetings) {
      const chunks = await MemoryChunk.find({ meetingId: meeting._id }).sort({ chunkIndex: 1 }).lean();

      if (chunks.length === 0) {
        console.log(`✗ Meeting ${meeting._id}: no memory chunks found`);
        totalBad++;
        continue;
      }

      let meetingOk = true;
      for (const chunk of chunks) {
        const dimOk = Array.isArray(chunk.embedding) && chunk.embedding.length === EXPECTED_DIM;
        const contentOk = typeof chunk.content === 'string' && chunk.content.trim().length > 0;
        const nonZero = chunk.embedding.some((v: number) => v !== 0);

        if (!dimOk || !contentOk || !nonZero) {
          meetingOk = false;
          console.log(
            `  ✗ chunk ${chunk.chunkIndex}: dim=${chunk.embedding?.length ?? 'missing'} contentOk=${contentOk} nonZero=${nonZero}`
          );
        }
      }

      if (meetingOk) {
        console.log(`✓ Meeting ${meeting._id}: ${chunks.length} chunks, all embeddings valid (dim ${EXPECTED_DIM})`);
        totalOk++;
      } else {
        console.log(`✗ Meeting ${meeting._id}: ${chunks.length} chunks, some invalid (see above)`);
        totalBad++;
      }
    }

    console.log(`\n[verify] ${totalOk} meeting(s) OK, ${totalBad} meeting(s) with issues.`);
  } catch (err) {
    console.error('[verify] Fatal error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();