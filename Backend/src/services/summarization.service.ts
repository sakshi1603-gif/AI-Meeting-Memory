import { GoogleGenAI, Type } from '@google/genai';
import { MeetingSummarySchema, MeetingSummary } from '../schemas/summary.schema';
import { answerSchema, QueryAnswer } from '../schemas/queryAnswer.schema';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PRIMARY_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-2.5-flash';
const MAX_ATTEMPTS = 3;

// counters for resume numbers (log or expose later)
export const geminiStats = { calls: 0, retries: 0, fallbacks: 0, failures: 0 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err: any): boolean {
  const status = err?.status ?? err?.code;
  return status === 429 || status === 500 || status === 503 || status === 504;
}

async function generateJSON(prompt: string, schema: object): Promise<string> {
  geminiStats.calls++;
  let lastErr: unknown;

  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema as any,
          },
        });
        return response.text ?? '';
      } catch (err) {
        lastErr = err;
        if (!isRetryable(err)) throw err;

        geminiStats.retries++;
        console.warn(
          `Gemini ${model} attempt ${attempt}/${MAX_ATTEMPTS} failed (${(err as any)?.status})`,
        );
        if (attempt < MAX_ATTEMPTS) {
          await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 300);
        }
      }
    }
    if (model === PRIMARY_MODEL) {
      geminiStats.fallbacks++;
      console.warn(`Primary model exhausted, switching to ${FALLBACK_MODEL}`);
    }
  }

  geminiStats.failures++;
  throw lastErr;
}

const SYSTEM_PROMPT = `You are extracting structured meeting notes from a transcript.
Rules:
- Only include decisions that were explicitly agreed on, not things merely discussed.
- Only include action items that have a clear task. If no owner was stated, use "unassigned".
- Do not invent details not present in the transcript.
- dueDate must be an ISO date (YYYY-MM-DD). Resolve relative phrases like "Monday" or "next week" using today's date. Use null if no due date was stated.
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
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `${SYSTEM_PROMPT}\n\nToday's date: ${today}\n\nTranscript:\n${transcriptText}`;
  const raw = await generateJSON(prompt, RESPONSE_SCHEMA);
  return safeParseJSON(raw);
}

export function buildQueryPrompt(question: string, context: string): string {
  return `${QUERY_SYSTEM_PROMPT}\n\nEXCERPTS:\n${context}\n\nQUESTION: ${question}`;
}

export async function answerQuery(question: string, context: string): Promise<QueryAnswer> {
  const prompt = buildQueryPrompt(question, context);
  const raw = await generateJSON(prompt, QUERY_RESPONSE_SCHEMA);
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