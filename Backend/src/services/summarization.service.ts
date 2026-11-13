
import { GoogleGenAI, Type } from "@google/genai";
import {
  MeetingSummarySchema,
  MeetingSummary,
} from "../schemas/summary.schema";
import { answerSchema, QueryAnswer } from "../schemas/queryAnswer.schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PRIMARY_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash";
const MAX_ATTEMPTS = 3;

// Counters for monitoring Gemini usage
export const geminiStats = {
  calls: 0,
  retries: 0,
  fallbacks: 0,
  failures: 0,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(err: any): boolean {
  const status = err?.status ?? err?.code;
  return status === 429 || status === 500 || status === 503 || status === 504;
}

async function generateJSON(
  prompt: string,
  schema: object,
): Promise<string> {
  geminiStats.calls++;

  let lastErr: unknown;

  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: schema as any,
          },
        });

        return response.text ?? "";
      } catch (err) {
        lastErr = err;

        if (!isRetryable(err)) {
          geminiStats.failures++;
          throw err;
        }

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

// Meeting summary and title generation prompt
const SYSTEM_PROMPT = `You are extracting structured meeting notes from a transcript.

Rules:

TITLE GENERATION:
- Generate a meaningful meeting title of 3-8 words based on the main topic.
- The title must accurately represent what was discussed.
- Never use generic titles like "Meeting", "Discussion" or "Untitled Meeting".
- Do not invent topics that are not supported by the transcript.
- Use title case for the title.
- If the transcript is too short or has no identifiable topic, use "General Discussion".

SUMMARY:
- Generate a concise summary covering the main points discussed.
- Do not invent details not present in the transcript.
- If the transcript is too short or off-topic, return a one-line summary explaining that.

DECISIONS:
- Only include decisions that were explicitly agreed on.
- Do not include things that were merely discussed.

ACTION ITEMS:
- Only include action items that have a clear task.
- If no owner was stated, use "unassigned".
- Do not invent tasks, owners or deadlines.
- dueDate must be an ISO date (YYYY-MM-DD).
- Resolve relative phrases like "Monday" or "next week" using today's date.
- Use null if no due date was stated.

Return all fields according to the provided JSON schema.`;

// Gemini structured response schema
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
    },
    summary: {
      type: Type.STRING,
    },
    keyDecisions: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
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
        required: ["task", "owner", "dueDate"],
      },
    },
  },
  required: ["title", "summary", "keyDecisions", "actionItems"],
};

// RAG query prompt
const QUERY_SYSTEM_PROMPT = `Answer using ONLY the excerpts provided. Each excerpt is tagged with meeting title, date, and timestamp.

Rules:
- Every claim must cite the excerpt's meeting title and timestamp — no exceptions.
- If the excerpts don't answer the question, say so plainly and set confidence to "low". Do not guess.
- If meetings conflict, note the disagreement and cite both.
- Never invent a timestamp or meeting name not shown in the excerpts.`;

// Gemini RAG response schema
const QUERY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: {
      type: Type.STRING,
    },
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
        required: ["meetingTitle", "meetingId", "timestamp", "quote"],
      },
    },
    confidence: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
    },
  },
  required: ["answer", "citations", "confidence"],
};

// Extract structured meeting summary
export async function extractStructuredSummary(
  transcriptText: string,
): Promise<MeetingSummary> {
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `${SYSTEM_PROMPT}

Today's date: ${today}

Transcript:
${transcriptText}`;

  const raw = await generateJSON(prompt, RESPONSE_SCHEMA);

  return safeParseJSON(raw);
}

// Build RAG query prompt
export function buildQueryPrompt(
  question: string,
  context: string,
): string {
  return `${QUERY_SYSTEM_PROMPT}

EXCERPTS:
${context}

QUESTION: ${question}`;
}

// Generate RAG answer
export async function answerQuery(
  question: string,
  context: string,
): Promise<QueryAnswer> {
  const prompt = buildQueryPrompt(question, context);

  const raw = await generateJSON(prompt, QUERY_RESPONSE_SCHEMA);

  return safeParseQueryJSON(raw);
}

// Safely parse Gemini meeting summary response
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

  if (parsed.success) {
    return {
      ...parsed.data,
      title: parsed.data.title.trim() || "General Discussion",
    };
  }

  console.warn("Schema validation failed:", parsed.error.issues);

  return coerceToSchema(candidate);
}

// Safely parse Gemini RAG response
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

  if (parsed.success) {
    return parsed.data;
  }

  console.warn("Query schema validation failed:", parsed.error.issues);

  return coerceToQuerySchema(candidate);
}

// Meeting summary fallback
function fallbackSummary(): MeetingSummary {
  return {
    title: "General Discussion",
    summary: "Summary extraction failed — could not parse model output.",
    keyDecisions: [],
    actionItems: [],
  };
}

// RAG fallback
function fallbackQueryAnswer(): QueryAnswer {
  return {
    answer: "Could not parse a response — please try rephrasing the question.",
    citations: [],
    confidence: "low",
  };
}

// Coerce meeting summary response into expected structure
function coerceToSchema(raw: any): MeetingSummary {
  return {
    title:
      typeof raw?.title === "string" && raw.title.trim().length > 0
        ? raw.title.trim()
        : "General Discussion",

    summary:
      typeof raw?.summary === "string"
        ? raw.summary
        : "Summary unavailable.",

    keyDecisions: Array.isArray(raw?.keyDecisions)
      ? raw.keyDecisions.filter(
          (decision: unknown) => typeof decision === "string",
        )
      : [],

    actionItems: Array.isArray(raw?.actionItems)
      ? raw.actionItems
          .filter(
            (item: any) => item && typeof item.task === "string",
          )
          .map((item: any) => ({
            task: item.task,
            owner:
              typeof item.owner === "string"
                ? item.owner
                : "unassigned",
            dueDate:
              typeof item.dueDate === "string"
                ? item.dueDate
                : null,
          }))
      : [],
  };
}

// Coerce RAG response into expected structure
function coerceToQuerySchema(raw: any): QueryAnswer {
  return {
    answer:
      typeof raw?.answer === "string"
        ? raw.answer
        : "Answer unavailable.",

    citations: Array.isArray(raw?.citations)
      ? raw.citations
          .filter(
            (citation: any) =>
              citation &&
              typeof citation.meetingTitle === "string" &&
              typeof citation.timestamp === "string",
          )
          .map((citation: any) => ({
            meetingTitle: citation.meetingTitle,
            meetingId:
              typeof citation.meetingId === "string"
                ? citation.meetingId
                : "",
            timestamp: citation.timestamp,
            quote:
              typeof citation.quote === "string"
                ? citation.quote
                : "",
          }))
      : [],

    confidence: ["high", "medium", "low"].includes(raw?.confidence)
      ? raw.confidence
      : "low",
  };
}