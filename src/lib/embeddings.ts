/**
 * Thin wrapper around the Gemini text-embedding-004 REST API.
 *
 * Endpoint docs:
 * https://ai.google.dev/api/embeddings#method:-models.embedcontent
 *
 * The model produces 768-dimensional vectors, matching the Supabase schema.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "text-embedding-004";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`;
const BATCH_DELAY_MS = 200; // pause between calls to respect rate limits

/**
 * Embed a single string using the Gemini text-embedding-004 model.
 *
 * @throws {Error} if the API call fails or returns an unexpected shape
 */
export async function embedText(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. " +
        "Add it to .env.local before running the indexing pipeline."
    );
  }

  const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${MODEL}`,
      content: { parts: [{ text }] },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "(no body)");
    throw new Error(
      `Gemini embedContent failed — HTTP ${res.status}: ${detail}`
    );
  }

  const data = await res.json();
  const values: unknown = data?.embedding?.values;

  if (!Array.isArray(values)) {
    throw new Error(
      `Unexpected Gemini API response shape: ${JSON.stringify(data)}`
    );
  }

  return values as number[];
}

/**
 * Embed an array of strings, one at a time with a short delay between
 * requests to avoid triggering Gemini rate limits.
 *
 * @returns A parallel array of embedding vectors (same order as input)
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    // Pause before every call except the very first
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }

    const vector = await embedText(texts[i]);
    embeddings.push(vector);
  }

  return embeddings;
}
