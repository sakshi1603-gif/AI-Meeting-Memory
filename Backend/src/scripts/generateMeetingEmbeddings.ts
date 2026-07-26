import 'dotenv/config';
import mongoose from 'mongoose';

import Meeting from '../models/Meeting.js';
import TranscriptChunk from '../models/TranscriptChunk.js';
import MemoryChunk from '../models/MemoryChunk.js';
import { chunkTranscript } from '../utils/transcriptChunker.util.js';
import { generateEmbeddings } from '../services/embedding.service.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting-memory';

async function embedMeeting(meetingId: string): Promise<void> {
  try {
    console.log(`[embed] Processing meeting ${meetingId}...`);

    const transcriptDocs = await TranscriptChunk.find({ meetingId }).sort({ startTime: 1 }).lean();

    if (transcriptDocs.length === 0) {
      console.warn(`[embed] No transcript chunks found for meeting ${meetingId}, skipping.`);
      return;
    }

    const segments = transcriptDocs.map((d: any) => ({
      text: d.text,
      speaker: d.speaker,
      startTime: d.startTime ?? 0,
      endTime: d.endTime ?? 0
    }));

    const chunks = chunkTranscript(segments);

    if (chunks.length === 0) {
      console.warn(`[embed] Chunking produced 0 chunks for meeting ${meetingId}, skipping.`);
      return;
    }

    const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

    if (embeddings.length !== chunks.length) {
      throw new Error(
        `Embedding count mismatch for meeting ${meetingId}: got ${embeddings.length}, expected ${chunks.length}`
      );
    }

    await MemoryChunk.deleteMany({ meetingId });

    const docs = chunks.map((chunk, i) => ({
      meetingId,
      content: chunk.content,
      chunkIndex: i,
      embedding: embeddings[i],
      metadata: {
        speakers: chunk.speakers,
        startTime: chunk.startTime,
        endTime: chunk.endTime
      }
    }));

    await MemoryChunk.insertMany(docs);
    console.log(`[embed] Stored ${docs.length} memory chunks for meeting ${meetingId}.`);
  } catch (err) {
    console.error(`[embed] Failed to process meeting ${meetingId}:`, err);
  } finally {
    console.log(`[embed] Done with meeting ${meetingId}.`);
  }
}

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
      await embedMeeting(id);
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