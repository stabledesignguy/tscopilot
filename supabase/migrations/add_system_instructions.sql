-- Create system_instructions table for storing customizable AI system prompts
create table if not exists public.system_instructions (
  id uuid default gen_random_uuid() primary key,
  instructions text not null,
  updated_by uuid references auth.users on delete set null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.system_instructions enable row level security;

-- Anyone authenticated can view system instructions
create policy "Anyone can view" on public.system_instructions
  for select to authenticated using (true);

-- Only admins can insert/update/delete
create policy "Admins can manage" on public.system_instructions
  for all to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

-- Create trigger to auto-update updated_at
create or replace function update_system_instructions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger system_instructions_updated_at
  before update on public.system_instructions
  for each row
  execute function update_system_instructions_updated_at();
