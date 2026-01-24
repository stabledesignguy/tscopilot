-- TScopilot Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable pgvector extension for embeddings
create extension if not exists vector;

-- Profiles table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Products table
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Documents table
create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products on delete cascade not null,
  filename text not null,
  file_url text not null,
  file_size integer not null,
  mime_type text not null,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processing', 'completed', 'failed')),
  uploaded_by uuid references auth.users on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Document chunks table (for RAG)
create table if not exists public.document_chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents on delete cascade not null,
  content text not null,
  embedding vector(1536),
  chunk_index integer not null,
  metadata jsonb default '{}'::jsonb
);

-- Conversations table
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  product_id uuid references public.products on delete cascade not null,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Messages table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  llm_used text check (llm_used in ('claude', 'openai', 'gemini') or llm_used is null),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better query performance
create index if not exists idx_documents_product_id on public.documents(product_id);
create index if not exists idx_document_chunks_document_id on public.document_chunks(document_id);
create index if not exists idx_conversations_user_id on public.conversations(user_id);
create index if not exists idx_conversations_product_id on public.conversations(product_id);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);

-- Create index for vector similarity search
create index if not exists idx_document_chunks_embedding on public.document_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Function to automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function for vector similarity search (used by RAG)
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
  chunk_index int,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  inner join public.documents d on dc.document_id = d.id
  where d.product_id = filter_product_id
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Profiles policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Products policies (everyone can read, only admins can write)
create policy "Anyone can view products"
  on public.products for select
  to authenticated
  using (true);

create policy "Admins can insert products"
  on public.products for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Admins can update products"
  on public.products for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Admins can delete products"
  on public.products for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Documents policies
create policy "Anyone can view documents"
  on public.documents for select
  to authenticated
  using (true);

create policy "Admins can manage documents"
  on public.documents for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Document chunks policies
create policy "Anyone can view document chunks"
  on public.document_chunks for select
  to authenticated
  using (true);

create policy "Service role can manage chunks"
  on public.document_chunks for all
  to service_role
  using (true);

-- Conversations policies
create policy "Users can view their own conversations"
  on public.conversations for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create conversations"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own conversations"
  on public.conversations for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own conversations"
  on public.conversations for delete
  to authenticated
  using (auth.uid() = user_id);

-- Messages policies
create policy "Users can view messages in their conversations"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "Users can insert messages in their conversations"
  on public.messages for insert
  to authenticated
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

-- Storage bucket for documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Anyone can view documents"
  on storage.objects for select
  using (bucket_id = 'documents');

create policy "Admins can upload documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Admins can delete documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
