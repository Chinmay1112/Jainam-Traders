// ==============================================================================
// JAINAM TRADERS — SEARCH ANALYTICS API (ADMIN)
// Returns anonymous aggregate search metrics: total searches, popular queries,
// and zero-result searches to help store staff optimize catalogue discovery.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enforceStaffRole } from '@/lib/auth/server-guard';
import { searchAnalytics } from '@/lib/search/search-analytics';

export async function GET(request: NextRequest) {
  const auth = enforceStaffRole(request, ['owner', 'store_manager', 'staff']);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const summary = searchAnalytics.getSummary();
  return NextResponse.json({
    success: true,
    ...summary,
  });
}
