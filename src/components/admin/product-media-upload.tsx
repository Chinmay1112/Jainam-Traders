'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import {
  Camera,
  Upload,
  Video,
  Trash2,
  Star,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Play,
  Film,
} from 'lucide-react';
import { MAX_PHOTO_COUNT } from '@/lib/media/validation';

interface ProductMediaUploadProps {
  photos: string[];
  videoUrl?: string;
  onChangePhotos: (photos: string[]) => void;
  onChangeVideo: (videoUrl?: string) => void;
  productId?: string;
}

export function ProductMediaUpload({
  photos,
  videoUrl,
  onChangePhotos,
  onChangeVideo,
  productId = 'temp_product',
}: ProductMediaUploadProps) {
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showAdvancedUrl, setShowAdvancedUrl] = useState(false);
  const [manualUrlInput, setManualUrlInput] = useState('');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // 1. Photo Upload Handler
  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage('');

    if (photos.length + files.length > MAX_PHOTO_COUNT) {
      setErrorMessage(`Maximum 4 photos allowed per product. You currently have ${photos.length}.`);
      return;
    }

    setIsUploadingPhoto(true);
    const updatedPhotos = [...photos];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Client-side quick check
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
          throw new Error(`"${file.name}" has unsupported format. Allowed: JPG, PNG, WebP.`);
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`"${file.name}" is over 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('productId', productId);
        formData.append('mediaType', 'image');
        formData.append('currentCount', String(updatedPhotos.length));
        formData.append('isPrimary', String(updatedPhotos.length === 0));

        const res = await fetch('/api/admin/media/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to upload photo');
        }

        updatedPhotos.push(data.media.url);
      }

      onChangePhotos(updatedPhotos);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error uploading photo';
      setErrorMessage(msg);
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // 2. Video Upload Handler
  const handleVideoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage('');

    if (videoUrl) {
      setErrorMessage('Maximum 1 video allowed per product. Please delete the current video before adding a new one.');
      return;
    }

    const file = files[0];
    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      setErrorMessage('Unsupported video format. Allowed formats: MP4, WebM.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage(`Video size exceeds 50 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    setIsUploadingVideo(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('productId', productId);
      formData.append('mediaType', 'video');
      formData.append('currentCount', '0');

      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload video');
      }

      onChangeVideo(data.media.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error uploading video';
      setErrorMessage(msg);
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  // Photo manipulations
  const handleDeletePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    onChangePhotos(updated);
  };

  const handleSetPrimary = (index: number) => {
    if (index === 0) return;
    const item = photos[index];
    const remaining = photos.filter((_, i) => i !== index);
    onChangePhotos([item, ...remaining]);
  };

  const handleMove = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= photos.length) return;
    const copy = [...photos];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    onChangePhotos(copy);
  };

  const handleAddManualUrl = () => {
    if (!manualUrlInput.trim()) return;
    if (photos.length >= MAX_PHOTO_COUNT) {
      setErrorMessage('Maximum 4 photos allowed per product.');
      return;
    }
    onChangePhotos([...photos, manualUrlInput.trim()]);
    setManualUrlInput('');
  };

  return (
    <div className="space-y-5 bg-stone-50/80 p-4 sm:p-5 rounded-2xl border border-stone-200">
      {/* SECTION HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
            <Camera className="w-4 h-4 text-brand-600" />
            <span>Product Media</span>
          </h4>
          <p className="text-[11px] text-stone-500">
            Upload up to 4 real photos and 1 short demonstration video
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold">
          <span
            className={`px-2 py-0.5 rounded-full ${
              photos.length >= 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {photos.length}/4 Photos {photos.length === 0 && '(At least 1 required)'}
          </span>
          {videoUrl && (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
              <Film className="w-3 h-3" /> 1 Video
            </span>
          )}
        </div>
      </div>

      {/* ERROR NOTICE */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. PHOTO MANAGEMENT */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
          <span>Product Photos (First photo is Primary Card Image)</span>
          <span className="text-[11px] text-stone-400 font-normal">Max 10 MB each • JPG, PNG, WebP</span>
        </label>

        {/* Existing Photos Thumbnails Grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className={`relative rounded-xl overflow-hidden border-2 transition-all bg-white group shadow-xs ${
                  idx === 0 ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-stone-200'
                }`}
              >
                {/* Image Preview */}
                <div className="relative h-28 w-full bg-stone-100">
                  <Image
                    src={url}
                    alt={`Product photo ${idx + 1}`}
                    fill
                    className="object-cover"
                  />
                  {idx === 0 && (
                    <div className="absolute top-1.5 left-1.5 bg-amber-500 text-stone-950 font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm uppercase tracking-wider flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-stone-950" />
                      Primary Photo
                    </div>
                  )}
                </div>

                {/* Actions Toolbar */}
                <div className="p-1.5 bg-stone-900/90 text-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(idx)}
                        className="p-1 text-stone-300 hover:text-amber-400 rounded hover:bg-stone-800"
                        title="Make Primary Image"
                      >
                        <Star className="w-3 h-3" />
                      </button>
                    )}
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMove(idx, idx - 1)}
                        className="p-1 text-stone-300 hover:text-white rounded hover:bg-stone-800"
                        title="Move Left"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                    )}
                    {idx < photos.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMove(idx, idx + 1)}
                        className="p-1 text-stone-300 hover:text-white rounded hover:bg-stone-800"
                        title="Move Right"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(idx)}
                    className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/50"
                    title="Delete Photo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Buttons Box */}
        {photos.length < MAX_PHOTO_COUNT ? (
          <div className="p-4 sm:p-5 border-2 border-dashed border-stone-300 hover:border-brand-500 bg-white rounded-2xl flex flex-col items-center justify-center text-center transition-colors">
            {isUploadingPhoto ? (
              <div className="flex flex-col items-center gap-2 text-stone-600 py-3">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                <span className="text-xs font-bold">Uploading & Optimizing Photo...</span>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-stone-800">Upload Product Photos</p>
                <p className="text-[11px] text-stone-500 mb-3">
                  Upload from your device gallery or take a direct photo with camera
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {/* File / Gallery Picker */}
                  <input
                    ref={photoInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose from Gallery</span>
                  </button>

                  {/* Direct Camera Capture (Mobile & Tablet) */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-stone-200 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Take Photo</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800 font-bold text-center">
            Maximum 4 photos reached for this product. Delete or reorder existing photos to replace.
          </div>
        )}
      </div>

      {/* 2. PRODUCT VIDEO (OPTIONAL, MAX 1) */}
      <div className="pt-3 border-t border-stone-200 space-y-3">
        <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Video className="w-4 h-4 text-blue-600" /> Product Video (Optional, Maximum 1)
          </span>
          <span className="text-[11px] text-stone-400 font-normal">Max 50 MB • MP4, WebM (≤ 30s)</span>
        </label>

        {videoUrl ? (
          <div className="relative rounded-2xl overflow-hidden border border-stone-300 bg-black max-w-sm">
            <video
              src={videoUrl}
              controls
              muted
              playsInline
              className="w-full max-h-48 object-contain"
            />
            <div className="p-2 bg-stone-900 text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                <Play className="w-3 h-3 fill-emerald-400" /> Video Uploaded
              </span>
              <button
                type="button"
                onClick={() => onChangeVideo(undefined)}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Video
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-white rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-800">Add 30-Second Product Demonstration Video</p>
                <p className="text-[10px] text-stone-500">Helps customers inspect shine, movement, and scale</p>
              </div>
            </div>

            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm"
              className="hidden"
              onChange={(e) => handleVideoUpload(e.target.files)}
            />
            <button
              type="button"
              disabled={isUploadingVideo}
              onClick={() => videoInputRef.current?.click()}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors"
            >
              {isUploadingVideo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading Video...
                </>
              ) : (
                <>
                  <Video className="w-3.5 h-3.5" /> + Add Product Video
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 3. ADVANCED / EXTERNAL MEDIA URL (PART 18: COMPATIBILITY ONLY) */}
      <div className="pt-2 border-t border-stone-200">
        <button
          type="button"
          onClick={() => setShowAdvancedUrl(!showAdvancedUrl)}
          className="text-xs text-stone-500 hover:text-stone-700 font-bold flex items-center gap-1 transition-colors"
        >
          <LinkIcon className="w-3 h-3" />
          <span>Advanced: External Media URL (Legacy fallback)</span>
          {showAdvancedUrl ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showAdvancedUrl && (
          <div className="mt-2 p-3 bg-stone-100 rounded-xl border border-stone-200 space-y-2">
            <p className="text-[11px] text-stone-500">
              Use only when managed object storage is temporarily unavailable. Normal products should use the file upload area above.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://example.com/photo.jpg"
                value={manualUrlInput}
                onChange={(e) => setManualUrlInput(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleAddManualUrl}
                className="px-3 py-1.5 bg-stone-800 text-white rounded-xl text-xs font-bold"
              >
                Add URL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
