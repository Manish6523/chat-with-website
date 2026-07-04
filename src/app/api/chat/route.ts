import { NextRequest, NextResponse } from "next/server";
import { retrieveRelevantChunks, MatchedChunk } from "@/lib/retrieval";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Build the RAG prompt from retrieved chunks and the user's question
function buildPrompt(chunks: MatchedChunk[], question: string): string {
  const contextBlocks = chunks
    .map(
      (c, i) =>
        `--- Source ${i + 1} ---\n` +
        `URL: ${c.url}\n` +
        `Title: ${c.title}\n` +
        `Content:\n${c.content}\n`
    )
    .join("\n");

  return (
    `You are a helpful assistant that answers questions about a website.\n` +
    `You must answer the question ONLY using the context provided below.\n` +
    `Do NOT make up, guess, or infer any facts that are not explicitly stated in the context.\n` +
    `If the context does not contain enough information to answer the question, ` +
    `respond exactly with: "I don't have information about that on this site."\n\n` +
    `=== CONTEXT ===\n${contextBlocks}\n=== END CONTEXT ===\n\n` +
    `Question: ${question}\n\n` +
    `Answer:`
  );
}

// Deduplicate sources by URL and return a clean array
function buildSources(chunks: MatchedChunk[]): { url: string; title: string }[] {
  const seen = new Set<string>();
  const sources: { url: string; title: string }[] = [];

  for (const c of chunks) {
    if (!seen.has(c.url)) {
      seen.add(c.url);
      sources.push({ url: c.url, title: c.title });
    }
  }

  return sources;
}

// Call the Gemini generateContent REST API
async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. " +
        "Add it to .env.local before using the chat endpoint."
    );
  }

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "(no body)");
    throw new Error(
      `Gemini generateContent failed — HTTP ${res.status}: ${detail}`
    );
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      `Unexpected Gemini response shape: ${JSON.stringify(data)}`
    );
  }

  return text;
}

export async function POST(request: NextRequest) {
  // Parse and validate the request body
  let question: string;
  try {
    const body = await request.json();
    question = body?.question;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!question || typeof question !== "string") {
    return NextResponse.json(
      { error: 'Missing required field: "question"' },
      { status: 400 }
    );
  }

  try {
    console.log(`[api/chat] Question: "${question}"`);

    // Step 1: Retrieve relevant chunks from the vector store
    const chunks = await retrieveRelevantChunks(question);

    if (chunks.length === 0) {
      console.log("[api/chat] No chunks retrieved — returning fallback answer");
      return NextResponse.json({
        answer: "I don't have information about that on this site.",
        sources: [],
      });
    }

    // Step 2: Build the RAG prompt and call Gemini
    const prompt = buildPrompt(chunks, question);
    console.log(`[api/chat] Sending prompt to ${GEMINI_MODEL} (${prompt.length} chars)`);

    const answer = await callGemini(prompt);

    // Step 3: Build deduplicated sources from the retrieved chunks
    const sources = buildSources(chunks);

    console.log(`[api/chat] Answer generated (${answer.length} chars, ${sources.length} source(s))`);

    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error("[api/chat] Error:", err);
    return NextResponse.json(
      { error: "Chat failed", details: String(err) },
      { status: 500 }
    );
  }
}

// Reject other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Use POST with { question: string } in the body' },
    { status: 405 }
  );
}
