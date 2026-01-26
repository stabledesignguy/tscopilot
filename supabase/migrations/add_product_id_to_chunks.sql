-- Add product_id directly to document_chunks for reliable filtering
-- Run this SQL in your Supabase SQL Editor

-- Add product_id column to document_chunks
ALTER TABLE public.document_chunks
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products ON DELETE CASCADE;

-- Populate product_id from documents table for existing chunks
UPDATE public.document_chunks dc
SET product_id = d.product_id
FROM public.documents d
WHERE dc.document_id = d.id
AND dc.product_id IS NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_document_chunks_product_id ON public.document_chunks(product_id);

-- Update the match_documents function to filter directly on chunks
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_product_id uuid
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE dc.product_id = filter_product_id
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;
