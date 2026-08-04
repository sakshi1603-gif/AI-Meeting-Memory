import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
const EMBEDDING_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`;

const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

interface GeminiEmbedResponse {
  embeddings: { values: number[] }[];
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment');
  }
  if (texts.length === 0) return [];

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await embedBatchWithRetry(batch, 'RETRIEVAL_DOCUMENT');
    results.push(...batchEmbeddings);
  }

  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment');
  }
  const [vector] = await embedBatchWithRetry([text], 'RETRIEVAL_QUERY');
  return vector;
}

async function embedBatchWithRetry(
  batch: string[],
  taskType: string,
  attempt = 1
): Promise<number[][]> {
  try {
    const response = await fetch(`${EMBEDDING_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: 768
        }))
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini embeddings API error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as GeminiEmbedResponse;
    return data.embeddings.map((e) => e.values);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delayMs = attempt * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return embedBatchWithRetry(batch, taskType, attempt + 1);
    }
    throw err;
  }
}