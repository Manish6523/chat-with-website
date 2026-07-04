# Chat with a Website — RAG Pipeline

Crawls a website, indexes its content, and answers questions in a chat interface — grounded in the crawled content, with citations back to source pages.

## Stack

Next.js 14 (App Router, TypeScript) · Supabase Postgres + pgvector · Gemini `gemini-embedding-001` (embeddings) · Gemini `gemini-2.5-flash` (generation)

## How to Run

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up Supabase**
   - Create a project at [supabase.com](https://supabase.com)
   - In the SQL Editor, run `supabase/migrations/001_init_schema.sql` (creates `pages`/`chunks` tables, enables pgvector)
   - Also run the `match_chunks` similarity search function (included in the same migrations folder)

3. **Get a free Gemini API key** at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

4. **Set environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   Required vars:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

5. **Run it**
   ```bash
   npm run dev
   ```
   Open `localhost:3000`, paste a website URL, click **Index Site**, then start chatting.

## Crawling Strategy

- Stays within the starting URL's domain only; breadth-first up to 25 pages / depth 2
- Respects `robots.txt`, waits 500ms between requests
- Strips nav/footer/script/cookie-banner boilerplate before extracting main content
- Skips broken pages without stopping the whole crawl
- Each new "Index Site" clears the previous site's data first (one site at a time)

## Chunking & Retrieval

- Cleaned page text is split into ~600-word chunks with ~80-word overlap, breaking at sentence boundaries where possible
- Each chunk is embedded (768-dim) and stored in Supabase alongside its source page
- At query time, the question is embedded and the top-5 most similar chunks are retrieved via cosine similarity (pgvector)

## Keeping Answers Grounded

- Retrieved chunks are the *only* context given to the model — the prompt explicitly instructs it to answer only from that context and say "I don't have information about that on this site" otherwise
- Source citations are built from the actual retrieved chunks, not parsed from the model's text, so they're always accurate
- Verified manually: correct, cited answers on in-scope questions; graceful refusals on off-topic ones