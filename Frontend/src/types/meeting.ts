export type MeetingStatus = 'active' | 'ended' | 'processing' | 'failed';

// action item as stored on the Meeting document itself
export interface MeetingActionItem {
  _id: string;
  text: string;
  owner: string | null;
  dueDate: string | null;
  done: boolean;
}

// full document — returned by GET /api/meetings/:id
export interface Meeting {
  _id: string;
  title: string;
  status: MeetingStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  participants: string[];
  rawTranscript: string;
  summary: string | null;
  keyTopics: string[];
  keyDecisions: string[];
  actionItems: MeetingActionItem[];
  memoryIndexed: boolean;
  createdAt: string;
  updatedAt: string;
}

// lighter payload — returned by GET /api/meetings (list route selects a subset, no rawTranscript)
export type MeetingListItem = Pick<
  Meeting,
  | '_id'
  | 'title'
  | 'status'
  | 'startedAt'
  | 'endedAt'
  | 'durationSeconds'
  | 'participants'
  | 'summary'
  | 'keyTopics'
  | 'createdAt'
>;
