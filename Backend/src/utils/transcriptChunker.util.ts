interface TranscriptSegment {
  text: string;
  speaker?: string;
  startTime: number;
  endTime: number;
}

export interface TranscriptChunkResult {
  content: string;
  speakers: string[];
  startTime: number;
  endTime: number;
}

const MAX_CHUNK_CHARS = 1000;
const MIN_CHUNK_CHARS = 200;


export function chunkTranscript(segments: TranscriptSegment[]): TranscriptChunkResult[] {
  const chunks: TranscriptChunkResult[] = [];
  let buffer: TranscriptSegment[] = [];
  let bufferLength = 0;

  const flush = () => {
    if (buffer.length === 0) return;

    const content = buffer
      .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text))
      .join('\n');

    const speakers = [...new Set(buffer.map((s) => s.speaker).filter(Boolean) as string[])];

    chunks.push({
      content,
      speakers,
      startTime: buffer[0].startTime,
      endTime: buffer[buffer.length - 1].endTime
    });

    buffer = [];
    bufferLength = 0;
  };

  for (const segment of segments) {
    buffer.push(segment);
    bufferLength += segment.text.length;

    if (bufferLength >= MAX_CHUNK_CHARS) {
      flush();
    }
  }
  flush();

  if (chunks.length > 1 && chunks[chunks.length - 1].content.length < MIN_CHUNK_CHARS) {
    const last = chunks.pop()!;
    const prev = chunks[chunks.length - 1];
    prev.content += '\n' + last.content;
    prev.endTime = last.endTime;
    prev.speakers = [...new Set([...prev.speakers, ...last.speakers])];
  }

  return chunks;
}