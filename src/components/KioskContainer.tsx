'use client';

import React from 'react';

interface KioskContainerProps {
  children: React.ReactNode;
}

/**
 * 세로 키오스크: 항상 뷰포트 전체(100vw × 100dvh) — 브라우저 배율 100% 기준.
 * (이전 lg:max-w-[480px] 프레임은 1080px 세로 패널에서도 적용되어 여백이 생김)
 */
export default function KioskContainer({ children }: KioskContainerProps) {
  return (
    <div className="kiosk-root fixed inset-0 z-0 flex flex-col overflow-hidden bg-[#09090b] text-white">
      <div className="kiosk-shell relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#09090b]">
        <div className="flex min-h-0 flex-1 w-full flex-col overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900/90 to-zinc-950">
          {children}
        </div>
      </div>
    </div>
  );
}
