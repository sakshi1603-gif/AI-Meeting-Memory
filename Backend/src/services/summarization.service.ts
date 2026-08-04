import { GoogleGenAI, Type } from '@google/genai';
import { MeetingSummarySchema, MeetingSummary } from '../schemas/summary.schema';
import { answerSchema, QueryAnswer } from '../schemas/queryAnswer.schema';

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

const QUERY_SYSTEM_PROMPT = `Answer using ONLY the excerpts provided. Each excerpt is tagged with meeting title, date, and timestamp.
Rules:
- Every claim must cite the excerpt's meeting title and timestamp — no exceptions.
- If the excerpts don't answer the question, say so plainly and set confidence to "low". Do not guess.
- If meetings conflict, note the disagreement and cite both.
- Never invent a timestamp or meeting name not shown in the excerpts.`;

const QUERY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    citations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          meetingTitle: { type: Type.STRING },
          meetingId: { type: Type.STRING },
          timestamp: { type: Type.STRING },
          quote: { type: Type.STRING },
        },
        required: ['meetingTitle', 'meetingId', 'timestamp', 'quote'],
      },
    },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
  },
  required: ['answer', 'citations', 'confidence'],
};

export async function extractStructuredSummary(transcriptText: string): Promise<MeetingSummary> {
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

export function buildQueryPrompt(question: string, context: string): string {
  return `${QUERY_SYSTEM_PROMPT}\n\nEXCERPTS:\n${context}\n\nQUESTION: ${question}`;
}

export async function answerQuery(question: string, context: string): Promise<QueryAnswer> {
  const prompt = buildQueryPrompt(question, context);

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: [
      { role: 'user', parts: [{ text: prompt }] },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: QUERY_RESPONSE_SCHEMA,
    },
  });

  const raw = response.text ?? '';
  return safeParseQueryJSON(raw);
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

function safeParseQueryJSON(raw: string): QueryAnswer {
  let candidate: any;

  try {
    candidate = JSON.parse(raw);
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        candidate = JSON.parse(jsonMatch[0]);
      } catch {
        return fallbackQueryAnswer();
      }
    } else {
      return fallbackQueryAnswer();
    }
  }

  const parsed = answerSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  console.warn('Query schema validation failed:', parsed.error.issues);
  return coerceToQuerySchema(candidate);
}

function fallbackSummary(): MeetingSummary {
  return {
    summary: 'Summary extraction failed — could not parse model output.',
    keyDecisions: [],
    actionItems: [],
  };
}

function fallbackQueryAnswer(): QueryAnswer {
  return {
    answer: 'Could not parse a response — please try rephrasing the question.',
    citations: [],
    confidence: 'low',
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

function coerceToQuerySchema(raw: any): QueryAnswer {
  return {
    answer: typeof raw?.answer === 'string' ? raw.answer : 'Answer unavailable.',
    citations: Array.isArray(raw?.citations)
      ? raw.citations
          .filter((c: any) => c && typeof c.meetingTitle === 'string' && typeof c.timestamp === 'string')
          .map((c: any) => ({
            meetingTitle: c.meetingTitle,
            meetingId: typeof c.meetingId === 'string' ? c.meetingId : '',
            timestamp: c.timestamp,
            quote: typeof c.quote === 'string' ? c.quote : '',
          }))
      : [],
    confidence: ['high', 'medium', 'low'].includes(raw?.confidence) ? raw.confidence : 'low',
  };
}