-- adding vector extension in supabase \\ but i already added from the dashboard of supabase
create extension if not exists vector;

-- Pages Table \\ one row per crawled page
create table pages (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text,
  crawled_at timestamptz default now()
);

-- chunks Table \ one row per chunk of text from a page
create table chunks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references pages(id) on delete cascade,
  content text not null,
  embedding vector(768),
  created_at timestamptz default now()
);

-- added index fro fast searching
create index on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);