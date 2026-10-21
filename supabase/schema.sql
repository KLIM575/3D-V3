-- Supabase Schema for KLIM DUSHKIN Portfolio
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CONTENT TABLES
-- ============================================

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  number TEXT,
  title TEXT NOT NULL,
  category TEXT,
  client TEXT,
  year TEXT,
  description TEXT,
  content_md TEXT,
  tags TEXT[],
  image_url TEXT,
  image_path TEXT,
  featured BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  num TEXT,
  name TEXT NOT NULL,
  description TEXT,
  features TEXT[],
  icon TEXT,
  sort_order INT DEFAULT 0,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skills
CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT,
  pct INT,
  category TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timeline
CREATE TABLE IF NOT EXISTS timeline (
  id SERIAL PRIMARY KEY,
  year TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Process Steps
CREATE TABLE IF NOT EXISTS process_steps (
  id SERIAL PRIMARY KEY,
  num TEXT,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FORMS & INTERACTIONS
-- ============================================

-- Contact Submissions
CREATE TABLE IF NOT EXISTS contact_submissions (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Embeddings (for RAG)
CREATE TABLE IF NOT EXISTS content_embeddings (
  id BIGSERIAL PRIMARY KEY,
  content_type TEXT,
  content_id TEXT,
  content_text TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADMIN
-- ============================================

-- Admin Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_published ON projects(published, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(featured, published);
CREATE INDEX IF NOT EXISTS idx_services_published ON services(published, sort_order);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_timeline_sort ON timeline(sort_order);
CREATE INDEX IF NOT EXISTS idx_process_steps_sort ON process_steps(sort_order);
CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_session_id ON chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_content_embeddings_type_id ON content_embeddings(content_type, content_id);

-- Vector index for RAG (requires pgvector)
CREATE INDEX IF NOT EXISTS idx_content_embeddings_vector ON content_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

-- Public read policies (published content only)
CREATE POLICY "Public read published projects" ON projects
  FOR SELECT USING (published = true);

CREATE POLICY "Public read published services" ON services
  FOR SELECT USING (published = true);

CREATE POLICY "Public read skills" ON skills
  FOR SELECT USING (true);

CREATE POLICY "Public read timeline" ON timeline
  FOR SELECT USING (true);

CREATE POLICY "Public read process_steps" ON process_steps
  FOR SELECT USING (true);

-- Admin full access policies
CREATE POLICY "Admin all projects" ON projects FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admin all services" ON services FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admin all skills" ON skills FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admin all timeline" ON timeline FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admin all process_steps" ON process_steps FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admin all contact_submissions" ON contact_submissions FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admin all chat_sessions" ON chat_sessions FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admin all content_embeddings" ON content_embeddings FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admin all admin_profiles" ON admin_profiles FOR ALL
  USING (auth.uid() IN (SELECT id FROM admin_profiles));

-- Contact: anonymous insert, admin read
CREATE POLICY "Anon insert contact" ON contact_submissions
  FOR INSERT WITH CHECK (true);

-- Chat sessions: anon can create/read own session
CREATE POLICY "Anon upsert chat_session" ON chat_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon read own chat_session" ON chat_sessions
  FOR SELECT USING (true);

CREATE POLICY "Anon update own chat_session" ON chat_sessions
  FOR UPDATE USING (true);

-- ============================================
-- STORAGE
-- ============================================

-- Create storage bucket for portfolio images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio-images',
  'portfolio-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies
CREATE POLICY "Public read portfolio images" ON storage.objects
  FOR SELECT USING (bucket_id = 'portfolio-images');

CREATE POLICY "Admin upload portfolio images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'portfolio-images' 
    AND auth.uid() IN (SELECT id FROM admin_profiles)
  );

CREATE POLICY "Admin update portfolio images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'portfolio-images' 
    AND auth.uid() IN (SELECT id FROM admin_profiles)
  );

CREATE POLICY "Admin delete portfolio images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'portfolio-images' 
    AND auth.uid() IN (SELECT id FROM admin_profiles)
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to match content for RAG
CREATE OR REPLACE FUNCTION match_content(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id BIGINT,
  content_type TEXT,
  content_id TEXT,
  content_text TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ce.id,
    ce.content_type,
    ce.content_id,
    ce.content_text,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM content_embeddings ce
  WHERE 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_skills_updated_at ON skills;
CREATE TRIGGER update_skills_updated_at
  BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_timeline_updated_at ON timeline;
CREATE TRIGGER update_timeline_updated_at
  BEFORE UPDATE ON timeline
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_process_steps_updated_at ON process_steps;
CREATE TRIGGER update_process_steps_updated_at
  BEFORE UPDATE ON process_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA (optional - run after tables created)
-- ============================================

-- Insert default process steps
INSERT INTO process_steps (num, title, description, sort_order) VALUES
('01', 'Discovery', 'Изучаю задачу, исследую рынок и определяю цели проекта.', 1),
('02', 'Concept', 'Разрабатываю концепцию, настроение и визуальное направление.', 2),
('03', 'Design', 'Проектирую интерфейсы, 3D-сцены и взаимодействия.', 3),
('04', 'Development', 'Пишу код, оптимизирую и интегрирую технологии.', 4),
('05', 'Delivery', 'Тестирую, разворачиваю и запускаю проект.', 5)
ON CONFLICT DO NOTHING;