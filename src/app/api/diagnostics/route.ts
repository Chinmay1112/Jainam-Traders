import { NextResponse } from 'next/server';
import { checkDatabaseConnection } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const check = await checkDatabaseConnection();

  const report = {
    'SUPABASE URL configured': check.supabaseUrlConfigured ? 'YES' : 'NO',
    'SERVICE ROLE configured': check.serviceRoleConfigured ? 'YES' : 'NO',
    'DATABASE connection': check.databaseConnected ? 'PASS' : 'FAIL',
    'Product write': check.productWrite,
    'Product read': check.productRead,
    'STORAGE connection': check.storageConnected ? 'PASS' : 'FAIL',
    'AUTH connection': check.authConnected ? 'PASS' : 'FAIL',
    'EMAIL configured': check.emailConfigured ? 'YES' : 'NO',
    'CRON ready': check.cronReady ? 'YES' : 'NO',
    'VERSION': check.version,
    'LAST HEALTH CHECK': check.lastCheckedAt,
    backupStatus: check.backupStatus,
    details: check.error ? { error: check.error } : undefined,
  };

  return NextResponse.json(report, {
    status: check.databaseConnected ? 200 : 503,
  });
}
