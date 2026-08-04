import mongoose from 'mongoose';
import MemoryChunk from '../models/MemoryChunk';

interface SearchOptions {
  limit?: number;
  meetingId?: string | null;
  minScore?: number;
}

interface SearchResult {
  _id: mongoose.Types.ObjectId;
  content: string;
  meetingId: mongoose.Types.ObjectId;
  metadata: {
    speakers: string[];
    startTime?: number;
    endTime?: number;
  };
  score: number;
}

export async function searchAcrossMeetings(
  queryEmbedding: number[],
  { limit = 8, meetingId = null, minScore = 0.65 }: SearchOptions = {}
): Promise<SearchResult[]> {
  const pipeline: mongoose.PipelineStage[] = [
    {
      $vectorSearch: {
        index: 'memory_vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: 150,
        limit,
        ...(meetingId && {
          filter: { meetingId: new mongoose.Types.ObjectId(meetingId) }
        })
      }
    } as any,
    {
      $project: {
        content: 1,
        meetingId: 1,
        metadata: 1,
        score: { $meta: 'vectorSearchScore' }
      }
    },
    { $match: { score: { $gte: minScore } } }
  ];

  return MemoryChunk.aggregate(pipeline);
}