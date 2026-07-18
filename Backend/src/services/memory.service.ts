import { extractStructuredSummary } from './summarization.service';
import { Meeting } from "../models/index";


export async function generateAndSaveMemory(meetingId: string, rawTranscript: string) {
  const structured = await extractStructuredSummary(rawTranscript);

  await Meeting.findByIdAndUpdate(meetingId, {
    summary: structured.summary,
    keyDecisions: structured.keyDecisions,
    actionItems: structured.actionItems.map((item) => ({
      text: item.task,       
      owner: item.owner,
      dueDate: item.dueDate,
      done: false,
    })),
    memoryIndexed: true,
  });

  return structured;
}