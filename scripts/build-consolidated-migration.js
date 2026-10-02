const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const outputFile = path.join(__dirname, '..', 'supabase', 'ALL_MIGRATIONS_RUN_ME.sql');

const migrationFiles = [
  '20260929_init_schema.sql',
  '20260929_rls_policies.sql',
  '20261002_crm_gift_codes_atomic.sql',
  '20261002_product_duplicate_prevention.sql',
  '20261002_production_order_concurrency_idempotency.sql',
  '20261002_correct_jainam_traders_shop_settings.sql',
];

const header = `-- ====================================================================
-- JAINAM TRADERS: CONSOLIDATED PRODUCTION MIGRATION SCRIPT
-- Copy all contents of this file and paste into Supabase SQL Editor
-- Generated from authoritative migrations in supabase/migrations/
-- ====================================================================

`;

let content = header;

for (const file of migrationFiles) {
  const filePath = path.join(migrationsDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing migration file: ${filePath}`);
    process.exit(1);
  }
  const fileContent = fs.readFileSync(filePath, 'utf8');
  content += `\n-- ====================================================================\n`;
  content += `-- MIGRATION: ${file}\n`;
  content += `-- ====================================================================\n\n`;
  content += fileContent.trim() + '\n';
}

fs.writeFileSync(outputFile, content, 'utf8');
console.log(`Successfully generated ${outputFile} with ${migrationFiles.length} migrations.`);
