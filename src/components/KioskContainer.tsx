'use client';

import React, { useEffect, useRef, useState } from 'react';
import { KIOSK_DESIGN_HEIGHT, KIOSK_DESIGN_WIDTH, getKioskScale } from '@/lib/kiosk-viewport';

interface KioskContainerProps {
  children: React.ReactNode;
}

/**
 * 세로 키오스크: 1080×1920 기준 UI를 뷰포트에 맞게 균일 스케일.
 * 다른 해상도·비율에서도 레이아웃이 깨지지 않고, 여백은 letterbox로 처리.
 */
export default function KioskContainer({ children }: KioskContainerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const update = () => {
      setScale(getKioskScale(root.clientWidth, root.clientHeight));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(root);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="kiosk-root fixed inset-0 z-0 flex items-center justify-center overflow-hidden bg-[#09090b] text-white"
    >
      <div
        className="kiosk-stage relative flex flex-col overflow-hidden bg-[#09090b]"
        style={{
          width: KIOSK_DESIGN_WIDTH,
          height: KIOSK_DESIGN_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <div className="kiosk-shell relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 w-full flex-col overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900/90 to-zinc-950">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
