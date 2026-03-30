import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { CAFE_PRODUCTS_MOCK } from '../src/modules/shared/data/products.mock';

type EnvMap = Record<string, string>;

function parseEnvFile(content: string): EnvMap {
  const parsed: EnvMap = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function loadEnvFromFiles(): EnvMap {
  const cwd = process.cwd();
  const envFiles = ['.env.local', '.env'];
  const loaded: EnvMap = {};

  for (const fileName of envFiles) {
    const filePath = path.join(cwd, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    Object.assign(loaded, parseEnvFile(content));
  }

  return loaded;
}

function getEnvValue(key: string, fileEnv: EnvMap): string {
  return String(process.env[key] ?? fileEnv[key] ?? '').trim();
}

function assertUniqueProductIds() {
  const ids = new Set<string>();

  for (const product of CAFE_PRODUCTS_MOCK) {
    if (ids.has(product.id)) {
      throw new Error(`Duplicate product id found in mock source: ${product.id}`);
    }

    ids.add(product.id);
  }
}

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  const fileEnv = loadEnvFromFiles();

  const supabaseUrl = getEnvValue('SUPABASE_URL', fileEnv) || getEnvValue('VITE_SUPABASE_URL', fileEnv);
  const supabaseServiceRoleKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY', fileEnv);
  const supabaseAnonKey = getEnvValue('VITE_SUPABASE_ANON_KEY', fileEnv);
  const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase env. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (recommended) or VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.',
    );
  }

  if (!supabaseServiceRoleKey) {
    console.warn(
      '[seed-products] SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to VITE_SUPABASE_ANON_KEY.',
    );
  }

  assertUniqueProductIds();

  const nowIso = new Date().toISOString();
  const rows = CAFE_PRODUCTS_MOCK.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    description: product.description,
    image: product.image,
    is_best_seller: product.is_best_seller,
    is_new: product.is_new,
    is_active: product.is_active,
    updated_at: nowIso,
  }));

  console.log(`[seed-products] Source rows: ${rows.length}`);

  if (isDryRun) {
    console.log('[seed-products] Dry run enabled. No changes were sent to Supabase.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('products')
    .upsert(rows, { onConflict: 'id' })
    .select('id');

  if (error) {
    throw new Error(`[seed-products] Upsert failed: ${error.message}`);
  }

  const upsertedCount = data?.length ?? rows.length;
  console.log(`[seed-products] Upsert complete. Rows affected: ${upsertedCount}`);
  console.log('[seed-products] Supabase products is now aligned with the shared cafe catalog source.');
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
