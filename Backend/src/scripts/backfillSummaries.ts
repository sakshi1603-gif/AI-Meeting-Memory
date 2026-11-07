import 'dotenv/config';
import mongoose from 'mongoose';
import { Meeting, TranscriptChunk, MemoryChunk } from '../models/index';
import { generateAndSaveMemory, embedMeeting } from '../services/memory.service';

const DRY_RUN = process.argv.includes('--dry');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);   // use YOUR variable name

  const meetings = await Meeting.find({
    status: 'ended',
    $or: [
      { summary: { $exists: false } },
      { summary: null },
      { summary: '' },
      { summary: /^Summary (extraction failed|unavailable)/ },
    ],
  }).lean();

  console.log(`Found ${meetings.length} meetings needing a summary`);
  if (DRY_RUN) {
    meetings.forEach((m: any) => console.log(m._id.toString(), m.title, m.startedAt));
    await mongoose.disconnect();
    return;
  }

  let ok = 0;
  let failed = 0;

  for (const m of meetings as any[]) {
    const id = m._id.toString();
    try {
      let transcript: string = m.rawTranscript ?? '';
      if (!transcript.trim()) {
        const chunks = await TranscriptChunk.find({ meetingId: id }).sort({ startTime: 1 }).lean();
        transcript = chunks.map((c: any) => c.text).join(' ');
      }
      if (!transcript.trim()) {
        console.log(`skip ${id}: no transcript`);
        continue;
      }

      await generateAndSaveMemory(id, transcript);

      const hasChunks = await MemoryChunk.exists({ meetingId: id });
      if (!hasChunks) await embedMeeting(id, m.userId.toString());

      ok++;
      console.log(`done ${id}`);
    } catch (err) {
      failed++;
      console.error(`failed ${id}:`, (err as Error).message);
    }
    await sleep(1500); // stay under Gemini rate limits
  }

  console.log(`Finished. ok=${ok} failed=${failed}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});