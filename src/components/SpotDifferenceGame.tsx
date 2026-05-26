'use client';

import React, { useState, useEffect } from 'react';
import { Prize } from '@/lib/db';
import { Check, Sparkles, HelpCircle } from 'lucide-react';

interface Difference {
  id: number;
  name: string;
  x: number; // percentage from left
  y: number; // percentage from top
  radius: number; // clickable radius in percentage
}

interface SpotDifferenceGameProps {
  prizes: Prize[];
  onFinished: (prize: Prize) => void;
}

export default function SpotDifferenceGame({ prizes, onFinished }: SpotDifferenceGameProps) {
  const [spotted, setSpotted] = useState<number[]>([]);
  const [completed, setCompleted] = useState(false);
  const [prize, setPrize] = useState<Prize | null>(null);

  // Define 3 differences (relative coordinates in %)
  const differences: Difference[] = [
    { id: 1, name: '노란 별', x: 28, y: 22, radius: 10 },
    { id: 2, name: '우주선 물체', x: 72, y: 38, radius: 10 },
    { id: 3, name: '홀로그램 나비', x: 45, y: 72, radius: 10 },
  ];

  // Pick prize based on probability weights
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

    // Check if click was within radius of any difference
    let foundIndex = -1;
    for (let i = 0; i < differences.length; i++) {
      const diff = differences[i];
      // Calculate Euclidean distance
      const distance = Math.sqrt(Math.pow(clickX - diff.x, 2) + Math.pow(clickY - diff.y, 2));
      if (distance <= diff.radius) {
        foundIndex = diff.id;
        break;
      }
    }

    if (foundIndex !== -1 && !spotted.includes(foundIndex)) {
      const updated = [...spotted, foundIndex];
      setSpotted(updated);

      // Check if game complete
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

  const imageUrl = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80';

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-6">
      {/* Header */}
      <div className="text-center pt-2 select-none">
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-600">
          SPOT THE DIFFERENCE
        </span>
        <h2 className="text-xl font-black tracking-tight text-zinc-800 mt-1.5">
          틀린그림찾기
        </h2>
        <p className="text-[11px] text-zinc-500 mt-1 font-medium">
          상하 두 이미지의 다른 점 3곳을 찾아 터치하세요!
        </p>
      </div>

      {/* Game Board */}
      <div className="flex-1 flex flex-col justify-center gap-3 my-3 w-full max-w-[340px] select-none">
        {/* Top Image (Original - Missing the items) */}
        <div 
          onClick={handleImageClick}
          className="relative aspect-[16/10] w-full rounded-xl overflow-hidden border border-zinc-200 cursor-pointer shadow-md"
        >
          <img 
            src={imageUrl} 
            alt="Original" 
            className="w-full h-full object-cover brightness-90"
          />
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
            A (원본)
          </div>

          {/* Spotted rings on original */}
          {differences.map((diff) => {
            if (!spotted.includes(diff.id)) return null;
            return (
              <div
                key={`orig-${diff.id}`}
                className="absolute border-2 border-red-500 rounded-full bg-red-500/10 flex items-center justify-center animate-ping-once"
                style={{
                  left: `${diff.x}%`,
                  top: `${diff.y}%`,
                  width: `${diff.radius * 2}%`,
                  height: `${diff.radius * 2}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="w-2 h-2 bg-red-500 rounded-full" />
              </div>
            );
          })}
        </div>

        {/* Bottom Image (Modified - Has 3 floating differences) */}
        <div 
          onClick={handleImageClick}
          className="relative aspect-[16/10] w-full rounded-xl overflow-hidden border border-zinc-200 cursor-pointer shadow-md"
        >
          <img 
            src={imageUrl} 
            alt="Modified" 
            className="w-full h-full object-cover brightness-100"
          />
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-bold text-pink-400 uppercase tracking-widest">
            B (수정됨)
          </div>

          {/* Render difference items if NOT spotted yet */}
          {/* Difference 1: Star */}
          {!spotted.includes(1) && (
            <div 
              className="absolute text-yellow-300 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] animate-pulse"
              style={{ left: '28%', top: '22%', transform: 'translate(-50%, -50%) scale(1.2)' }}
            >
              ★
            </div>
          )}

          {/* Difference 2: Astronaut rocket / spaceship */}
          {!spotted.includes(2) && (
            <div 
              className="absolute w-4 h-4 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full border border-white/50 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
              style={{ left: '72%', top: '38%', transform: 'translate(-50%, -50%)' }}
            />
          )}

          {/* Difference 3: Hologram Butterfly (rendered as cyan shape) */}
          {!spotted.includes(3) && (
            <div 
              className="absolute w-5 h-3 bg-cyan-400 border border-white rotate-45 rounded-b-full shadow-[0_0_10px_rgba(34,211,238,0.9)]"
              style={{ left: '45%', top: '72%', transform: 'translate(-50%, -50%)' }}
            />
          )}

          {/* Spotted rings on modified image */}
          {differences.map((diff) => {
            if (!spotted.includes(diff.id)) return null;
            return (
              <div
                key={`mod-${diff.id}`}
                className="absolute border-2 border-red-500 rounded-full bg-red-500/10 flex items-center justify-center"
                style={{
                  left: `${diff.x}%`,
                  top: `${diff.y}%`,
                  width: `${diff.radius * 2}%`,
                  height: `${diff.radius * 2}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="w-2 h-2 bg-red-500 rounded-full" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Footer */}
      <div className="w-full space-y-3 pb-2 select-none">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-zinc-500">진행률 ({spotted.length} / 3)</span>
          <span className="font-semibold text-pink-500">
            {completed ? '찾기 성공!' : '틀린 곳을 찾아보세요'}
          </span>
        </div>

        <div className="flex gap-2">
          {differences.map((diff) => (
            <div
              key={`indicator-${diff.id}`}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 border text-xs font-bold transition-all duration-300 ${
                spotted.includes(diff.id)
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-400'
              }`}
            >
              {spotted.includes(diff.id) ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{diff.name}</span>
                </>
              ) : (
                <span>?</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
