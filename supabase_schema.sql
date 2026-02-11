-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users Table (Public Profile)
-- Syncs with auth.users via trigger
create table if not exists public.users (
  id uuid references auth.users(id) on delete cascade not null primary key,
  email text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  subscription_status text default 'free',
  metadata jsonb default '{}'::jsonb
);

-- RLS for users
alter table public.users enable row level security;
create policy "Users can view own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- 10. Batches Table (New)
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- RLS for Batches
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own batches" ON public.batches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own batches" ON public.batches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own batches" ON public.batches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own batches" ON public.batches
  FOR DELETE USING (auth.uid() = user_id);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, processing, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL
);

-- Index on batch_id
CREATE INDEX IF NOT EXISTS idx_projects_batch_id ON public.projects(batch_id);

-- RLS for Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);


-- 3. API Keys Table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key_name TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  permissions JSONB DEFAULT '[]'::jsonb,
  UNIQUE(user_id, key_name)
);

-- RLS for API Keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own api keys" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own api keys" ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own api keys" ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own api keys" ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);


-- 4. Jobs/Usage Tracking Table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  parameters JSONB DEFAULT '{}'::jsonb,
  result JSONB,
  error_logs TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- RLS for Jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs" ON public.jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs" ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" ON public.jobs
  FOR UPDATE USING (auth.uid() = user_id);


-- 5. Job Assets Table
create table if not exists public.job_assets (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  asset_type text not null, -- input_video, output_video, thumbnail, etc.
  file_url text not null,
  file_size bigint,
  duration float,
  metadata jsonb default '{}'::jsonb,
  storage_path text,
  created_at timestamptz default now()
);

-- RLS for job_assets
alter table public.job_assets enable row level security;
create policy "Users can view own job assets" on public.job_assets for select using (
  exists (select 1 from public.jobs where jobs.id = job_assets.job_id and jobs.user_id = auth.uid())
);
create policy "Users can insert own job assets" on public.job_assets for insert with check (
  exists (select 1 from public.jobs where jobs.id = job_assets.job_id and jobs.user_id = auth.uid())
);


-- 6. Audit Logs Table (for API Key usage and sensitive actions)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- e.g., 'api_key_access', 'project_delete'
  resource_type TEXT NOT NULL, -- 'api_key', 'project'
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);


-- 7. User Media Items Table (Static Catalog)
CREATE TABLE IF NOT EXISTS public.user_media_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  storage_path TEXT, -- Permanent storage path/URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for User Media Items
ALTER TABLE public.user_media_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own media items" ON public.user_media_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own media items" ON public.user_media_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own media items" ON public.user_media_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media items" ON public.user_media_items
  FOR DELETE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_media_items_user_id ON public.user_media_items(user_id);


-- 8. Project Media Items Table (Usage Tracking)
CREATE TABLE IF NOT EXISTS public.project_media_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_media_item_id UUID REFERENCES public.user_media_items(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(project_id, user_media_item_id)
);

-- RLS for Project Media Items
ALTER TABLE public.project_media_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own project media items" ON public.project_media_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_media_items.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own project media items" ON public.project_media_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_media_items.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_project_media_items_project_id ON public.project_media_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_media_items_item_id ON public.project_media_items(user_media_item_id);


-- 9. Functions & Triggers

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, metadata)
  values (new.id, new.email, new.raw_user_meta_data);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
