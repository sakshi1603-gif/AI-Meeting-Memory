export interface ActionItem {
  _id: string;
  text: string;
  owner: string | null;
  dueDate: string | null;
  done: boolean;
}

export interface Meeting {
  _id: string;
  title: string;
  status: 'active' | 'ended' | 'processing' | 'failed';
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  participants: string[];
  rawTranscript: string;
  summary: string | null;
  keyTopics: string[];
  keyDecisions: string[];
  actionItems: ActionItem[];
  memoryIndexed: boolean;
  createdAt: string;
  updatedAt: string;
}