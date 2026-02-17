-- =====================================================================
-- RAG Level 1 (pgvector) - Academic AI Study System
-- - Enable pgvector
-- - Create file_embeddings table
-- - Create cosine similarity search function
-- - Add RLS policies
-- =====================================================================

-- 1) Enable extension
create extension if not exists vector;

-- 2) Table
create table if not exists public.file_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  file_id uuid not null,
  chunk_index int not null default 0,
  content text not null,
  embedding vector(768) not null,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists file_embeddings_user_file_idx
  on public.file_embeddings (user_id, file_id, chunk_index);

-- Vector index for cosine distance
-- Note: ivfflat requires ANALYZE and enough rows to be effective.
create index if not exists file_embeddings_embedding_ivfflat
  on public.file_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 3) RLS
alter table public.file_embeddings enable row level security;

drop policy if exists "file_embeddings_owner_select" on public.file_embeddings;
drop policy if exists "file_embeddings_owner_insert" on public.file_embeddings;
drop policy if exists "file_embeddings_owner_update" on public.file_embeddings;
drop policy if exists "file_embeddings_owner_delete" on public.file_embeddings;

create policy "file_embeddings_owner_select" on public.file_embeddings
for select
to authenticated
using (auth.uid() = user_id);

create policy "file_embeddings_owner_insert" on public.file_embeddings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "file_embeddings_owner_update" on public.file_embeddings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "file_embeddings_owner_delete" on public.file_embeddings
for delete
to authenticated
using (auth.uid() = user_id);

-- 4) Similarity search function
-- Cosine similarity = 1 - cosine_distance
-- We filter by user_id (privacy) and optionally by file_id

create or replace function public.match_file_embeddings(
  query_embedding vector(768),
  match_count int default 8,
  filter_user_id uuid default auth.uid(),
  filter_file_id uuid default null
)
returns table (
  id uuid,
  file_id uuid,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    fe.id,
    fe.file_id,
    fe.chunk_index,
    fe.content,
    (1 - (fe.embedding <=> query_embedding))::float as similarity
  from public.file_embeddings fe
  where fe.user_id = filter_user_id
    and (filter_file_id is null or fe.file_id = filter_file_id)
  order by fe.embedding <=> query_embedding
  limit greatest(1, match_count);
$$;

-- Grant execute
grant execute on function public.match_file_embeddings(vector(768), int, uuid, uuid)
to authenticated;

-- If you plan to call this from anon (NOT recommended), you could grant to anon,
-- but keep it authenticated for privacy.

-- =====================================================================
-- END
-- =====================================================================
