import { NextRequest, NextResponse } from 'next/server';
import { enforceStaffRole } from '@/lib/auth/server-guard';
import { getProductMediaStorageProvider } from '@/lib/storage/product-media-provider';

/**
 * POST /api/admin/media/delete
 * Secured endpoint to delete product images or videos.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = enforceStaffRole(request, ['owner', 'store_manager']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    const body = await request.json();
    const { storagePath } = body;

    if (!storagePath) {
      return NextResponse.json(
        { error: 'storagePath parameter is required' },
        { status: 400 }
      );
    }

    const storageProvider = getProductMediaStorageProvider();
    const deleted = await storageProvider.deleteMedia(storagePath);

    return NextResponse.json({
      success: true,
      deleted,
      storagePath,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Media deletion failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
