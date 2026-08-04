import { z } from 'zod';

export const citationSchema = z.object({
  meetingTitle: z.string(),
  meetingId: z.string(),
  timestamp: z.string(),
  quote: z.string().max(200)
});

export const answerSchema = z.object({
  answer: z.string(),
  citations: z.array(citationSchema),
  confidence: z.enum(['high', 'medium', 'low'])
});

export type QueryAnswer = z.infer<typeof answerSchema>;

export const geminiResponseSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    citations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          meetingTitle: { type: 'string' },
          meetingId: { type: 'string' },
          timestamp: { type: 'string' },
          quote: { type: 'string' }
        },
        required: ['meetingTitle', 'meetingId', 'timestamp', 'quote']
      }
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
  },
  required: ['answer', 'citations', 'confidence']
};