import { NextResponse } from 'next/server';
import { STAFF_COOKIE_NAME } from '@/lib/auth/server-guard';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete(STAFF_COOKIE_NAME);
  return response;
}
