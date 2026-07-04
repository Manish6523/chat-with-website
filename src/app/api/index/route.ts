import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { crawlSite } from "@/lib/crawler";
import { chunkText } from "@/lib/chunker";
import { embedBatch } from "@/lib/embeddings";

// Create a Supabase client using the service role key (bypasses RLS).
// This must only ever be used in a server-side context.
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

export async function POST(request: NextRequest) {
  // Parse and validate request body
  let url: string;
  try {
    const body = await request.json();
    url = body?.url;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: 'Missing required field: "url"' },
      { status: 400 }
    );
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const supabase = getSupabase();
  let pagesIndexed = 0;
  let chunksCreated = 0;

  console.log(`[api/index] Starting crawl for: ${url}`);

  const pages = await crawlSite(url);
  console.log(`[api/index] Crawled ${pages.length} pages — beginning indexing`);

  for (const page of pages) {
    try {
      // Upsert the page row (safe to re-run — url has a UNIQUE constraint).
      // onConflict: "url" ensures we get the existing row id back on a duplicate.
      const { data: pageRow, error: pageError } = await supabase
        .from("pages")
        .upsert({ url: page.url, title: page.title }, { onConflict: "url" })
        .select("id")
        .single();

      if (pageError || !pageRow) {
        console.error(
          `[api/index] Could not upsert page ${page.url}:`,
          pageError?.message
        );
        continue;
      }

      const pageId: string = pageRow.id;

      // Split the cleaned page text into overlapping word chunks
      const chunks = chunkText(page.cleanText);

      if (chunks.length === 0) {
        console.warn(`[api/index] No chunks produced for ${page.url} — skipping`);
        pagesIndexed++;
        continue;
      }

      console.log(
        `[api/index] Embedding ${chunks.length} chunk(s) for ${page.url}`
      );

      // Embed all chunks sequentially with a 200 ms delay between calls
      const embeddings = await embedBatch(chunks);

      // Build the rows for the chunks table
      const chunkRows = chunks.map((content, i) => ({
        page_id: pageId,
        content,
        embedding: embeddings[i], // vector(768) stored as a JSON array by supabase-js
      }));

      const { error: chunksError } = await supabase
        .from("chunks")
        .insert(chunkRows);

      if (chunksError) {
        console.error(
          `[api/index] Failed to insert chunks for ${page.url}:`,
          chunksError.message
        );
      } else {
        chunksCreated += chunkRows.length;
      }

      pagesIndexed++;
    } catch (err) {
      // A single failing page should not abort the whole indexing run
      console.error(`[api/index] Unexpected error for ${page.url}:`, err);
    }
  }

  console.log(
    `[api/index] Done — ${pagesIndexed} page(s), ${chunksCreated} chunk(s) indexed`
  );

  return NextResponse.json({
    success: true,
    pagesIndexed,
    chunksCreated,
  });
}

// Reject other HTTP methods with a usage hint
export async function GET() {
  return NextResponse.json(
    { error: "Use POST with { url: string } in the body" },
    { status: 405 }
  );
}
