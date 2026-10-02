import { NextRequest, NextResponse } from 'next/server';
import { getShopSettings, updateShopSettings } from '@/lib/db/store-service';
import { enforceStaffRole } from '@/lib/auth/server-guard';

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
  // Only Store Owner / Admin can modify shop settings
  const auth = enforceStaffRole(request, ['owner']);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  try {
    const body = await request.json();

    // Validate settings parameters
    if (body.latitude !== undefined && body.latitude !== null && body.latitude !== '') {
      const lat = Number(body.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return NextResponse.json({ error: 'Latitude must be a valid number between -90 and 90.' }, { status: 400 });
      }
    }

    if (body.longitude !== undefined && body.longitude !== null && body.longitude !== '') {
      const lng = Number(body.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return NextResponse.json({ error: 'Longitude must be a valid number between -180 and 180.' }, { status: 400 });
      }
    }

    const mapsUrl = body.googleMapsPlaceUrl || body.googleMapsUrl;
    if (mapsUrl && typeof mapsUrl === 'string' && mapsUrl.trim() !== '') {
      if (!mapsUrl.startsWith('https://')) {
        return NextResponse.json({ error: 'Google Maps URL must use HTTPS (start with https://).' }, { status: 400 });
      }
    }

    if (body.phone && typeof body.phone === 'string' && body.phone.trim() !== '') {
      const digits = body.phone.replace(/[\s\-\+]/g, '');
      if (!/^\d{10,15}$/.test(digits)) {
        return NextResponse.json({ error: 'Phone number format is invalid. Must contain 10-15 digits.' }, { status: 400 });
      }
    }

    if (body.whatsappNumber && typeof body.whatsappNumber === 'string' && body.whatsappNumber.trim() !== '') {
      const digits = body.whatsappNumber.replace(/[\s\-\+]/g, '');
      if (!/^\d{10,15}$/.test(digits)) {
        return NextResponse.json({ error: 'WhatsApp number format is invalid. Must contain 10-15 digits.' }, { status: 400 });
      }
    }

    if (body.email && typeof body.email === 'string' && body.email.trim() !== '') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return NextResponse.json({ error: 'Email format is invalid.' }, { status: 400 });
      }
    }

    const updated = await updateShopSettings(body, auth.session.role);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update settings';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
