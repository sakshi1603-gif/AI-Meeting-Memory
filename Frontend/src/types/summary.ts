// action item shape as returned by the summarization service (different from
// MeetingActionItem in types/meeting.ts — that one has _id/text/done, this one doesn't)
export interface SummaryActionItem {
  task: string;
  owner: string;
  dueDate: string | null;
}

export interface MeetingSummary {
  summary: string;
  keyDecisions: string[];
  actionItems: SummaryActionItem[];
}

export type QueryConfidence = 'low' | 'medium' | 'high';

export interface QuerySource {
  meetingId: string;
  title?: string;
  startedAt?: string;
}

// response shape from POST /api/query
// NOTE: "citations" comes straight from answerQuery() in summarization.service —
// its exact shape wasn't in what you sent me, so it's typed loosely as unknown[]
// for now. Send me that service if you want it rendered properly instead of
// just using `sources` (which IS fully typed and safe to use).
export interface QueryResponse {
  answer: string;
  citations: unknown[];
  confidence: QueryConfidence;
  sources: QuerySource[];
}
