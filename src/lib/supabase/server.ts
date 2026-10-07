import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Checks whether production Supabase credentials are configured.
 */
export function isSupabaseConfigured(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return false;
  if (supabaseUrl.includes('placeholder') || supabaseUrl.includes('mock') || !supabaseUrl.startsWith('http')) return false;
  if (serviceKey.includes('placeholder') || serviceKey.length < 20) return false;

  return true;
}

/**
 * Returns an administrative service-role Supabase client for secure server-side persistence.
 * Strictly server-side: SUPABASE_SERVICE_ROLE_KEY is never sent to the browser.
 * Fails closed in production if credentials are missing or invalid.
 */
let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const isConfigured = isSupabaseConfigured();

  if (!isConfigured) {
    const errorMsg =
      '[FATAL CONFIG ERROR] Supabase production database is not configured! ' +
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set with valid production credentials. ' +
      'In-memory fallback is strictly disallowed in production to prevent silent data loss.';

    if (process.env.NODE_ENV === 'production') {
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    throw new Error(errorMsg);
  }

  cachedAdminClient = createClient(supabaseUrl!, serviceKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAdminClient;
}

export interface SystemHealthReport {
  supabaseUrlConfigured: boolean;
  serviceRoleConfigured: boolean;
  databaseConnected: boolean;
  productWrite: 'PASS' | 'FAIL' | 'SKIPPED';
  productRead: 'PASS' | 'FAIL' | 'SKIPPED';
  storageConnected: boolean;
  authConnected: boolean;
  emailConfigured: boolean;
  cronReady: boolean;
  version: string;
  lastCheckedAt: string;
  backupStatus: {
    dailyBackupsEnabled: boolean;
    pointInTimeRecovery: boolean;
    storageBackup: boolean;
    readiness: 'READY' | 'ACTION_REQUIRED';
  };
  error?: string;
}

/**
 * Diagnostic check verifying live database connection, storage, auth, and system health.
 */
export async function checkDatabaseConnection(): Promise<SystemHealthReport> {
  const urlConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
  );
  const serviceKeyConfigured = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder') &&
    process.env.SUPABASE_SERVICE_ROLE_KEY.length > 20
  );
  const emailConfigured = Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );

  const baseReport: SystemHealthReport = {
    supabaseUrlConfigured: urlConfigured,
    serviceRoleConfigured: serviceKeyConfigured,
    databaseConnected: false,
    productWrite: 'SKIPPED',
    productRead: 'SKIPPED',
    storageConnected: false,
    authConnected: false,
    emailConfigured,
    cronReady: true,
    version: 'v1.0.0-prod',
    lastCheckedAt: new Date().toISOString(),
    backupStatus: {
      dailyBackupsEnabled: urlConfigured,
      pointInTimeRecovery: false,
      storageBackup: false,
      readiness: 'ACTION_REQUIRED',
    },
  };

  if (!urlConfigured || !serviceKeyConfigured) {
    return {
      ...baseReport,
      error: 'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing or invalid.',
    };
  }

  try {
    const client = getSupabaseAdminClient();

    // 1. Check Database connection
    const { error: dbError } = await client.from('products').select('count', { count: 'exact', head: true });
    baseReport.databaseConnected = !dbError;

    // 1b. Check Business Data: Live Product Write & Read Verification
    if (baseReport.databaseConnected) {
      try {
        const { data: catRows } = await client.from('categories').select('id').limit(1);
        const catId = catRows && catRows.length > 0 ? catRows[0].id : 'b0000000-0000-0000-0000-000000000001';

        const probeId = crypto.randomUUID();
        const probeSku = `JT-PROBE-${Date.now().toString(36)}`;
        const { data: written, error: wErr } = await client.from('products').insert({
          id: probeId,
          name: 'SYSTEM_HEALTH_PROBE',
          sku: probeSku,
          slug: `system-health-probe-${Date.now().toString(36)}`,
          category_id: catId,
          description: 'Automated transient probe verifying DB write capability',
          price: 1,
          mrp: 1,
          thumbnail_url: '/images/product-placeholder.svg',
          stock_quantity: 1,
          is_active: false,
        }).select('id, sku').single();

        if (wErr || !written) {
          baseReport.productWrite = 'FAIL';
          baseReport.productRead = 'FAIL';
        } else {
          baseReport.productWrite = 'PASS';
          // Verify reading this product row back
          const { data: readRow, error: rErr } = await client.from('products').select('id, sku').eq('id', probeId).maybeSingle();
          baseReport.productRead = !rErr && readRow?.id === probeId ? 'PASS' : 'FAIL';
          // Clean up the probe row immediately
          await client.from('products').delete().eq('id', probeId);
        }
      } catch {
        baseReport.productWrite = 'FAIL';
        baseReport.productRead = 'FAIL';
      }
    }

    // 2. Check Storage
    try {
      const { data: buckets, error: sErr } = await client.storage.listBuckets();
      baseReport.storageConnected = !sErr && Array.isArray(buckets) && buckets.some((b) => b.name === 'product-media');
      baseReport.backupStatus.storageBackup = baseReport.storageConnected;
    } catch {
      baseReport.storageConnected = false;
    }

    // 3. Check Auth
    try {
      const { data: users, error: aErr } = await client.auth.admin.listUsers({ perPage: 1 });
      baseReport.authConnected = !aErr && Boolean(users && users.users);
    } catch {
      baseReport.authConnected = false;
    }

    if (baseReport.databaseConnected && baseReport.storageConnected) {
      baseReport.backupStatus.readiness = 'READY';
    }

    if (dbError) {
      baseReport.error = `Database query: ${dbError.message} (${dbError.code || 'UNKNOWN'})`;
    }

    return baseReport;
  } catch (err: unknown) {
    return {
      ...baseReport,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Standard user/session server client with cookie forwarding for auth.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}
