'use client';

import React from 'react';

interface GameScreenLayoutProps {
  badge: string;
  badgeTone?: 'pink' | 'indigo';
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 헤더·본문·푸터 사이 간격 (기본 gap-9) */
  sectionGap?: string;
  /** 본문 내부 간격 (기본 gap-7) */
  contentGap?: string;
}

const badgeToneClass = {
  pink: 'border-pink-500/20 bg-pink-500/10 text-pink-600',
  indigo: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-600',
};

/** 키오스크 미니게임 공통: 가운데 정렬 + 큰 터치 UI */
export default function GameScreenLayout({
  badge,
  badgeTone = 'pink',
  title,
  subtitle,
  children,
  footer,
  sectionGap = 'gap-9',
  contentGap = 'gap-7',
}: GameScreenLayoutProps) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <div
        className={`mx-auto flex w-full max-w-[min(100%,48rem)] flex-1 flex-col items-center justify-center px-6 py-6 -translate-y-3 ${sectionGap}`}
      >
        <div className="w-full select-none text-center">
          <span
            className={`inline-block rounded-full border px-8 py-3 text-3xl font-semibold ${badgeToneClass[badgeTone]}`}
          >
            {badge}
          </span>
          <h2 className="mt-5 text-7xl font-black leading-tight tracking-tight text-zinc-800">{title}</h2>
          <p className="mt-3 text-xl font-medium leading-relaxed text-zinc-500">{subtitle}</p>
        </div>

        <div className={`flex w-full flex-col items-center ${contentGap}`}>{children}</div>

        {footer ? <div className="mt-2 w-full">{footer}</div> : null}
      </div>
    </div>
  );
}
