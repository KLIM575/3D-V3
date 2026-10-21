import { createClient } from '@supabase/supabase-js';
import { projects as staticProjects } from '../data/projects.js';
import { services as staticServices, processSteps as staticProcessSteps } from '../data/services.js';
import { skills as staticSkills } from '../data/skills.js';
import { timeline as staticTimeline } from '../data/timeline.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && 
  !supabaseUrl.includes('your-project-ref') && 
  !supabaseAnonKey.includes('your-anon-key');

if (!isSupabaseConfigured) {
  console.warn('Supabase not configured. Using static data fallback.');
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'klimdushkin-portfolio',
    },
  },
}) : null;

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

export type Project = {
  id: string;
  number: string;
  title: string;
  category: string;
  client: string;
  year: string;
  description: string;
  content_md: string | null;
  tags: string[];
  image_url: string;
  image_path: string | null;
  featured: boolean;
  sort_order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: number;
  num: string;
  name: string;
  description: string;
  features: string[];
  icon: string | null;
  sort_order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type Skill = {
  id: number;
  name: string;
  level: string;
  pct: number;
  category: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TimelineItem = {
  id: number;
  year: string;
  title: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProcessStep = {
  id: number;
  num: string;
  title: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ContactSubmission = {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  ip_hash: string | null;
  user_agent: string | null;
  status: string;
  created_at: string;
};

function mapStaticProject(p: typeof staticProjects[0]): Project {
  return {
    id: p.id,
    number: p.number,
    title: p.title,
    category: p.category,
    client: p.client,
    year: p.year,
    description: p.description,
    content_md: p.description,
    tags: p.tags,
    image_url: p.image,
    image_path: null,
    featured: ['quantum-realm', 'neon-district', 'aurora-borealis'].includes(p.id),
    sort_order: parseInt(p.number),
    published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapStaticService(s: typeof staticServices[0]): Service {
  return {
    id: parseInt(s.num),
    num: s.num,
    name: s.name,
    description: s.desc,
    features: s.features,
    icon: null,
    sort_order: parseInt(s.num),
    published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapStaticSkill(s: typeof staticSkills[0], index: number): Skill {
  const categories: Record<string, string> = {
    'WebGL / Three.js': '3d',
    'GLSL Shaders': '3d',
    'JavaScript / TypeScript': 'frontend',
    'React / Vue': 'frontend',
    'Node.js': 'backend',
    'Blender / 3D': '3d',
    'UI/UX Design': 'design',
    'GSAP / Animation': 'frontend',
    'Figma': 'design',
    'WebGPU': '3d',
  };
  return {
    id: index + 1,
    name: s.name,
    level: s.level,
    pct: s.pct,
    category: categories[s.name] || 'other',
    sort_order: index + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapStaticTimeline(t: typeof staticTimeline[0], index: number): TimelineItem {
  return {
    id: index + 1,
    year: t.year,
    title: t.title,
    description: t.desc,
    sort_order: index + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapStaticProcessStep(s: typeof staticProcessSteps[0], index: number): ProcessStep {
  return {
    id: index + 1,
    num: s.num,
    title: s.title,
    description: s.desc,
    sort_order: index + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function fetchProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured || !supabase) {
    return staticProjects.map(mapStaticProject);
  }
  
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch projects from Supabase:', error);
    return staticProjects.map(mapStaticProject);
  }
  return data || [];
}

export async function fetchServices(): Promise<Service[]> {
  if (!isSupabaseConfigured || !supabase) {
    return staticServices.map(mapStaticService);
  }
  
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch services:', error);
    return staticServices.map(mapStaticService);
  }
  return data || [];
}

export async function fetchSkills(): Promise<Skill[]> {
  if (!isSupabaseConfigured || !supabase) {
    return staticSkills.map(mapStaticSkill);
  }
  
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch skills:', error);
    return staticSkills.map(mapStaticSkill);
  }
  return data || [];
}

export async function fetchTimeline(): Promise<TimelineItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    return staticTimeline.map(mapStaticTimeline);
  }
  
  const { data, error } = await supabase
    .from('timeline')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch timeline:', error);
    return staticTimeline.map(mapStaticTimeline);
  }
  return data || [];
}

export async function fetchProcessSteps(): Promise<ProcessStep[]> {
  if (!isSupabaseConfigured || !supabase) {
    return staticProcessSteps.map(mapStaticProcessStep);
  }
  
  const { data, error } = await supabase
    .from('process_steps')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch process steps:', error);
    return staticProcessSteps.map(mapStaticProcessStep);
  }
  return data || [];
}

export async function submitContactForm(data: {
  name: string;
  email: string;
  subject?: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured. Contact form submission simulated.');
    return { success: true };
  }
  
  const { error } = await supabase.functions.invoke('contact', {
    body: data,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
