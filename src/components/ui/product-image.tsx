'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Package, Gift } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  categoryName?: string;
}

export default function ProductImage({
  src,
  alt,
  fill = false,
  width,
  height,
  className = '',
  sizes,
  priority = false,
  categoryName,
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if src is valid string
  const isValidSrc = typeof src === 'string' && src.trim().length > 0 && !hasError;

  if (!isValidSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-stone-100 text-stone-400 select-none p-2 ${className} ${
          fill ? 'w-full h-full absolute inset-0' : ''
        }`}
        style={!fill && width && height ? { width, height } : undefined}
      >
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-brand-700 flex items-center justify-center mb-1">
          <Gift className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-bold text-stone-700 text-center line-clamp-1 max-w-[90%]">
          {categoryName || 'Jainam Traders'}
        </span>
        <span className="text-[8px] text-stone-400 uppercase tracking-widest">Quality Assured</span>
      </div>
    );
  }

  // Use Next.js Image if fill or width/height provided, else standard img
  if (fill) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        <Image
          src={src}
          alt={alt || 'Jainam Traders Product'}
          fill
          sizes={sizes || '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'}
          priority={priority}
          className={`${className} ${isLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} transition-all duration-200`}
          onLoad={() => setIsLoading(false)}
          onError={() => setHasError(true)}
        />
        {isLoading && (
          <div className="absolute inset-0 bg-stone-100 animate-pulse flex items-center justify-center">
            <Package className="w-5 h-5 text-stone-300 animate-bounce" />
          </div>
        )}
      </div>
    );
  }

  if (width && height) {
    return (
      <div className="relative overflow-hidden inline-block" style={{ width, height }}>
        <Image
          src={src}
          alt={alt || 'Jainam Traders Product'}
          width={width}
          height={height}
          priority={priority}
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
          onLoad={() => setIsLoading(false)}
          onError={() => setHasError(true)}
        />
        {isLoading && (
          <div className="absolute inset-0 bg-stone-100 animate-pulse flex items-center justify-center">
            <Package className="w-4 h-4 text-stone-300" />
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'Jainam Traders Product'}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
