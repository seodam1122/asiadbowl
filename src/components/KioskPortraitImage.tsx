'use client';

import React, { useState, useCallback } from 'react';

interface KioskPortraitImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * 세로 키오스크 배경: 세로형 이미지는 화면 꽉 채움(cover),
 * 가로형 이미지는 가로 잘림 없이 맞춤(contain, 상하만 여백).
 */
export default function KioskPortraitImage({ src, alt, className = '' }: KioskPortraitImageProps) {
  const [layout, setLayout] = useState<'cover' | 'contain'>('cover');

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (w > 0 && h > 0) {
      setLayout(h >= w ? 'cover' : 'contain');
    }
  }, []);

  return (
    <div className={`absolute inset-0 overflow-hidden bg-zinc-950 ${className}`}>
      {layout === 'cover' ? (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          className="absolute inset-0 h-full w-full object-cover object-center"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={src}
            alt={alt}
            onLoad={handleLoad}
            className="block h-auto max-h-full w-full object-contain"
            decoding="async"
          />
        </div>
      )}
    </div>
  );
}
