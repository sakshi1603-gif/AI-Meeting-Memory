import mongoose from 'mongoose';

const transcriptChunkSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
    index: true
  },
  speaker: { type: String, default: 'Speaker 0' },
  text: { type: String, required: true },

  startTime: { type: Number, required: true },
  endTime: { type: Number, required: true },
  confidence: { type: Number, default: null },

  isFinal: { type: Boolean, default: true }
}, { timestamps: true });

transcriptChunkSchema.index({ meetingId: 1, startTime: 1 });

const TranscriptChunk = mongoose.model('TranscriptChunk', transcriptChunkSchema);

export default TranscriptChunk;