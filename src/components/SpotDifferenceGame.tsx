'use client';

import React, { useState, useEffect } from 'react';
import { Prize } from '@/lib/db';
import { Check } from 'lucide-react';
import GameScreenLayout from '@/components/GameScreenLayout';

interface Difference {
  id: number;
  name: string;
  x: number;
  y: number;
  radius: number;
}

interface SpotDifferenceGameProps {
  prizes: Prize[];
  onFinished: (prize: Prize) => void;
}

export default function SpotDifferenceGame({ prizes, onFinished }: SpotDifferenceGameProps) {
  const [spotted, setSpotted] = useState<number[]>([]);
  const [completed, setCompleted] = useState(false);
  const [prize, setPrize] = useState<Prize | null>(null);

  const differences: Difference[] = [
    { id: 1, name: '노란 별', x: 28, y: 22, radius: 10 },
    { id: 2, name: '우주선 물체', x: 72, y: 38, radius: 10 },
    { id: 3, name: '홀로그램 나비', x: 45, y: 72, radius: 10 },
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

    let foundIndex = -1;
    for (const diff of differences) {
      const distance = Math.sqrt(Math.pow(clickX - diff.x, 2) + Math.pow(clickY - diff.y, 2));
      if (distance <= diff.radius) {
        foundIndex = diff.id;
        break;
      }
    }

    if (foundIndex !== -1 && !spotted.includes(foundIndex)) {
      const updated = [...spotted, foundIndex];
      setSpotted(updated);

      if (updated.length === differences.length) {
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
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80';

  return (
    <GameScreenLayout
      badge="SPOT THE DIFFERENCE"
      title="틀린그림찾기"
      subtitle="상하 두 이미지의 다른 점 3곳을 찾아 터치하세요!"
      footer={
        <div className="w-full space-y-4 pb-2 select-none">
          <div className="flex items-center justify-between font-mono text-lg">
            <span className="text-zinc-500">진행률 ({spotted.length} / 3)</span>
            <span className="font-semibold text-pink-500">
              {completed ? '찾기 성공!' : '틀린 곳을 찾아보세요'}
            </span>
          </div>

          <div className="flex gap-3">
            {differences.map((diff) => (
              <div
                key={`indicator-${diff.id}`}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-4 text-lg font-bold transition-all duration-300 ${
                  spotted.includes(diff.id)
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-400'
                }`}
              >
                {spotted.includes(diff.id) ? (
                  <>
                    <Check className="h-6 w-6" />
                    <span>{diff.name}</span>
                  </>
                ) : (
                  <span>?</span>
                )}
              </div>
            ))}
          </div>
        </div>
      }
    >
      <div className="flex w-full max-w-[min(100%,40rem)] flex-col gap-5 select-none">
        <div
          onClick={handleImageClick}
          className="relative aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-2xl border border-zinc-200 shadow-md"
        >
          <img src={imageUrl} alt="Original" className="h-full w-full object-cover brightness-90" />
          <div className="absolute left-3 top-3 rounded bg-black/60 px-3 py-1 text-sm font-bold uppercase tracking-widest text-zinc-400 backdrop-blur-md">
            A (원본)
          </div>
          {differences.map((diff) => {
            if (!spotted.includes(diff.id)) return null;
            return (
              <div
                key={`orig-${diff.id}`}
                className="absolute flex animate-ping-once items-center justify-center rounded-full border-2 border-red-500 bg-red-500/10"
                style={{
                  left: `${diff.x}%`,
                  top: `${diff.y}%`,
                  width: `${diff.radius * 2}%`,
                  height: `${diff.radius * 2}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="h-3 w-3 rounded-full bg-red-500" />
              </div>
            );
          })}
        </div>

        <div
          onClick={handleImageClick}
          className="relative aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-2xl border border-zinc-200 shadow-md"
        >
          <img src={imageUrl} alt="Modified" className="h-full w-full object-cover brightness-100" />
          <div className="absolute left-3 top-3 rounded bg-black/60 px-3 py-1 text-sm font-bold uppercase tracking-widest text-pink-400 backdrop-blur-md">
            B (수정됨)
          </div>

          {!spotted.includes(1) && (
            <div
              className="absolute animate-pulse text-yellow-300 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]"
              style={{ left: '28%', top: '22%', transform: 'translate(-50%, -50%) scale(1.2)', fontSize: '2.5rem' }}
            >
              ★
            </div>
          )}

          {!spotted.includes(2) && (
            <div
              className="absolute h-7 w-7 rounded-full border border-white/50 bg-gradient-to-r from-emerald-400 to-teal-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
              style={{ left: '72%', top: '38%', transform: 'translate(-50%, -50%)' }}
            />
          )}

          {!spotted.includes(3) && (
            <div
              className="absolute h-9 w-14 rotate-45 rounded-b-full border border-white bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]"
              style={{ left: '45%', top: '72%', transform: 'translate(-50%, -50%)' }}
            />
          )}

          {differences.map((diff) => {
            if (!spotted.includes(diff.id)) return null;
            return (
              <div
                key={`mod-${diff.id}`}
                className="absolute flex items-center justify-center rounded-full border-2 border-red-500 bg-red-500/10"
                style={{
                  left: `${diff.x}%`,
                  top: `${diff.y}%`,
                  width: `${diff.radius * 2}%`,
                  height: `${diff.radius * 2}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="h-3 w-3 rounded-full bg-red-500" />
              </div>
            );
          })}
        </div>
      </div>
    </GameScreenLayout>
  );
}
