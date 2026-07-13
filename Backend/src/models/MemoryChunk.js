const mongoose = require('mongoose');

const memoryChunkSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
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
}, { timestamps: true });

memoryChunkSchema.index({ meetingId: 1, chunkIndex: 1 });

module.exports = mongoose.model('MemoryChunk', memoryChunkSchema);

