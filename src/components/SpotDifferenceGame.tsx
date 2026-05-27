'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Prize } from '@/lib/db';
import { Check, Lightbulb } from 'lucide-react';
import GameScreenLayout from '@/components/GameScreenLayout';
import { buildSpotDiffScene, clamp, type DifferenceRegion } from '@/lib/game-scene';

interface SpotDifferenceGameProps {
  prizes: Prize[];
  onFinished: (prize: Prize) => void;
  /** 0~9 (총 10개 씬) */
  sceneIndex?: number;
}

const SPOT_DIFF_SEEDS = [
  1337, 7331, 2026, 9001, 4242, 17017, 31415, 27182, 61616, 80808,
] as const;

export default function SpotDifferenceGame({ prizes, onFinished, sceneIndex = 0 }: SpotDifferenceGameProps) {
  const [spotted, setSpotted] = useState<number[]>([]);
  const [completed, setCompleted] = useState(false);
  const [hintLeft, setHintLeft] = useState(3);
  const [hintedId, setHintedId] = useState<number | null>(null);

  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const modCanvasRef = useRef<HTMLCanvasElement>(null);
  const baseWrapRef = useRef<HTMLDivElement>(null);
  const modWrapRef = useRef<HTMLDivElement>(null);

  // NOTE: avoid non-deterministic calls during render (lint rule).
  // Parent decides sceneIndex (0~9) during user action.
  const seed = SPOT_DIFF_SEEDS[((sceneIndex % 10) + 10) % 10]!;
  const scene = useMemo(() => buildSpotDiffScene({ seed, difficulty: 'easy' }), [seed]);
  const differences = scene.differences;

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

  const getHitDiffId = (clickX: number, clickY: number, diffs: DifferenceRegion[]): number | null => {
    for (const diff of diffs) {
      const dx = clickX - diff.center.x;
      const dy = clickY - diff.center.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= diff.radius) return diff.id;
    }
    return null;
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (completed) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const clickY = clamp((e.clientY - rect.top) / rect.height, 0, 1);

    const foundId = getHitDiffId(clickX, clickY, differences);
    if (foundId && !spotted.includes(foundId)) {
      const updated = [...spotted, foundId];
      setSpotted(updated);

      if (updated.length === differences.length) {
        setCompleted(true);
        window.setTimeout(() => {
          onFinished(pickPrizeByProbability());
        }, 900);
      }
    }
  };

  const redraw = () => {
    const baseCanvas = baseCanvasRef.current;
    const modCanvas = modCanvasRef.current;
    const baseWrap = baseWrapRef.current;
    const modWrap = modWrapRef.current;
    if (!baseCanvas || !modCanvas || !baseWrap || !modWrap) return;

    const bw = Math.max(1, Math.round(baseWrap.clientWidth));
    const bh = Math.max(1, Math.round(baseWrap.clientHeight));
    const mw = Math.max(1, Math.round(modWrap.clientWidth));
    const mh = Math.max(1, Math.round(modWrap.clientHeight));

    if (baseCanvas.width !== bw) baseCanvas.width = bw;
    if (baseCanvas.height !== bh) baseCanvas.height = bh;
    if (modCanvas.width !== mw) modCanvas.width = mw;
    if (modCanvas.height !== mh) modCanvas.height = mh;

    const bctx = baseCanvas.getContext('2d');
    const mctx = modCanvas.getContext('2d');
    if (!bctx || !mctx) return;

    scene.drawBase(bctx, bw, bh);
    scene.drawModified(mctx, mw, mh);
  };

  useEffect(() => {
    redraw();
    const ro = new ResizeObserver(() => redraw());
    if (baseWrapRef.current) ro.observe(baseWrapRef.current);
    if (modWrapRef.current) ro.observe(modWrapRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  const useHint = () => {
    if (completed) return;
    if (hintLeft <= 0) return;
    const remain = differences.filter((d) => !spotted.includes(d.id));
    if (remain.length === 0) return;
    const id = remain[0]!.id;
    setHintLeft((n) => n - 1);
    setHintedId(id);
    window.setTimeout(() => setHintedId((prev) => (prev === id ? null : prev)), 1100);
  };

  return (
    <GameScreenLayout
      badge="SPOT THE DIFFERENCE"
      title="틀린그림찾기"
      subtitle="상하 두 그림의 다른 점 3곳을 찾아 터치하세요! (힌트 3회 사용 가능)"
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
                    <span>{diff.label}</span>
                  </>
                ) : (
                  <span>?</span>
                )}
              </div>
            ))}
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
      <div className="flex w-full max-w-[min(100%,40rem)] flex-col gap-5 select-none">
        <div
          ref={baseWrapRef}
          onClick={handleImageClick}
          className="relative aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-2xl border border-zinc-200 shadow-md"
        >
          <canvas ref={baseCanvasRef} className="absolute inset-0 h-full w-full" />
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
                  left: `${diff.center.x * 100}%`,
                  top: `${diff.center.y * 100}%`,
                  width: `${diff.radius * 2 * 100}%`,
                  height: `${diff.radius * 2 * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="h-3 w-3 rounded-full bg-red-500" />
              </div>
            );
          })}
          {hintedId ? (
            (() => {
              const diff = differences.find((d) => d.id === hintedId);
              if (!diff || spotted.includes(diff.id)) return null;
              return (
                <div
                  className="pointer-events-none absolute rounded-full border-4 border-yellow-300/90 bg-yellow-300/10 shadow-[0_0_25px_rgba(250,204,21,0.65)] animate-pulse"
                  style={{
                    left: `${diff.center.x * 100}%`,
                    top: `${diff.center.y * 100}%`,
                    width: `${diff.radius * 2 * 100}%`,
                    height: `${diff.radius * 2 * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              );
            })()
          ) : null}
        </div>

        <div
          ref={modWrapRef}
          onClick={handleImageClick}
          className="relative aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-2xl border border-zinc-200 shadow-md"
        >
          <canvas ref={modCanvasRef} className="absolute inset-0 h-full w-full" />
          <div className="absolute left-3 top-3 rounded bg-black/60 px-3 py-1 text-sm font-bold uppercase tracking-widest text-pink-400 backdrop-blur-md">
            B (수정됨)
          </div>

          {differences.map((diff) => {
            if (!spotted.includes(diff.id)) return null;
            return (
              <div
                key={`mod-${diff.id}`}
                className="absolute flex items-center justify-center rounded-full border-2 border-red-500 bg-red-500/10"
                style={{
                  left: `${diff.center.x * 100}%`,
                  top: `${diff.center.y * 100}%`,
                  width: `${diff.radius * 2 * 100}%`,
                  height: `${diff.radius * 2 * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="h-3 w-3 rounded-full bg-red-500" />
              </div>
            );
          })}
          {hintedId ? (
            (() => {
              const diff = differences.find((d) => d.id === hintedId);
              if (!diff || spotted.includes(diff.id)) return null;
              return (
                <div
                  className="pointer-events-none absolute rounded-full border-4 border-yellow-300/90 bg-yellow-300/10 shadow-[0_0_25px_rgba(250,204,21,0.65)] animate-pulse"
                  style={{
                    left: `${diff.center.x * 100}%`,
                    top: `${diff.center.y * 100}%`,
                    width: `${diff.radius * 2 * 100}%`,
                    height: `${diff.radius * 2 * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              );
            })()
          ) : null}
        </div>
      </div>
    </GameScreenLayout>
  );
}
