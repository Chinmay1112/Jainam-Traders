import { NextRequest, NextResponse } from 'next/server';
import { getShopSettings, updateShopSettings } from '@/lib/db/store-service';

export async function GET() {
  try {
    const settings = await getShopSettings();
    return NextResponse.json(settings);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const updated = await updateShopSettings(body, 'admin');
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update settings';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
