import { NextRequest, NextResponse } from 'next/server';
import { enforceStaffRole } from '@/lib/auth/server-guard';
import { validateProductImage, validateProductVideo } from '@/lib/media/validation';
import { getProductMediaStorageProvider } from '@/lib/storage/product-media-provider';

/**
 * POST /api/admin/media/upload
 * Secured endpoint for staff, store_manager, and owner to upload product photos and videos.
 * Enforces magic byte verification, file size limits, and max quantity constraints.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. RBAC Guard: Only owner or store_manager allowed to upload product media
    const auth = enforceStaffRole(request, ['owner', 'store_manager']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    // 2. Parse Multipart Form Data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const productId = (formData.get('productId') as string) || `prod_${Date.now()}`;
    const mediaType = (formData.get('mediaType') as string) === 'video' ? 'video' : 'image';
    const currentCount = parseInt((formData.get('currentCount') as string) || '0', 10);
    const isPrimary = formData.get('isPrimary') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided in upload payload' },
        { status: 400 }
      );
    }

    // 3. Convert Web File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Validate via Media Security Engine
    const storageProvider = getProductMediaStorageProvider();

    if (mediaType === 'video') {
      const validation = validateProductVideo(buffer, currentCount);
      if (!validation.isValid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }

      const stored = await storageProvider.uploadVideo(validation.sanitizedBuffer || buffer, {
        productId,
        originalFilename: file.name,
        mimeType: validation.detectedMime || file.type,
        mediaType: 'video',
      });

      return NextResponse.json({
        success: true,
        media: stored,
      });
    }

    // Image upload validation
    const validation = validateProductImage(buffer, currentCount);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const stored = await storageProvider.uploadImage(validation.sanitizedBuffer || buffer, {
      productId,
      originalFilename: file.name,
      mimeType: validation.detectedMime || file.type,
      isPrimary,
      mediaType: 'image',
    });

    return NextResponse.json({
      success: true,
      media: stored,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Media upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
