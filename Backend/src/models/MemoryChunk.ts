import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMemoryChunk extends Document {
  meetingId: Types.ObjectId;
  content: string;
  chunkIndex: number;
  embedding: number[];
  metadata: {
    speakers: string[];
    startTime?: number;
    endTime?: number;
  };
}

const memoryChunkSchema = new Schema<IMemoryChunk>(
  {
    meetingId: {
      type: Schema.Types.ObjectId,
      ref: 'Meeting',
      required: true,
      index: true
    },
    content: { type: String, required: true },
    chunkIndex: { type: Number, required: true },

    embedding: {
      type: [Number],
      required: true
    },

    metadata: {
      speakers: [{ type: String }],
      startTime: { type: Number },
      endTime: { type: Number }
    }
  },
  { timestamps: true }
);

memoryChunkSchema.index({ meetingId: 1, chunkIndex: 1 });

const MemoryChunk = mongoose.model<IMemoryChunk>('MemoryChunk', memoryChunkSchema);

export default MemoryChunk;