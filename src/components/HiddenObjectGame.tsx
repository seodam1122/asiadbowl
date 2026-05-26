'use client';

import React, { useState, useEffect } from 'react';
import { Prize } from '@/lib/db';
import { Check, Search, Sparkles } from 'lucide-react';

interface HiddenItem {
  id: number;
  name: string;
  emoji: string;
  x: number; // percentage from left
  y: number; // percentage from top
  radius: number; // clickable radius in %
}

interface HiddenObjectGameProps {
  prizes: Prize[];
  onFinished: (prize: Prize) => void;
}

export default function HiddenObjectGame({ prizes, onFinished }: HiddenObjectGameProps) {
  const [found, setFound] = useState<number[]>([]);
  const [completed, setCompleted] = useState(false);
  const [prize, setPrize] = useState<Prize | null>(null);

  // Hidden objects list
  const hiddenItems: HiddenItem[] = [
    { id: 1, name: '빨간 사과', emoji: '🍎', x: 25, y: 55, radius: 10 },
    { id: 2, name: '황금 열쇠', emoji: '🔑', x: 78, y: 28, radius: 10 },
    { id: 3, name: '푸른 보석', emoji: '💎', x: 50, y: 76, radius: 10 },
  ];

  // Pick prize based on weights
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

    // Calculate click coordinates relative to the image container
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Check if click was within radius of any item
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

      // Check if game complete
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

  // Complex colorful busy background image
  const imageUrl = 'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=600&auto=format&fit=crop&q=80';

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-6">
      {/* Header */}
      <div className="text-center pt-2 select-none">
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-600">
          HIDDEN OBJECTS
        </span>
        <h2 className="text-xl font-black tracking-tight text-zinc-800 mt-1.5">
          숨은그림찾기
        </h2>
        <p className="text-[11px] text-zinc-500 mt-1 font-medium">
          그림 속 숨겨진 3개의 아이템을 찾아 터치하세요!
        </p>
      </div>

      {/* Target Items List */}
      <div className="w-full grid grid-cols-3 gap-2 w-full max-w-[340px] select-none my-1">
        {hiddenItems.map((item) => (
          <div
            key={`target-${item.id}`}
            className={`py-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all duration-300 ${
              found.includes(item.id)
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                : 'bg-zinc-50 border-zinc-200 text-zinc-700'
            }`}
          >
            <span className="text-xl">{item.emoji}</span>
            <span className="text-[10px] font-bold">{item.name}</span>
            {found.includes(item.id) ? (
              <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5">
                <Check className="w-3 h-3" /> 완료
              </span>
            ) : (
              <span className="text-[9px] font-semibold text-zinc-400">찾는 중</span>
            )}
          </div>
        ))}
      </div>

      {/* Game Image Canvas */}
      <div 
        onClick={handleImageClick}
        className="relative w-full aspect-[4/5] max-w-[320px] rounded-2xl overflow-hidden border border-zinc-200 cursor-pointer shadow-xl select-none my-2"
      >
        <img 
          src={imageUrl} 
          alt="Hidden object background" 
          className="w-full h-full object-cover brightness-75 select-none"
        />

        {/* Hidden Item Overlays */}
        {hiddenItems.map((item) => {
          const isFound = found.includes(item.id);
          return (
            <div
              key={`item-${item.id}`}
              className={`absolute flex items-center justify-center rounded-full text-base transition-all select-none duration-300 ${
                isFound 
                  ? 'border-2 border-emerald-500 bg-emerald-500/20 scale-125' 
                  : 'opacity-80 scale-75 hover:opacity-100' // slightly blends in background
              }`}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: '32px',
                height: '32px',
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Render item emoji */}
              <span className={`select-none ${isFound ? '' : 'blur-[0.5px] brightness-90 filter drop-shadow'}`}>
                {item.emoji}
              </span>
              
              {/* Spotted ring indicator */}
              {isFound && (
                <div className="absolute inset-0 rounded-full border border-emerald-400 animate-ping" />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="w-full bg-pink-50/50 border border-pink-100/80 rounded-2xl p-3 flex gap-2.5 items-center select-none">
        <Search className="w-4 h-4 text-pink-500 shrink-0" />
        <p className="text-[10px] text-pink-950/80 leading-relaxed font-medium">
          그림의 구석구석을 자세히 살펴보세요. 화면이 작아 보일 경우 터치 영역의 주변을 정확하게 클릭해 주셔야 합니다.
        </p>
      </div>
    </div>
  );
}
