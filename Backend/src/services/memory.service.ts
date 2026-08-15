import { extractStructuredSummary } from './summarization.service';
import { Meeting, TranscriptChunk, MemoryChunk } from "../models/index";
import { chunkTranscript } from '../utils/transcriptChunker.util';
import { generateEmbeddings } from './embedding.service';


export async function generateAndSaveMemory(meetingId: string, rawTranscript: string) {
  const structured = await extractStructuredSummary(rawTranscript);

  await Meeting.findByIdAndUpdate(meetingId, {
    summary: structured.summary,
    keyDecisions: structured.keyDecisions,
    actionItems: structured.actionItems.map((item) => ({
      text: item.task,       
      owner: item.owner,
      dueDate: item.dueDate,
      done: false,
    })),
    memoryIndexed: true,
  });

  return structured;
}


export async function embedMeeting(meetingId: string, userId: string): Promise<void> {
  const transcriptDocs = await TranscriptChunk.find({ meetingId }).sort({ startTime: 1 }).lean();
  if (transcriptDocs.length === 0) return;

  const segments = transcriptDocs.map((d: any) => ({
    text: d.text,
    speaker: d.speaker,
    startTime: d.startTime ?? 0,
    endTime: d.endTime ?? 0
  }));

  const chunks = chunkTranscript(segments);
  if (chunks.length === 0) return;

  const embeddings = await generateEmbeddings(chunks.map((c) => c.content));
  if (embeddings.length !== chunks.length) {
    throw new Error(`Embedding count mismatch for meeting ${meetingId}`);
  }

  await MemoryChunk.deleteMany({ meetingId });

  const docs = chunks.map((chunk, i) => ({
    meetingId,
    userId,
    content: chunk.content,
    chunkIndex: i,
    embedding: embeddings[i],
    metadata: { speakers: chunk.speakers, startTime: chunk.startTime, endTime: chunk.endTime }
  }));

  await MemoryChunk.insertMany(docs);
}
