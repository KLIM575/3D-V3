import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function loadDataFile(filename) {
  const filePath = path.join(__dirname, '..', 'src', 'data', filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const exportMatch = content.match(/export const \w+ = (\[[\s\S]*\]);/);
  if (!exportMatch) {
    throw new Error(`Could not parse ${filename}`);
  }
  
  return eval(`(${exportMatch[1]})`);
}

async function migrateProjects() {
  console.log('📦 Migrating projects...');
  const projects = await loadDataFile('projects.js');
  
  const { error } = await supabase
    .from('projects')
    .upsert(projects.map(p => ({
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
    })), { onConflict: 'id' });

  if (error) throw error;
  console.log(`✅ Migrated ${projects.length} projects`);
}

async function migrateServices() {
  console.log('📦 Migrating services...');
  const services = await loadDataFile('services.js');
  
  const { error } = await supabase
    .from('services')
    .upsert(services.map(s => ({
      num: s.num,
      name: s.name,
      description: s.desc,
      features: s.features,
      icon: null,
      sort_order: parseInt(s.num),
      published: true,
    })), { onConflict: 'num' });

  if (error) throw error;
  console.log(`✅ Migrated ${services.length} services`);
}

async function migrateSkills() {
  console.log('📦 Migrating skills...');
  const skills = await loadDataFile('skills.js');
  
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
  
  const { error } = await supabase
    .from('skills')
    .upsert(skills.map((s, i) => ({
      name: s.name,
      level: s.level,
      pct: s.pct,
      category: categories[s.name] || 'other',
      sort_order: i + 1,
    })), { onConflict: 'name' });

  if (error) throw error;
  console.log(`✅ Migrated ${skills.length} skills`);
}

async function migrateTimeline() {
  console.log('📦 Migrating timeline...');
  const timeline = await loadDataFile('timeline.js');
  
  const { error } = await supabase
    .from('timeline')
    .upsert(timeline.map((t, i) => ({
      year: t.year,
      title: t.title,
      description: t.desc,
      sort_order: i + 1,
    })), { onConflict: 'year,title' });

  if (error) throw error;
  console.log(`✅ Migrated ${timeline.length} timeline items`);
}

async function migrateProcessSteps() {
  console.log('📦 Migrating process steps...');
  const servicesData = await loadDataFile('services.js');
  const processSteps = servicesData.processSteps || [];
  
  const { error } = await supabase
    .from('process_steps')
    .upsert(processSteps.map((s, i) => ({
      num: s.num,
      title: s.title,
      description: s.desc,
      sort_order: i + 1,
    })), { onConflict: 'num' });

  if (error) throw error;
  console.log(`✅ Migrated ${processSteps.length} process steps`);
}

async function main() {
  console.log('🚀 Starting data migration to Supabase...\n');
  
  try {
    await migrateProjects();
    await migrateServices();
    await migrateSkills();
    await migrateTimeline();
    await migrateProcessSteps();
    
    console.log('\n🎉 All data migrated successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();