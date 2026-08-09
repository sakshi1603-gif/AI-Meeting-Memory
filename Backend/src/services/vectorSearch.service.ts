import MemoryChunk from '../models/MemoryChunk';
import mongoose from 'mongoose';

interface SearchOptions {
  userId: string;
  meetingId?: string;
  limit?: number;
}

export async function searchAcrossMeetings(queryEmbedding: number[],options: SearchOptions) {
  const { userId, meetingId, limit = 8 } = options;

  const filter: Record<string, any> = {
    userId: new mongoose.Types.ObjectId(userId)
  };

  if (meetingId) {
    filter.meetingId = new mongoose.Types.ObjectId(meetingId);
  }

  const results = await MemoryChunk.aggregate([
    {
      $vectorSearch: {
        index: 'vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: limit * 15,
        limit,
        filter
      }
    },
    {
      $project: {
        content: 1,
        meetingId: 1,
        metadata: 1,
        score: { $meta: 'vectorSearchScore' }
      }
    }
  ]);

  return results;
}