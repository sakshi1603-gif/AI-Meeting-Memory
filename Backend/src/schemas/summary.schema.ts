import { z } from 'zod';

export const ActionItemSchema = z.object({
  task: z.string(),
  owner: z.string(),
  dueDate: z.string().nullable(),
});

export const MeetingSummarySchema = z.object({
  summary: z.string(),
  keyDecisions: z.array(z.string()),
  actionItems: z.array(ActionItemSchema),
});

export type MeetingSummary = z.infer<typeof MeetingSummarySchema>;