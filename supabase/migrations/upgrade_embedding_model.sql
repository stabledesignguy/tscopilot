-- Migration: Upgrade embedding model from text-embedding-3-small to text-embedding-3-large
-- Keep 1536 dimensions (pgvector index limit) but use better model for improved semantic understanding

drop index if exists idx_document_chunks_embedding;

drop function if exists match_documents(vector(1536), float, int, uuid);

delete from public.document_chunks;

create index idx_document_chunks_embedding on public.document_chunks
using hnsw (embedding vector_cosine_ops);

create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_product_id uuid
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  chunk_index int,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where
    dc.product_id = filter_product_id
    and dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;

update public.documents set processing_status = 'pending';
