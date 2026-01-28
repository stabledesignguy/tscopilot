-- Multi-Tenant Organization System Migration
-- Run this SQL in your Supabase SQL Editor
-- This adds organization-based multi-tenancy to the platform

-- ============================================
-- PART 1: Create New Tables
-- ============================================

-- Organizations table
create table if not exists public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  logo_url text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Organization settings table
create table if not exists public.organization_settings (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations on delete cascade unique not null,
  -- LLM: Select from platform's configured providers (Claude/OpenAI/Gemini)
  llm_provider text check (llm_provider in ('claude', 'openai', 'gemini')),
  llm_model text,
  -- Per-org system instructions (overrides default)
  system_instructions text,
  -- Limits
  max_users integer default 50,
  max_products integer default 100,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Organization members table (many-to-many relationship)
create table if not exists public.organization_members (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text default 'user' check (role in ('user', 'admin')),
  invited_by uuid references auth.users on delete set null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_active boolean default true,
  unique(organization_id, user_id)
);

-- Organization invitations table
create table if not exists public.organization_invitations (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  email text not null,
  role text default 'user' check (role in ('user', 'admin')),
  token text unique not null,
  invited_by uuid references auth.users on delete set null,
  expires_at timestamp with time zone not null,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- PART 2: Modify Existing Tables
-- ============================================

-- Add is_super_admin to profiles
alter table public.profiles
add column if not exists is_super_admin boolean default false;

-- Add organization_id to products (nullable initially for migration)
alter table public.products
add column if not exists organization_id uuid references public.organizations on delete cascade;

-- Add organization_id to groups
alter table public.groups
add column if not exists organization_id uuid references public.organizations on delete cascade;

-- Add organization_id to conversations
alter table public.conversations
add column if not exists organization_id uuid references public.organizations on delete cascade;

-- Add organization_id to system_instructions
alter table public.system_instructions
add column if not exists organization_id uuid references public.organizations on delete cascade;

-- ============================================
-- PART 3: Create Indexes
-- ============================================

create index if not exists idx_organizations_slug on public.organizations(slug);
create index if not exists idx_organization_members_user_id on public.organization_members(user_id);
create index if not exists idx_organization_members_org_id on public.organization_members(organization_id);
create index if not exists idx_organization_invitations_token on public.organization_invitations(token);
create index if not exists idx_organization_invitations_email on public.organization_invitations(email);
create index if not exists idx_products_organization_id on public.products(organization_id);
create index if not exists idx_groups_organization_id on public.groups(organization_id);
create index if not exists idx_conversations_organization_id on public.conversations(organization_id);

-- ============================================
-- PART 4: RLS Helper Functions
-- ============================================

-- Check if user is super admin
create or replace function public.is_super_admin()
returns boolean as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid()),
    false
  );
$$ language sql security definer stable;

-- Get user's organizations
create or replace function public.get_user_organizations()
returns setof uuid as $$
  select organization_id from public.organization_members
  where user_id = auth.uid() and is_active = true;
$$ language sql security definer stable;

-- Check if user is org admin
create or replace function public.is_org_admin(org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
    and organization_id = org_id
    and role = 'admin'
    and is_active = true
  );
$$ language sql security definer stable;

-- Check if user is org member
create or replace function public.is_org_member(org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
    and organization_id = org_id
    and is_active = true
  );
$$ language sql security definer stable;

-- Get user's current selected organization from session (fallback to first org)
-- This function is used for default org context
create or replace function public.get_current_organization()
returns uuid as $$
  select organization_id from public.organization_members
  where user_id = auth.uid() and is_active = true
  order by joined_at asc
  limit 1;
$$ language sql security definer stable;

-- ============================================
-- PART 5: Enable RLS on New Tables
-- ============================================

alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;

-- ============================================
-- PART 6: Organizations RLS Policies
-- ============================================

-- Super admins can view all organizations
create policy "Super admins can view all organizations"
  on public.organizations for select
  to authenticated
  using (public.is_super_admin());

-- Members can view their organizations
create policy "Members can view their organizations"
  on public.organizations for select
  to authenticated
  using (id in (select public.get_user_organizations()));

-- Super admins can create organizations
create policy "Super admins can create organizations"
  on public.organizations for insert
  to authenticated
  with check (public.is_super_admin());

-- Super admins can update organizations
create policy "Super admins can update organizations"
  on public.organizations for update
  to authenticated
  using (public.is_super_admin());

-- Super admins can delete organizations
create policy "Super admins can delete organizations"
  on public.organizations for delete
  to authenticated
  using (public.is_super_admin());

-- ============================================
-- PART 7: Organization Settings RLS Policies
-- ============================================

-- Super admins and org admins can view settings
create policy "Super admins can view all org settings"
  on public.organization_settings for select
  to authenticated
  using (public.is_super_admin());

create policy "Org admins can view their org settings"
  on public.organization_settings for select
  to authenticated
  using (public.is_org_admin(organization_id));

-- Super admins can create settings
create policy "Super admins can create org settings"
  on public.organization_settings for insert
  to authenticated
  with check (public.is_super_admin());

-- Super admins and org admins can update settings
create policy "Super admins can update org settings"
  on public.organization_settings for update
  to authenticated
  using (public.is_super_admin());

create policy "Org admins can update their org settings"
  on public.organization_settings for update
  to authenticated
  using (public.is_org_admin(organization_id));

-- Only super admins can delete settings
create policy "Super admins can delete org settings"
  on public.organization_settings for delete
  to authenticated
  using (public.is_super_admin());

-- ============================================
-- PART 8: Organization Members RLS Policies
-- ============================================

-- Super admins can view all members
create policy "Super admins can view all org members"
  on public.organization_members for select
  to authenticated
  using (public.is_super_admin());

-- Org admins and members can view their org's members
create policy "Org members can view their org members"
  on public.organization_members for select
  to authenticated
  using (public.is_org_member(organization_id));

-- Super admins and org admins can manage members
create policy "Super admins can create org members"
  on public.organization_members for insert
  to authenticated
  with check (public.is_super_admin() or public.is_org_admin(organization_id));

create policy "Super admins can update org members"
  on public.organization_members for update
  to authenticated
  using (public.is_super_admin() or public.is_org_admin(organization_id));

create policy "Super admins can delete org members"
  on public.organization_members for delete
  to authenticated
  using (public.is_super_admin() or public.is_org_admin(organization_id));

-- ============================================
-- PART 9: Organization Invitations RLS Policies
-- ============================================

-- Super admins can view all invitations
create policy "Super admins can view all invitations"
  on public.organization_invitations for select
  to authenticated
  using (public.is_super_admin());

-- Org admins can view their org's invitations
create policy "Org admins can view their org invitations"
  on public.organization_invitations for select
  to authenticated
  using (public.is_org_admin(organization_id));

-- Super admins and org admins can create invitations
create policy "Admins can create invitations"
  on public.organization_invitations for insert
  to authenticated
  with check (public.is_super_admin() or public.is_org_admin(organization_id));

-- Super admins and org admins can update invitations
create policy "Admins can update invitations"
  on public.organization_invitations for update
  to authenticated
  using (public.is_super_admin() or public.is_org_admin(organization_id));

-- Super admins and org admins can delete invitations
create policy "Admins can delete invitations"
  on public.organization_invitations for delete
  to authenticated
  using (public.is_super_admin() or public.is_org_admin(organization_id));

-- ============================================
-- PART 10: Update Existing Table Policies
-- ============================================

-- Drop old products policies and create org-scoped ones
drop policy if exists "Anyone can view products" on public.products;
drop policy if exists "Admins can insert products" on public.products;
drop policy if exists "Admins can update products" on public.products;
drop policy if exists "Admins can delete products" on public.products;

-- New products policies (org-scoped)
create policy "Super admins can view all products"
  on public.products for select
  to authenticated
  using (public.is_super_admin());

create policy "Members can view their org products"
  on public.products for select
  to authenticated
  using (organization_id in (select public.get_user_organizations()));

create policy "Org admins can insert products"
  on public.products for insert
  to authenticated
  with check (
    public.is_super_admin() or
    (organization_id in (select public.get_user_organizations()) and public.is_org_admin(organization_id))
  );

create policy "Org admins can update products"
  on public.products for update
  to authenticated
  using (
    public.is_super_admin() or
    (organization_id in (select public.get_user_organizations()) and public.is_org_admin(organization_id))
  );

create policy "Org admins can delete products"
  on public.products for delete
  to authenticated
  using (
    public.is_super_admin() or
    (organization_id in (select public.get_user_organizations()) and public.is_org_admin(organization_id))
  );

-- Drop old groups policies and create org-scoped ones
drop policy if exists "Anyone can view groups" on public.groups;
drop policy if exists "Admins can insert groups" on public.groups;
drop policy if exists "Admins can update groups" on public.groups;
drop policy if exists "Admins can delete groups" on public.groups;

-- New groups policies (org-scoped)
create policy "Super admins can view all groups"
  on public.groups for select
  to authenticated
  using (public.is_super_admin());

create policy "Members can view their org groups"
  on public.groups for select
  to authenticated
  using (organization_id in (select public.get_user_organizations()));

create policy "Org admins can insert groups"
  on public.groups for insert
  to authenticated
  with check (
    public.is_super_admin() or
    (organization_id in (select public.get_user_organizations()) and public.is_org_admin(organization_id))
  );

create policy "Org admins can update groups"
  on public.groups for update
  to authenticated
  using (
    public.is_super_admin() or
    (organization_id in (select public.get_user_organizations()) and public.is_org_admin(organization_id))
  );

create policy "Org admins can delete groups"
  on public.groups for delete
  to authenticated
  using (
    public.is_super_admin() or
    (organization_id in (select public.get_user_organizations()) and public.is_org_admin(organization_id))
  );

-- Update conversations policies to be org-scoped
drop policy if exists "Users can view their own conversations" on public.conversations;
drop policy if exists "Users can create conversations" on public.conversations;
drop policy if exists "Users can update their own conversations" on public.conversations;
drop policy if exists "Users can delete their own conversations" on public.conversations;

create policy "Users can view their own org conversations"
  on public.conversations for select
  to authenticated
  using (
    auth.uid() = user_id and
    organization_id in (select public.get_user_organizations())
  );

create policy "Users can create org conversations"
  on public.conversations for insert
  to authenticated
  with check (
    auth.uid() = user_id and
    organization_id in (select public.get_user_organizations())
  );

create policy "Users can update their own org conversations"
  on public.conversations for update
  to authenticated
  using (
    auth.uid() = user_id and
    organization_id in (select public.get_user_organizations())
  );

create policy "Users can delete their own org conversations"
  on public.conversations for delete
  to authenticated
  using (
    auth.uid() = user_id and
    organization_id in (select public.get_user_organizations())
  );

-- Update documents policies to be org-scoped through products
drop policy if exists "Anyone can view documents" on public.documents;
drop policy if exists "Admins can manage documents" on public.documents;

create policy "Members can view org documents"
  on public.documents for select
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = documents.product_id
      and (public.is_super_admin() or p.organization_id in (select public.get_user_organizations()))
    )
  );

create policy "Org admins can manage documents"
  on public.documents for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = documents.product_id
      and (public.is_super_admin() or (p.organization_id in (select public.get_user_organizations()) and public.is_org_admin(p.organization_id)))
    )
  );

-- Update document_chunks policies
drop policy if exists "Anyone can view document chunks" on public.document_chunks;

create policy "Members can view org document chunks"
  on public.document_chunks for select
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      inner join public.products p on d.product_id = p.id
      where d.id = document_chunks.document_id
      and (public.is_super_admin() or p.organization_id in (select public.get_user_organizations()))
    )
  );

-- Update profiles policy to allow viewing org members' profiles
drop policy if exists "Users can view their own profile" on public.profiles;

create policy "Users can view their own and org members profiles"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id
    or public.is_super_admin()
    or id in (
      select om.user_id from public.organization_members om
      where om.organization_id in (select public.get_user_organizations())
      and om.is_active = true
    )
  );

-- ============================================
-- PART 11: Update match_documents function for org context
-- ============================================

-- Drop and recreate match_documents with org filtering
drop function if exists match_documents(vector(1536), float, int, uuid);

create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_product_id uuid,
  filter_organization_id uuid default null
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
  inner join public.products p on d.product_id = p.id
  where d.product_id = filter_product_id
    and (filter_organization_id is null or p.organization_id = filter_organization_id)
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================
-- PART 12: Updated Triggers
-- ============================================

-- Update the handle_new_user trigger to not set super admin by default
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, is_super_admin)
  values (new.id, new.email, 'user', false);
  return new;
end;
$$ language plpgsql security definer;

-- Function to auto-create organization settings when org is created
create or replace function public.handle_new_organization()
returns trigger as $$
begin
  insert into public.organization_settings (organization_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create settings on new org
drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute procedure public.handle_new_organization();

-- ============================================
-- PART 13: Default Organization Migration
-- ============================================

-- Create default organization for existing data
do $$
declare
  default_org_id uuid;
begin
  -- Only create if we have products without organization_id
  if exists (select 1 from public.products where organization_id is null) then
    -- Create default organization
    insert into public.organizations (name, slug, is_active)
    values ('Default Organization', 'default', true)
    returning id into default_org_id;

    -- Migrate all existing products
    update public.products
    set organization_id = default_org_id
    where organization_id is null;

    -- Migrate all existing groups
    update public.groups
    set organization_id = default_org_id
    where organization_id is null;

    -- Migrate all existing conversations
    update public.conversations
    set organization_id = default_org_id
    where organization_id is null;

    -- Migrate all existing system_instructions
    update public.system_instructions
    set organization_id = default_org_id
    where organization_id is null;

    -- Add all existing users to default organization
    insert into public.organization_members (organization_id, user_id, role)
    select default_org_id, p.id,
      case when p.role = 'admin' then 'admin' else 'user' end
    from public.profiles p;
  end if;
end;
$$;

-- Note: After backfilling data, you can make organization_id NOT NULL:
-- alter table public.products alter column organization_id set not null;
-- alter table public.groups alter column organization_id set not null;
-- alter table public.conversations alter column organization_id set not null;
