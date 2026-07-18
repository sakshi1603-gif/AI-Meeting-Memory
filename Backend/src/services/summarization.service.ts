import { GoogleGenAI, Type } from '@google/genai';
import { MeetingSummarySchema, MeetingSummary } from '../schemas/summary.schema';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are extracting structured meeting notes from a transcript.
Rules:
- Only include decisions that were explicitly agreed on, not things merely discussed.
- Only include action items that have a clear task. If no owner was stated, use "unassigned".
- Do not invent details not present in the transcript.
- If the transcript is too short or off-topic to extract anything meaningful, return empty arrays and a one-line summary saying so.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    keyDecisions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    actionItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING },
          owner: { type: Type.STRING },
          dueDate: { type: Type.STRING, nullable: true },
        },
        required: ['task', 'owner', 'dueDate'],
      },
    },
  },
  required: ['summary', 'keyDecisions', 'actionItems'],
};

export async function extractStructuredSummary(
  transcriptText: string
): Promise<MeetingSummary> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: [
      { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nTranscript:\n${transcriptText}` }] },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const raw = response.text ?? '';
  return safeParseJSON(raw);
}

function safeParseJSON(raw: string): MeetingSummary {
  let candidate: any;

  try {
    candidate = JSON.parse(raw);
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        candidate = JSON.parse(jsonMatch[0]);
      } catch {
        return fallbackSummary();
      }
    } else {
      return fallbackSummary();
    }
  }

  const parsed = MeetingSummarySchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  console.warn('Schema validation failed:', parsed.error.issues);
  return coerceToSchema(candidate);
}

function fallbackSummary(): MeetingSummary {
  return {
    summary: 'Summary extraction failed — could not parse model output.',
    keyDecisions: [],
    actionItems: [],
  };
}

function coerceToSchema(raw: any): MeetingSummary {
  return {
    summary: typeof raw?.summary === 'string' ? raw.summary : 'Summary unavailable.',
    keyDecisions: Array.isArray(raw?.keyDecisions)
      ? raw.keyDecisions.filter((d: unknown) => typeof d === 'string')
      : [],
    actionItems: Array.isArray(raw?.actionItems)
      ? raw.actionItems
          .filter((a: any) => a && typeof a.task === 'string')
          .map((a: any) => ({
            task: a.task,
            owner: typeof a.owner === 'string' ? a.owner : 'unassigned',
            dueDate: typeof a.dueDate === 'string' ? a.dueDate : null,
          }))
      : [],
  };
}