'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Prize } from '@/lib/db';
import { Check, Lightbulb, Search } from 'lucide-react';
import GameScreenLayout from '@/components/GameScreenLayout';
import { buildHiddenObjectScene, clamp, type HiddenItemTarget } from '@/lib/game-scene';

interface HiddenObjectGameProps {
  prizes: Prize[];
  onFinished: (prize: Prize) => void;
}

export default function HiddenObjectGame({ prizes, onFinished }: HiddenObjectGameProps) {
  const [found, setFound] = useState<number[]>([]);
  const [completed, setCompleted] = useState(false);
  const [hintLeft, setHintLeft] = useState(3);
  const [hintedId, setHintedId] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // NOTE: avoid non-deterministic calls during render (lint rule).
  const seed = 7331;
  const scene = useMemo(() => buildHiddenObjectScene({ seed, difficulty: 'easy' }), [seed]);
  const hiddenItems: HiddenItemTarget[] = scene.items;

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

  const redraw = (foundIds: number[]) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const w = Math.max(1, Math.round(wrap.clientWidth));
    const h = Math.max(1, Math.round(wrap.clientHeight));

    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    scene.draw(ctx, w, h, foundIds);
  };

  useEffect(() => {
    redraw(found);
    const ro = new ResizeObserver(() => redraw(found));
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(() => {
    redraw(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found]);

  const getHitItemId = (clickX: number, clickY: number, items: HiddenItemTarget[]): number | null => {
    for (const item of items) {
      const dx = clickX - item.center.x;
      const dy = clickY - item.center.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= item.radius) return item.id;
    }
    return null;
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (completed) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const clickY = clamp((e.clientY - rect.top) / rect.height, 0, 1);

    const foundId = getHitItemId(clickX, clickY, hiddenItems);
    if (foundId && !found.includes(foundId)) {
      const updated = [...found, foundId];
      setFound(updated);

      if (updated.length === hiddenItems.length) {
        setCompleted(true);
        window.setTimeout(() => {
          onFinished(pickPrizeByProbability());
        }, 900);
      }
    }
  };

  const useHint = () => {
    if (completed) return;
    if (hintLeft <= 0) return;
    const remain = hiddenItems.filter((d) => !found.includes(d.id));
    if (remain.length === 0) return;
    const id = remain[0]!.id;
    setHintLeft((n) => n - 1);
    setHintedId(id);
    window.setTimeout(() => setHintedId((prev) => (prev === id ? null : prev)), 1100);
  };

  return (
    <GameScreenLayout
      badge="HIDDEN OBJECTS"
      title="숨은그림찾기"
      subtitle="그림 속 숨겨진 3개의 아이템을 찾아 터치하세요! (힌트 3회 사용 가능)"
      footer={
        <div className="w-full space-y-4 pb-2 select-none">
          <div className="flex select-none items-center gap-4 rounded-2xl border border-pink-100/80 bg-pink-50/50 p-5">
            <Search className="h-8 w-8 shrink-0 text-pink-500" />
            <p className="text-lg font-medium leading-relaxed text-pink-950/80">
              그림 속에 아이템이 자연스럽게 섞여 있어요. 잘 안 보이면 힌트를 사용해 보세요!
            </p>
          </div>

          <button
            type="button"
            onClick={useHint}
            disabled={hintLeft <= 0 || completed}
            className={`touch-press flex w-full items-center justify-center gap-3 rounded-2xl border py-4 text-lg font-bold transition-colors ${
              hintLeft > 0 && !completed
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                : 'border-zinc-200 bg-zinc-50 text-zinc-400'
            }`}
          >
            <Lightbulb className="h-6 w-6" />
            <span>힌트 사용 (남은 횟수: {hintLeft})</span>
          </button>
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
            <span className="text-4xl">{item.symbol}</span>
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
        ref={wrapRef}
        onClick={handleImageClick}
        className="relative mx-auto aspect-[4/5] w-full max-w-[min(100%,36rem)] cursor-pointer overflow-hidden rounded-3xl border border-zinc-200 shadow-xl select-none"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* Found markers */}
        {hiddenItems.map((item) => {
          const isFound = found.includes(item.id);
          if (!isFound) return null;
          return (
            <div
              key={`found-${item.id}`}
              className="pointer-events-none absolute flex items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500/10"
              style={{
                left: `${item.center.x * 100}%`,
                top: `${item.center.y * 100}%`,
                width: `${item.radius * 2 * 100}%`,
                height: `${item.radius * 2 * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <div className="absolute inset-0 animate-ping rounded-full border border-emerald-400" />
            </div>
          );
        })}

        {/* Hint highlight */}
        {hintedId ? (
          (() => {
            const item = hiddenItems.find((d) => d.id === hintedId);
            if (!item || found.includes(item.id)) return null;
            return (
              <div
                className="pointer-events-none absolute rounded-full border-4 border-yellow-300/90 bg-yellow-300/10 shadow-[0_0_25px_rgba(250,204,21,0.65)] animate-pulse"
                style={{
                  left: `${item.center.x * 100}%`,
                  top: `${item.center.y * 100}%`,
                  width: `${item.radius * 2 * 100}%`,
                  height: `${item.radius * 2 * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })()
        ) : null}
      </div>
    </GameScreenLayout>
  );
}
