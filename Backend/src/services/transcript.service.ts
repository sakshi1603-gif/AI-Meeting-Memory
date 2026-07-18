import { TranscriptChunk } from '../models/index';

export async function getFullTranscriptText(meetingId: string): Promise<string> {
  const chunks = await TranscriptChunk.find({ meetingId })
    .sort({ startTime: 1 })
    .lean();

  return chunks.map((c: any) => c.text).join(' ');
}