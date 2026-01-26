-- Add Groups table for organizing products
-- Run this SQL in your Supabase SQL Editor

-- Groups table
create table if not exists public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add group_id to products table
alter table public.products
add column if not exists group_id uuid references public.groups on delete set null;

-- Create index for faster queries
create index if not exists idx_products_group_id on public.products(group_id);

-- Enable RLS on groups table
alter table public.groups enable row level security;

-- Groups policies (everyone can read, only admins can write)
create policy "Anyone can view groups"
  on public.groups for select
  to authenticated
  using (true);

create policy "Admins can insert groups"
  on public.groups for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Admins can update groups"
  on public.groups for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Admins can delete groups"
  on public.groups for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
