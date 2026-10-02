/**
 * JAINAM TRADERS — MEDIA VALIDATION & SECURITY ENGINE
 * Part 8, 9, 10, 11, 13:
 * - Magic byte inspection (does not trust file extension alone)
 * - Size validation (Images <= 10MB, Videos <= 50MB)
 * - Quantity limits (Max 4 photos, Max 1 video)
 * - EXIF stripping & sanitization
 * - Safe randomized storage keys
 */

export const MAX_PHOTO_COUNT = 4;
export const MAX_VIDEO_COUNT = 1;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface MediaValidationResult {
  isValid: boolean;
  error?: string;
  detectedMime?: string;
  sanitizedBuffer?: Buffer;
}

/**
 * Validates image buffer using magic bytes and size constraints
 */
export function validateProductImage(
  buffer: Buffer,
  currentCount: number = 0
): MediaValidationResult {
  if (currentCount >= MAX_PHOTO_COUNT) {
    return {
      isValid: false,
      error: 'Maximum 4 photos allowed per product.',
    };
  }

  if (!buffer || buffer.length === 0) {
    return {
      isValid: false,
      error: 'Uploaded image file is empty.',
    };
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `Image size exceeds the maximum limit of 10 MB (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  // Magic bytes detection
  const detectedMime = detectImageMime(buffer);
  if (!detectedMime) {
    return {
      isValid: false,
      error: 'Invalid or unsupported image format. Allowed formats: JPG, JPEG, PNG, WebP.',
    };
  }

  // Strip unnecessary EXIF/metadata where applicable for privacy (Part 10)
  const sanitizedBuffer = stripExifMetadata(buffer, detectedMime);

  return {
    isValid: true,
    detectedMime,
    sanitizedBuffer,
  };
}

/**
 * Validates video buffer using magic bytes, size, and quantity constraints
 */
export function validateProductVideo(
  buffer: Buffer,
  currentCount: number = 0
): MediaValidationResult {
  if (currentCount >= MAX_VIDEO_COUNT) {
    return {
      isValid: false,
      error: 'Maximum 1 video allowed per product.',
    };
  }

  if (!buffer || buffer.length === 0) {
    return {
      isValid: false,
      error: 'Uploaded video file is empty.',
    };
  }

  if (buffer.length > MAX_VIDEO_SIZE_BYTES) {
    return {
      isValid: false,
      error: `Video size exceeds the maximum limit of 50 MB (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  // Video magic byte inspection
  const detectedMime = detectVideoMime(buffer);
  if (!detectedMime) {
    return {
      isValid: false,
      error: 'Invalid or unsupported video format. Allowed formats: MP4, WebM.',
    };
  }

  return {
    isValid: true,
    detectedMime,
    sanitizedBuffer: buffer,
  };
}

/**
 * Inspects header bytes for image signatures
 */
function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length < 3) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF .... WEBP
  if (buffer.length >= 12) {
    const isRiff = buffer.toString('ascii', 0, 4) === 'RIFF';
    const isWebp = buffer.toString('ascii', 8, 12) === 'WEBP';
    if (isRiff && isWebp) {
      return 'image/webp';
    }
  }

  return null;
}

/**
 * Inspects header bytes for video signatures
 */
function detectVideoMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // MP4: bytes 4-8 usually contain 'ftyp'
  const isFtyp = buffer.toString('ascii', 4, 8) === 'ftyp';
  if (isFtyp) {
    return 'video/mp4';
  }

  // WebM: 1A 45 DF A3 (EBML header)
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'video/webm';
  }

  return null;
}

/**
 * Strips EXIF metadata segment (APP1 / Exif) from JPEG buffers for privacy (Part 10).
 * Prevents accidental exposure of GPS coordinates, device serials, or private timestamps.
 */
export function stripExifMetadata(buffer: Buffer, mime: string = 'image/jpeg'): Buffer {
  if (mime !== 'image/jpeg' || buffer.length < 4) {
    return buffer;
  }

  try {
    let offset = 2;
    const pieces: Buffer[] = [buffer.subarray(0, 2)]; // Start of Image marker (FF D8)

    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];

      // End of image or SOS marker (start of scan data)
      if (marker === 0xda || marker === 0xd9) {
        pieces.push(buffer.subarray(offset));
        break;
      }

      const length = buffer.readUInt16BE(offset + 2);
      const nextOffset = offset + 2 + length;

      // APP1 marker (0xE1) usually contains Exif data. If found, skip it.
      if (marker === 0xe1) {
        offset = nextOffset;
        continue;
      }

      pieces.push(buffer.subarray(offset, nextOffset));
      offset = nextOffset;
    }

    return Buffer.concat(pieces);
  } catch {
    // If parsing fails gracefully, return original buffer
    return buffer;
  }
}

export function validatePhotoCount(currentCount: number, addingCount: number = 1): { isValid: boolean; error?: string } {
  if (currentCount + addingCount > MAX_PHOTO_COUNT) {
    return { isValid: false, error: `Maximum ${MAX_PHOTO_COUNT} photos allowed per product.` };
  }
  return { isValid: true };
}

export function validateVideoCount(currentCount: number, addingCount: number = 1): { isValid: boolean; error?: string } {
  if (currentCount + addingCount > MAX_VIDEO_COUNT) {
    return { isValid: false, error: `Maximum ${MAX_VIDEO_COUNT} video allowed per product.` };
  }
  return { isValid: true };
}
