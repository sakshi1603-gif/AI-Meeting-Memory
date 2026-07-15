const mongoose = require('mongoose');

const actionItemSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  owner: { type: String, trim: true, default: null },
  done: { type: Boolean, default: false }
}, { _id: true });

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'Untitled Meeting'
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'processing', 'failed'],
    default: 'active',
    index: true
  },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  durationSeconds: { type: Number, default: 0 },

  participants: [{ type: String, trim: true }], 
  rawTranscript: { type: String, default: '' },

  summary: { type: String, default: null },      
  keyTopics: [{ type: String }],
  actionItems: [actionItemSchema],

  memoryIndexed: { type: Boolean, default: false }
}, { timestamps: true });

meetingSchema.index({ createdAt: -1 });

const Meeting = mongoose.model("Meeting", meetingSchema);

export default Meeting;