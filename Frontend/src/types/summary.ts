export interface ActionItem {
  task: string;
  owner: string;
  dueDate: string | null;
}

export interface MeetingSummary {
  summary: string;
  keyDecisions: string[];
  actionItems: ActionItem[];
}