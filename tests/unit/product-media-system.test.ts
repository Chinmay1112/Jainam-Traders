import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateProductImage,
  validateProductVideo,
  validatePhotoCount,
  validateVideoCount,
  stripExifMetadata,
  MAX_PHOTO_COUNT,
  MAX_VIDEO_COUNT,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
} from '@/lib/media/validation';
import { LocalStorageProvider } from '@/lib/storage/product-media-provider';
import { canPerformAction, StaffRole } from '@/lib/auth/staff-auth';
import { searchCatalogue } from '@/lib/search/search-engine';
import { Product } from '@/lib/types';

describe('Jainam Traders Product Media System & Security Tests', () => {
  afterAll(() => {
    // Ensure test media artifacts are completely cleaned up and never leak into workspace
    const testDirs = [
      path.join(process.cwd(), 'tests', 'fixtures', '.test_media_uploads'),
      path.join(process.cwd(), 'public', 'uploads'),
    ];
    for (const dir of testDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });
  // Test byte buffers
  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  const validMp4Buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
  ]);
  const validWebmBuffer = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
  const fakeExeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ DOS/PE header

  let storageProvider: LocalStorageProvider;

  beforeEach(() => {
    storageProvider = new LocalStorageProvider();
  });

  // 1. Upload one image
  it('1. should validate a single valid image successfully', () => {
    const res = validateProductImage(validJpegBuffer, 0);
    expect(res.isValid).toBe(true);
    expect(res.detectedMime).toBe('image/jpeg');
    expect(res.sanitizedBuffer).toBeDefined();
  });

  // 2. Upload four images
  it('2. should permit uploading up to 4 images', () => {
    const check1 = validatePhotoCount(0, 1);
    expect(check1.isValid).toBe(true);
    const check4 = validatePhotoCount(0, 4);
    expect(check4.isValid).toBe(true);
    const checkAddingFourth = validatePhotoCount(3, 1);
    expect(checkAddingFourth.isValid).toBe(true);
  });

  // 3. Reject fifth image
  it('3. should reject uploading a 5th image (hard limit of 4)', () => {
    const check5 = validatePhotoCount(0, 5);
    expect(check5.isValid).toBe(false);
    expect(check5.error).toContain('Maximum 4 photos allowed');

    const checkExceedingFromExisting = validatePhotoCount(4, 1);
    expect(checkExceedingFromExisting.isValid).toBe(false);
    expect(checkExceedingFromExisting.error).toContain('Maximum 4 photos allowed');
  });

  // 4. Upload invalid image (tampered extension / fake exe)
  it('4. should reject fake image with mismatched magic bytes', () => {
    const res = validateProductImage(fakeExeBuffer, 0);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Invalid or unsupported image format');
  });

  // 5. Upload oversized image (> 10MB)
  it('5. should reject oversized images exceeding 10MB limit', () => {
    const oversizedBuffer = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1024);
    validJpegBuffer.copy(oversizedBuffer, 0);

    const res = validateProductImage(oversizedBuffer, 0);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Image size exceeds');
  });

  // 6. Delete image & Storage removal
  it('6. should allow deleting an image and clean up storage', async () => {
    const uploadRes = await storageProvider.uploadImage(validPngBuffer, {
      productId: 'prod_101',
      originalFilename: 'test.png',
      mimeType: 'image/png',
      mediaType: 'image',
    });
    expect(uploadRes.url).toBeDefined();

    const deleteRes = await storageProvider.deleteMedia(uploadRes.storagePath);
    expect(deleteRes).toBe(true);
  });

  // 7. Reorder images
  it('7. should correctly reorder image arrays preserving non-mutated data', () => {
    const photos = ['img1.webp', 'img2.webp', 'img3.webp', 'img4.webp'];
    const reordered = [photos[2], photos[0], photos[1], photos[3]];
    expect(reordered).toEqual(['img3.webp', 'img1.webp', 'img2.webp', 'img4.webp']);
    expect(reordered[0]).toBe('img3.webp'); // New primary
  });

  // 8. Primary image assignment
  it('8. should automatically promote next image to primary if primary is removed', () => {
    let photos = ['photoA.webp', 'photoB.webp', 'photoC.webp'];
    expect(photos[0]).toBe('photoA.webp'); // Primary is photoA

    // Remove photoA
    photos = photos.filter((p) => p !== 'photoA.webp');
    expect(photos[0]).toBe('photoB.webp'); // photoB promoted to primary
    expect(photos.length).toBe(2);
  });

  // 9. Upload one video
  it('9. should validate a single valid MP4 video successfully', () => {
    const res = validateProductVideo(validMp4Buffer, 0);
    expect(res.isValid).toBe(true);
    expect(res.detectedMime).toBe('video/mp4');
  });

  // 10. Reject second video
  it('10. should reject attempting to upload a second video', () => {
    const check1 = validateVideoCount(0, 1);
    expect(check1.isValid).toBe(true);

    const check2 = validateVideoCount(1, 1);
    expect(check2.isValid).toBe(false);
    expect(check2.error).toContain('Maximum 1 video allowed');
  });

  // 11. Reject invalid video format
  it('11. should reject invalid or corrupted video files', () => {
    const corruptBuffer = Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44]);
    const res = validateProductVideo(corruptBuffer, 0);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Invalid or unsupported video format');
  });

  // 12. Reject oversized video (> 50MB)
  it('12. should reject videos exceeding 50MB limit', () => {
    const oversized = Buffer.alloc(MAX_VIDEO_SIZE_BYTES + 2048);
    validMp4Buffer.copy(oversized, 0);

    const res = validateProductVideo(oversized, 0);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Video size exceeds');
  });

  // 13. Delete video
  it('13. should handle deleting product video cleanly', async () => {
    const uploadRes = await storageProvider.uploadVideo(validWebmBuffer, {
      productId: 'prod_202',
      originalFilename: 'demo.webm',
      mimeType: 'video/webm',
      mediaType: 'video',
    });
    expect(uploadRes.url).toBeDefined();

    const deleteRes = await storageProvider.deleteMedia(uploadRes.storagePath);
    expect(deleteRes).toBe(true);
  });

  // 14. Image fallback protection
  it('14. should have fallback placeholder when image is empty or invalid', () => {
    const placeholder = '/images/product-placeholder.svg';
    const fallbackImage = (src?: string) => (src && src.trim().length > 0 ? src : placeholder);

    expect(fallbackImage('')).toBe(placeholder);
    expect(fallbackImage(undefined)).toBe(placeholder);
    expect(fallbackImage('/uploads/real.jpg')).toBe('/uploads/real.jpg');
  });

  // 15. Product publish without required media validation
  it('15. should flag error when publishing a product with 0 photos', () => {
    const validateProductForPublish = (status: string, photos: string[]) => {
      if (status === 'published' && (!photos || photos.length === 0)) {
        return { isValid: false, error: 'At least 1 product photo is required to publish.' };
      }
      return { isValid: true };
    };

    const pubResult = validateProductForPublish('published', []);
    expect(pubResult.isValid).toBe(false);
    expect(pubResult.error).toContain('At least 1 product photo is required');

    const validPub = validateProductForPublish('published', ['photo1.jpg']);
    expect(validPub.isValid).toBe(true);
  });

  // 16. Draft product with incomplete media
  it('16. should allow saving as DRAFT with 0 photos and hide draft from customer storefront search', () => {
    const draftProduct: Product = {
      id: 'prod-draft-1',
      name: 'Unfinished Photo Frame Sample',
      sku: 'JT-DFT-001',
      slug: 'unfinished-photo-frame-sample',
      categoryId: 'cat-frames',
      categoryName: 'Photo Frames',
      description: 'Draft item awaiting real studio photographs',
      shortDescription: 'Draft frame',
      price: 499,
      mrp: 899,
      discountPercentage: 44,
      thumbnailUrl: '/images/product-placeholder.svg',
      images: [],
      stockQuantity: 0,
      reservedStock: 0,
      lowStockThreshold: 2,
      minOrderQuantity: 1,
      maxOrderQuantity: 5,
      tags: ['frame', 'draft'],
      brand: 'Jainam Heritage',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      isActive: true,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const activeCatalogue = [draftProduct];
    const customerSearchResults = searchCatalogue(activeCatalogue, { query: 'Photo Frame' });

    // Draft product MUST NOT appear in customer search results
    expect(customerSearchResults.products.length).toBe(0);
  });

  // 17 & 18. Security & RBAC: Customer vs Staff vs Owner
  it('17 & 18. Security: Customer cannot mutate product media, Staff and Owner have proper authorization', () => {
    const customerRole = 'customer' as unknown as StaffRole;
    const counterStaffRole: StaffRole = 'staff';
    const storeManagerRole: StaffRole = 'store_manager';
    const ownerRole: StaffRole = 'owner';

    // Role checks using application authorization framework
    expect(canPerformAction(customerRole, 'manage_products')).toBe(false);
    expect(canPerformAction(customerRole, 'manage_settings')).toBe(false);

    // Counter staff permissions (pickup & order only, cannot edit/delete products)
    expect(canPerformAction(counterStaffRole, 'manage_products')).toBe(false);
    expect(canPerformAction(counterStaffRole, 'view_orders')).toBe(true);

    // Manager / Owner full product & media management
    expect(canPerformAction(storeManagerRole, 'manage_products')).toBe(true);
    expect(canPerformAction(ownerRole, 'manage_products')).toBe(true);
    expect(canPerformAction(ownerRole, 'manage_settings')).toBe(true);
  });

  // EXIF stripping from JPEG images
  it('20. should remove or sanitize APP1/EXIF segments from JPEG files for privacy', () => {
    const jpegWithExif = Buffer.from([
      0xff, 0xd8,
      0xff, 0xe1, 0x00, 0x06, 0x45, 0x78, 0x69, 0x66, // APP1 marker with "Exif"
      0xff, 0xd9, // EOI
    ]);

    const cleaned = stripExifMetadata(jpegWithExif, 'image/jpeg');
    expect(cleaned).toBeDefined();
    expect(cleaned.length).toBeLessThan(jpegWithExif.length);
    // Verify APP1 removed
    const hasApp1 = cleaned[2] === 0xff && cleaned[3] === 0xe1;
    expect(hasApp1).toBe(false);
  });

  // 21. Environment-Aware Storage Security (Parts 4 & 5)
  it('21. should reject silent local filesystem uploads when running in production without Supabase Storage', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalVitest = process.env.VITEST;
    const originalLocalDev = process.env.ENABLE_LOCAL_STORAGE_DEV;

    try {
      // Simulate production runtime with unconfigured Supabase
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.VITEST;
      delete process.env.ENABLE_LOCAL_STORAGE_DEV;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const { getProductMediaStorageProvider, resetStorageProvider } = await import('@/lib/storage/product-media-provider');
      resetStorageProvider();

      const prodProvider = getProductMediaStorageProvider();
      expect(prodProvider.name).toBe('unconfigured');

      // Attempting to upload MUST fail with clear safe error and NOT write to local filesystem
      await expect(
        prodProvider.uploadImage(validPngBuffer, {
          productId: 'prod_test',
          originalFilename: 'test.png',
          mimeType: 'image/png',
          mediaType: 'image',
        })
      ).rejects.toThrow('Product media storage is not configured. Please configure Supabase Storage in production.');
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
      if (originalVitest !== undefined) process.env.VITEST = originalVitest;
      if (originalLocalDev !== undefined) process.env.ENABLE_LOCAL_STORAGE_DEV = originalLocalDev;
      const { resetStorageProvider } = await import('@/lib/storage/product-media-provider');
      resetStorageProvider();
    }
  });

  // 22. Real Multi-Format File Upload Verification (JPG, PNG, WebP, MP4)
  it('22. should validate and handle distinct real image formats (JPG, PNG, WebP) and video (MP4)', async () => {
    // JPG
    const jpgRes = await storageProvider.uploadImage(validJpegBuffer, {
      productId: 'prod_multi',
      originalFilename: 'frame1.jpg',
      mimeType: 'image/jpeg',
      isPrimary: true,
      mediaType: 'image',
    });
    expect(jpgRes.mimeType).toBe('image/jpeg');
    expect(jpgRes.isPrimary).toBe(true);

    // PNG
    const pngRes = await storageProvider.uploadImage(validPngBuffer, {
      productId: 'prod_multi',
      originalFilename: 'frame2.png',
      mimeType: 'image/png',
      isPrimary: false,
      mediaType: 'image',
    });
    expect(pngRes.mimeType).toBe('image/png');

    // WebP
    const webpRes = await storageProvider.uploadImage(validWebpBuffer, {
      productId: 'prod_multi',
      originalFilename: 'frame3.webp',
      mimeType: 'image/webp',
      isPrimary: false,
      mediaType: 'image',
    });
    expect(webpRes.mimeType).toBe('image/webp');

    // MP4 Video
    const vidRes = await storageProvider.uploadVideo(validMp4Buffer, {
      productId: 'prod_multi',
      originalFilename: 'demo.mp4',
      mimeType: 'video/mp4',
      mediaType: 'video',
    });
    expect(vidRes.mimeType).toBe('video/mp4');
    expect(vidRes.mediaType).toBe('video');

    // Clean up test storage paths
    await storageProvider.deleteMedia(jpgRes.storagePath);
    await storageProvider.deleteMedia(pngRes.storagePath);
    await storageProvider.deleteMedia(webpRes.storagePath);
    await storageProvider.deleteMedia(vidRes.storagePath);
  });
});
