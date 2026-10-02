import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const adminClient = createClient(supabaseUrl, serviceKey);
const anonClient = createClient(supabaseUrl, anonKey);

async function run() {
  console.log('--- 1. Testing Storage Bucket ---');
  const { data: buckets, error: listErr } = await adminClient.storage.listBuckets();
  if (listErr) {
    console.error('List buckets error:', listErr);
  } else {
    console.log('Current buckets:', buckets.map(b => b.name));
    const exists = buckets.some(b => b.name === 'product-media');
    if (!exists) {
      console.log('Creating "product-media" bucket...');
      const { data: created, error: createErr } = await adminClient.storage.createBucket('product-media', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
      });
      if (createErr) {
        console.error('Bucket create error:', createErr);
      } else {
        console.log('Bucket "product-media" created successfully:', created);
      }
    } else {
      console.log('Bucket "product-media" already exists!');
    }
  }

  console.log('\n--- 2. Testing Customer Auth Signup/Login ---');
  // Check auth admin API
  const { data: users, error: userErr } = await adminClient.auth.admin.listUsers();
  if (userErr) {
    console.error('Auth admin listUsers error:', userErr);
  } else {
    console.log(`Live Supabase Auth is ACTIVE! Total users: ${users.users.length}`);
    users.users.forEach(u => console.log(` - User: ${u.email} (id: ${u.id})`));
  }
}

run().catch(console.error);
