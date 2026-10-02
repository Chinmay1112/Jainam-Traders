/**
 * JAINAM TRADERS — PRODUCT MEDIA STORAGE ABSTRACTION LAYER
 * Part 16 & 17: Storage architecture with pluggable providers.
 * Decouples catalogue/product engine from specific storage backends.
 * Supported:
 * - SupabaseStorageProvider (Default for production when Supabase is configured)
 * - LocalStorageProvider (Development & offline fallback, saves to public/uploads/products)
 * - GoogleDriveStorageProvider (Future implementation contract for Google Drive)
 */

import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

export interface StoredMediaResult {
  url: string;
  storagePath: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  mediaType: 'image' | 'video';
  isPrimary?: boolean;
}

export interface UploadMediaOptions {
  productId: string;
  originalFilename: string;
  mimeType: string;
  isPrimary?: boolean;
  mediaType: 'image' | 'video';
}

export interface ProductMediaStorageProvider {
  name: string;
  uploadImage(fileBuffer: Buffer, options: UploadMediaOptions): Promise<StoredMediaResult>;
  uploadVideo(fileBuffer: Buffer, options: UploadMediaOptions): Promise<StoredMediaResult>;
  deleteMedia(storagePath: string): Promise<boolean>;
  getPublicUrl(storagePath: string): string;
  replaceMedia(oldStoragePath: string, fileBuffer: Buffer, options: UploadMediaOptions): Promise<StoredMediaResult>;
}

// ==============================================================================
// 1. SUPABASE STORAGE PROVIDER (PRODUCTION DEFAULT)
// Bucket: product-media
// Path: product/{productId}/images/{filename} or product/{productId}/video/{filename}
// ==============================================================================
export class SupabaseStorageProvider implements ProductMediaStorageProvider {
  public readonly name = 'supabase';
  private bucketName = 'product-media';

  private getClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !key || url.includes('placeholder') || url.includes('mock')) {
      return null;
    }
    return createClient(url, key);
  }

  public async uploadImage(fileBuffer: Buffer, options: UploadMediaOptions): Promise<StoredMediaResult> {
    return this.uploadFile(fileBuffer, { ...options, mediaType: 'image' });
  }

  public async uploadVideo(fileBuffer: Buffer, options: UploadMediaOptions): Promise<StoredMediaResult> {
    return this.uploadFile(fileBuffer, { ...options, mediaType: 'video' });
  }

  private async uploadFile(fileBuffer: Buffer, options: UploadMediaOptions): Promise<StoredMediaResult> {
    const client = this.getClient();
    const safeExt = getSafeExtension(options.originalFilename, options.mimeType);
    const uniqueId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const subfolder = options.mediaType === 'video' ? 'video' : 'images';
    const storagePath = `product/${options.productId}/${subfolder}/${uniqueId}.${safeExt}`;

    if (!client) {
      const isProduction = process.env.NODE_ENV === 'production';
      const allowLocalDev = (!isProduction && process.env.ENABLE_LOCAL_STORAGE_DEV === 'true') || process.env.VITEST === 'true';
      if (allowLocalDev) {
        const localProvider = new LocalStorageProvider();
        return options.mediaType === 'video'
          ? localProvider.uploadVideo(fileBuffer, options)
          : localProvider.uploadImage(fileBuffer, options);
      }
      throw new Error('Product media storage is not configured. Please configure Supabase Storage.');
    }

    const { error } = await client.storage
      .from(this.bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: options.mimeType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    const { data: publicUrlData } = client.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);

    return {
      url: publicUrlData.publicUrl,
      storagePath,
      filename: `${uniqueId}.${safeExt}`,
      sizeBytes: fileBuffer.length,
      mimeType: options.mimeType,
      mediaType: options.mediaType,
      isPrimary: options.isPrimary ?? false,
    };
  }

  public async deleteMedia(storagePath: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      const localProvider = new LocalStorageProvider();
      return localProvider.deleteMedia(storagePath);
    }

    const { error } = await client.storage.from(this.bucketName).remove([storagePath]);
    return !error;
  }

  public getPublicUrl(storagePath: string): string {
    const client = this.getClient();
    if (!client) {
      return `/uploads/${storagePath}`;
    }
    const { data } = client.storage.from(this.bucketName).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  public async replaceMedia(oldStoragePath: string, fileBuffer: Buffer, options: UploadMediaOptions): Promise<StoredMediaResult> {
    if (oldStoragePath) {
      await this.deleteMedia(oldStoragePath).catch(() => {});
    }
    return options.mediaType === 'video'
      ? this.uploadVideo(fileBuffer, options)
      : this.uploadImage(fileBuffer, options);
  }
}

// ==============================================================================
// 2. LOCAL FILE SYSTEM STORAGE PROVIDER (DEVELOPMENT & OFFLINE RESILIENT)
// Stores files under public/uploads/product/{productId}/
// ==============================================================================
export class LocalStorageProvider implements ProductMediaStorageProvider {
  public readonly name = 'local';
  private uploadsBaseDir: string;

  constructor(customBaseDir?: string) {
    if (customBaseDir) {
      this.uploadsBaseDir = customBaseDir;
    } else if (process.env.VITEST === 'true') {
      this.uploadsBaseDir = path.join(process.cwd(), 'tests', 'fixtures', '.test_media_uploads');
    } else {
      this.uploadsBaseDir = path.join(process.cwd(), 'public', 'uploads');
    }
  }

  public async uploadImage(fileBuffer: Buffer, options: UploadMediaOptions): Promise<StoredMediaResult> {
    return this.uploadFile(fileBuffer, { ...options, mediaType: 'image' });
  }

  public async uploadVideo(fileBuffer: Buffer, options: UploadMediaOptions): Promise<StoredMediaResult> {
    return this.uploadFile(fileBuffer, { ...options, mediaType: 'video' });
  }

  private async uploadFile(fileBuffer: Buffer, options: UploadMediaOptions): Promise<StoredMediaResult> {
    const safeExt = getSafeExtension(options.originalFilename, options.mimeType);
    const uniqueId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const subfolder = options.mediaType === 'video' ? 'video' : 'images';
    const relativeDir = path.join('product', options.productId, subfolder);
    const targetDir = path.join(this.uploadsBaseDir, relativeDir);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `${uniqueId}.${safeExt}`;
    const targetPath = path.join(targetDir, filename);
    fs.writeFileSync(targetPath, fileBuffer);

    const relativeStoragePath = `product/${options.productId}/${subfolder}/${filename}`.replace(/\\/g, '/');
    const publicUrl = `/uploads/${relativeStoragePath}`;

    return {
      url: publicUrl,
      storagePath: relativeStoragePath,
      filename,
      sizeBytes: fileBuffer.length,
      mimeType: options.mimeType,
      mediaType: options.mediaType,
      isPrimary: options.isPrimary ?? false,
    };
  }

  public async deleteMedia(storagePath: string): Promise<boolean> {
    try {
      const cleanPath = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = path.join(this.uploadsBaseDir, cleanPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
    } catch {
      // Ignored for graceful deletion
    }
    return false;
  }

  public getPublicUrl(storagePath: string): string {
    return `/uploads/${storagePath.replace(/\\/g, '/')}`;
  }

  public async replaceMedia(oldStoragePath: string, fileBuffer: Buffer, options: UploadMediaOptions): Promise<StoredMediaResult> {
    if (oldStoragePath) {
      await this.deleteMedia(oldStoragePath);
    }
    return options.mediaType === 'video'
      ? this.uploadVideo(fileBuffer, options)
      : this.uploadImage(fileBuffer, options);
  }
}

// ==============================================================================
// 3. GOOGLE DRIVE STORAGE PROVIDER (FUTURE ARCHITECTURE CONTRACT)
// Part 17: Ready for future activation without altering catalogue/product code
// ==============================================================================
export class GoogleDriveStorageProvider implements ProductMediaStorageProvider {
  public readonly name = 'google_drive';

  public async uploadImage(): Promise<StoredMediaResult> {
    throw new Error('Google Drive Storage Provider is reserved for future enterprise deployment. Use Supabase or Managed Storage.');
  }

  public async uploadVideo(): Promise<StoredMediaResult> {
    throw new Error('Google Drive Storage Provider is reserved for future enterprise deployment. Use Supabase or Managed Storage.');
  }

  public async deleteMedia(): Promise<boolean> {
    return false;
  }

  public getPublicUrl(storagePath: string): string {
    return `https://drive.google.com/uc?export=view&id=${storagePath}`;
  }

  public async replaceMedia(): Promise<StoredMediaResult> {
    throw new Error('Google Drive Storage Provider is reserved for future enterprise deployment.');
  }
}

// ==============================================================================
// 4. UNCONFIGURED STORAGE PROVIDER (PRODUCTION SAFE GUARD)
// Strictly prevents silent local uploads in production when Supabase is not configured
// ==============================================================================
export class UnconfiguredStorageProvider implements ProductMediaStorageProvider {
  public readonly name = 'unconfigured';

  public async uploadImage(): Promise<StoredMediaResult> {
    throw new Error('Product media storage is not configured. Please configure Supabase Storage in production.');
  }

  public async uploadVideo(): Promise<StoredMediaResult> {
    throw new Error('Product media storage is not configured. Please configure Supabase Storage in production.');
  }

  public async deleteMedia(): Promise<boolean> {
    return false;
  }

  public getPublicUrl(): string {
    return '/images/product-placeholder.svg';
  }

  public async replaceMedia(): Promise<StoredMediaResult> {
    throw new Error('Product media storage is not configured. Please configure Supabase Storage in production.');
  }
}

// ==============================================================================
// FACTORY & PROVIDER REGISTRY
// ==============================================================================
let activeProvider: ProductMediaStorageProvider | null = null;

export function getProductMediaStorageProvider(): ProductMediaStorageProvider {
  if (activeProvider) return activeProvider;

  const configuredProvider = process.env.STORAGE_PROVIDER?.toLowerCase();

  if (configuredProvider === 'google_drive') {
    activeProvider = new GoogleDriveStorageProvider();
    return activeProvider;
  }

  // If Supabase keys are configured, use SupabaseStorageProvider
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const isRealSupabase =
    supabaseUrl.length > 0 &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseUrl.includes('mock');

  if (isRealSupabase || configuredProvider === 'supabase') {
    activeProvider = new SupabaseStorageProvider();
    return activeProvider;
  }

  // Only allow LocalStorageProvider if running in non-production AND explicitly enabled, or in vitest
  const isProduction = process.env.NODE_ENV === 'production';
  const allowLocalDev =
    (!isProduction && process.env.ENABLE_LOCAL_STORAGE_DEV === 'true') ||
    process.env.VITEST === 'true';

  if (allowLocalDev) {
    activeProvider = new LocalStorageProvider();
    return activeProvider;
  }

  // In production without Supabase Storage configured, strictly block uploads to prevent silent local writes
  activeProvider = new UnconfiguredStorageProvider();
  return activeProvider;
}

export function setCustomStorageProvider(provider: ProductMediaStorageProvider): void {
  activeProvider = provider;
}

export function resetStorageProvider(): void {
  activeProvider = null;
}

function getSafeExtension(originalFilename: string, mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };

  if (mimeMap[mimeType]) {
    return mimeMap[mimeType];
  }

  const ext = path.extname(originalFilename).toLowerCase().replace('.', '');
  if (['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm'].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  return 'bin';
}
