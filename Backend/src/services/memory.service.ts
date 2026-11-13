import { extractStructuredSummary } from "./summarization.service";
import { Meeting, TranscriptChunk, MemoryChunk } from "../models/index";
import { chunkTranscript } from "../utils/transcriptChunker.util";
import { generateEmbeddings } from "./embedding.service";

// "Monday" or garbage -> null, so the UI never shows "Invalid Date"
function normalizeDueDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export async function generateAndSaveMemory(
  meetingId: string,
  rawTranscript: string,
) {
  const structured = await extractStructuredSummary(rawTranscript);

  const actionItems = structured.actionItems.map((item) => ({
    text: item.task,
    owner: item.owner,
    dueDate: normalizeDueDate(item.dueDate),
    done: false,
  }));
  await Meeting.findByIdAndUpdate(meetingId, {
    title: structured.title,
    summary: structured.summary,
    keyDecisions: structured.keyDecisions,
    actionItems,
  });

  

  return {
    ...structured,
    actionItems: structured.actionItems.map((item, i) => ({
      ...item,
      dueDate: actionItems[i].dueDate,
    })),
  };
}

export async function embedMeeting(
  meetingId: string,
  userId: string,
): Promise<void> {
  const transcriptDocs = await TranscriptChunk.find({ meetingId })
    .sort({ startTime: 1 })
    .lean();
  if (transcriptDocs.length === 0) return;

  const segments = transcriptDocs.map((d: any) => ({
    text: d.text,
    speaker: d.speaker,
    startTime: d.startTime ?? 0,
    endTime: d.endTime ?? 0,
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
    metadata: {
      speakers: chunk.speakers,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
    },
  }));

  await MemoryChunk.insertMany(docs);

  // only mark indexed once chunks actually exist
  await Meeting.findByIdAndUpdate(meetingId, { memoryIndexed: true });
}
