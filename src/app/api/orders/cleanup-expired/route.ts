import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredReservations } from '@/lib/db/store-service';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';

export async function POST(request: NextRequest) {
  try {
    // 1. Authorize: check either cron secret or staff session
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const staffSession = getAuthenticatedStaffFromRequest(request);

    if (!isCronAuthorized && !staffSession) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Unauthorized: Valid Cron Secret or Staff authorization required' },
          { status: 401 }
        );
      }
    }

    const actorId = staffSession?.email || (isCronAuthorized ? 'cron_scheduler' : 'manual_trigger');
    const result = await cleanupExpiredReservations(actorId);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      expiredCount: result.expiredCount,
      expiredOrderNumbers: result.expiredOrderNumbers,
      message: `Processed reservation cleanup: ${result.expiredCount} order(s) expired and stock restored.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to clean up expired reservations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Support GET for scheduled cron triggers (e.g. Vercel Cron or GitHub Actions ping)
export async function GET(request: NextRequest) {
  return POST(request);
}
