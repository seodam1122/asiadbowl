'use client';

import React, { useState, useEffect } from 'react';
import { Prize } from '@/lib/db';
import { Check, Search } from 'lucide-react';
import GameScreenLayout from '@/components/GameScreenLayout';

interface HiddenItem {
  id: number;
  name: string;
  emoji: string;
  x: number;
  y: number;
  radius: number;
}

interface HiddenObjectGameProps {
  prizes: Prize[];
  onFinished: (prize: Prize) => void;
}

export default function HiddenObjectGame({ prizes, onFinished }: HiddenObjectGameProps) {
  const [found, setFound] = useState<number[]>([]);
  const [completed, setCompleted] = useState(false);
  const [prize, setPrize] = useState<Prize | null>(null);

  const hiddenItems: HiddenItem[] = [
    { id: 1, name: '빨간 사과', emoji: '🍎', x: 25, y: 55, radius: 10 },
    { id: 2, name: '황금 열쇠', emoji: '🔑', x: 78, y: 28, radius: 10 },
    { id: 3, name: '푸른 보석', emoji: '💎', x: 50, y: 76, radius: 10 },
  ];

  const pickPrizeByProbability = (): Prize => {
    const random = Math.random() * 100;
    let sum = 0;
    for (const p of prizes) {
      sum += Number(p.probability);
      if (random <= sum) {
        return p;
      }
    }
    return prizes[prizes.length - 1];
  };

  useEffect(() => {
    if (prizes.length > 0 && !prize) {
      setPrize(pickPrizeByProbability());
    }
  }, [prizes, prize]);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (completed) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    let foundId = -1;
    for (const item of hiddenItems) {
      const distance = Math.sqrt(Math.pow(clickX - item.x, 2) + Math.pow(clickY - item.y, 2));
      if (distance <= item.radius) {
        foundId = item.id;
        break;
      }
    }

    if (foundId !== -1 && !found.includes(foundId)) {
      const updated = [...found, foundId];
      setFound(updated);

      if (updated.length === hiddenItems.length) {
        setCompleted(true);
        if (prize) {
          setTimeout(() => {
            onFinished(prize);
          }, 1500);
        }
      }
    }
  };

  const imageUrl =
    'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=600&auto=format&fit=crop&q=80';

  return (
    <GameScreenLayout
      badge="HIDDEN OBJECTS"
      title="숨은그림찾기"
      subtitle="그림 속 숨겨진 3개의 아이템을 찾아 터치하세요!"
      footer={
        <div className="flex select-none items-center gap-4 rounded-2xl border border-pink-100/80 bg-pink-50/50 p-5">
          <Search className="h-8 w-8 shrink-0 text-pink-500" />
          <p className="text-lg font-medium leading-relaxed text-pink-950/80">
            그림의 구석구석을 자세히 살펴보세요. 화면이 작아 보일 경우 터치 영역의 주변을 정확하게 클릭해
            주셔야 합니다.
          </p>
        </div>
      }
    >
      <div className="grid w-full max-w-[min(100%,40rem)] grid-cols-3 gap-4 select-none">
        {hiddenItems.map((item) => (
          <div
            key={`target-${item.id}`}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border py-5 transition-all duration-300 ${
              found.includes(item.id)
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700'
            }`}
          >
            <span className="text-4xl">{item.emoji}</span>
            <span className="text-base font-bold">{item.name}</span>
            {found.includes(item.id) ? (
              <span className="flex items-center gap-1 text-sm font-bold text-emerald-600">
                <Check className="h-5 w-5" /> 완료
              </span>
            ) : (
              <span className="text-sm font-semibold text-zinc-400">찾는 중</span>
            )}
          </div>
        ))}
      </div>

      <div
        onClick={handleImageClick}
        className="relative mx-auto aspect-[4/5] w-full max-w-[min(100%,36rem)] cursor-pointer overflow-hidden rounded-3xl border border-zinc-200 shadow-xl select-none"
      >
        <img
          src={imageUrl}
          alt="Hidden object background"
          className="h-full w-full select-none object-cover brightness-75"
        />

        {hiddenItems.map((item) => {
          const isFound = found.includes(item.id);
          return (
            <div
              key={`item-${item.id}`}
              className={`absolute flex select-none items-center justify-center rounded-full text-3xl transition-all duration-300 ${
                isFound
                  ? 'scale-125 border-2 border-emerald-500 bg-emerald-500/20'
                  : 'scale-90 opacity-80 hover:opacity-100'
              }`}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: '58px',
                height: '58px',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span
                className={`select-none ${isFound ? '' : 'blur-[0.5px] brightness-90 filter drop-shadow'}`}
              >
                {item.emoji}
              </span>
              {isFound && <div className="absolute inset-0 animate-ping rounded-full border border-emerald-400" />}
            </div>
          );
        })}
      </div>
    </GameScreenLayout>
  );
}
