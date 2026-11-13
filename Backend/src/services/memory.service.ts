
import { extractStructuredSummary } from "./summarization.service";
import {
  Meeting,
  TranscriptChunk,
  MemoryChunk,
} from "../models/index";
import { chunkTranscript } from "../utils/transcriptChunker.util";
import { generateEmbeddings } from "./embedding.service";

// "Monday" or invalid date -> null
function normalizeDueDate(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp)
    ? null
    : new Date(timestamp).toISOString();
}

export async function generateAndSaveMemory(
  meetingId: string,
  rawTranscript: string,
) {
  if (!rawTranscript.trim()) {
    throw new Error("Cannot generate summary from an empty transcript.");
  }

  // Generate structured summary using AI
  const structured = await extractStructuredSummary(rawTranscript);

  // Validate AI response before saving
  if (
    !structured.summary?.trim() ||
    /^summary (extraction failed|unavailable)/i.test(
      structured.summary.trim(),
    )
  ) {
    throw new Error(
      "AI summary generation failed. Existing meeting summary was preserved.",
    );
  }

  if (!structured.title?.trim()) {
    throw new Error("AI did not generate a valid meeting title.");
  }

  // Fetch existing action items to preserve completed status
  const existingMeeting = await Meeting.findById(meetingId)
    .select("actionItems")
    .lean();

  const existingActionItems = existingMeeting?.actionItems ?? [];

  const actionItems = structured.actionItems.map((item) => {
    const existingItem = existingActionItems.find(
      (existing: any) =>
        existing.text.trim().toLowerCase() ===
          item.task.trim().toLowerCase() &&
        (existing.owner ?? "").trim().toLowerCase() ===
          (item.owner ?? "").trim().toLowerCase(),
    );

    return {
      text: item.task,
      owner: item.owner,
      dueDate: normalizeDueDate(item.dueDate),
      done: existingItem?.done ?? false,
    };
  });

  // Save only after successful AI response validation
  const updatedMeeting = await Meeting.findByIdAndUpdate(
    meetingId,
    {
      title: structured.title.trim(),
      summary: structured.summary.trim(),
      keyDecisions: structured.keyDecisions,
      actionItems,
    },
    { new: true },
  );

  if (!updatedMeeting) {
    throw new Error("Meeting not found while saving generated summary.");
  }

  return {
    ...structured,
    title: structured.title.trim(),
    summary: structured.summary.trim(),
    actionItems: structured.actionItems.map((item, index) => ({
      ...item,
      dueDate: actionItems[index].dueDate,
      done: actionItems[index].done,
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

  const embeddings = await generateEmbeddings(
    chunks.map((chunk) => chunk.content),
  );

  if (embeddings.length !== chunks.length) {
    throw new Error(
      `Embedding count mismatch for meeting ${meetingId}`,
    );
  }

  await MemoryChunk.deleteMany({ meetingId, userId });

  const docs = chunks.map((chunk, index) => ({
    meetingId,
    userId,
    content: chunk.content,
    chunkIndex: index,
    embedding: embeddings[index],
    metadata: {
      speakers: chunk.speakers,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
    },
  }));

  await MemoryChunk.insertMany(docs);

  // Mark indexed only after memory chunks have been inserted
  await Meeting.findOneAndUpdate(
    { _id: meetingId, userId },
    { memoryIndexed: true },
  );
}
