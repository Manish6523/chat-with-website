import { createClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/embeddings";

// Types returned by the match_chunks Supabase RPC function
export interface MatchedChunk {
  id: string;
  content: string;
  page_id: string;
  url: string;
  title: string;
  similarity: number;
}

// Supabase service-role client (server-side only)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables. " +
        "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local"
    );
  }

  return createClient(url, key);
}

/**
 * Embed the user's question and retrieve the most relevant chunks
 * from the Supabase vector store via the match_chunks RPC function.
 *
 * @param question - The user's natural-language question
 * @param topK     - Number of chunks to retrieve (default 5)
 * @returns The top-k matched chunks ordered by cosine similarity (descending)
 */
export async function retrieveRelevantChunks(
  question: string,
  topK = 5
): Promise<MatchedChunk[]> {
  console.log(`[retrieval] Embedding question: "${question}"`);

  const queryEmbedding = await embedText(question);

  console.log(`[retrieval] Calling match_chunks RPC (topK=${topK})`);

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_count: topK,
  });

  if (error) {
    throw new Error(`match_chunks RPC failed: ${error.message}`);
  }

  const chunks = (data ?? []) as MatchedChunk[];

  console.log(`[retrieval] Retrieved ${chunks.length} chunk(s)`);
  chunks.forEach((c, i) => {
    console.log(
      `  [${i + 1}] similarity=${c.similarity.toFixed(4)} | url=${c.url} | "${c.content.slice(0, 80)}…"`
    );
  });

  return chunks;
}
