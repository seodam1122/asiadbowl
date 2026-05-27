'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Prize } from '@/lib/db';
import { Sparkles } from 'lucide-react';
import GameScreenLayout from '@/components/GameScreenLayout';

interface ScratchCardGameProps {
  prizes: Prize[];
  onFinished: (prize: Prize) => void;
}

const SCRATCH_BRUSH_RADIUS = 45;

export default function ScratchCardGame({ prizes, onFinished }: ScratchCardGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [scratchedPercent, setScratchedPercent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [prize, setPrize] = useState<Prize | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const drawOverlay = () => {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#3f3f46');
      grad.addColorStop(0.5, '#71717a');
      grad.addColorStop(1, '#27272a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const step = 20;
      for (let i = 0; i < canvas.width; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += step) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 4;
      ctx.fillText('복권을 긁어주세요!', canvas.width / 2, canvas.height / 2 - 22);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '22px sans-serif';
      ctx.shadowBlur = 0;
      ctx.fillText('마우스나 터치로 문지르세요', canvas.width / 2, canvas.height / 2 + 22);
    };

    drawOverlay();
  }, [isComplete]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isComplete) return;
    setIsDrawing(true);
    scratch(e);
  };

  const endDrawing = () => {
    setIsDrawing(false);
    checkScratchedPercentage();
  };

  const scratch = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isComplete) return;

    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';

    ctx.beginPath();
    ctx.arc(coords.x, coords.y, SCRATCH_BRUSH_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    if (e.cancelable) {
      e.preventDefault();
    }
  };

  const checkScratchedPercentage = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let transparentCount = 0;

    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 128) {
        transparentCount++;
      }
    }

    const percent = (transparentCount / (pixels.length / 4)) * 100;
    setScratchedPercent(percent);

    if (percent > 45 && !isComplete) {
      setIsComplete(true);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (prize) {
        setTimeout(() => {
          onFinished(prize);
        }, 1200);
      }
    }
  };

  return (
    <GameScreenLayout
      badge="DIGITAL SCRATCH"
      badgeTone="indigo"
      title="디지털 스크래치 복권"
      subtitle={
        <>
          화면의 은색 패널 부분을 문질러서
          <br />
          숨겨진 당첨 결과를 확인해 보세요!
        </>
      }
    >
      <div
        ref={containerRef}
        className="relative mx-auto aspect-[4/3] w-full max-w-[min(100%,40rem)] overflow-hidden rounded-3xl border border-zinc-200/80 bg-zinc-100 shadow-md select-none"
      >
        {prize && (
          <div className="absolute inset-0 flex select-none flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-white p-8">
            <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-pink-500/10 px-3 py-1 text-base font-bold text-pink-500">
              <Sparkles className="h-5 w-5" />
              <span>당첨</span>
            </div>

            <div className="mb-5 h-40 w-40 overflow-hidden rounded-full border-2 border-indigo-100 bg-white p-1.5 shadow-sm">
              <img src={prize.image_url} alt={prize.name} className="h-full w-full rounded-full object-cover" />
            </div>

            <h3 className="text-xl font-semibold text-zinc-500">당첨된 상품</h3>
            <p className="mt-2 bg-gradient-to-r from-pink-600 to-indigo-600 bg-clip-text text-center text-4xl font-bold text-transparent">
              {prize.name}
            </p>
          </div>
        )}

        {!isComplete && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 z-10 h-full w-full cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseUp={endDrawing}
            onMouseLeave={endDrawing}
            onMouseMove={scratch}
            onTouchStart={startDrawing}
            onTouchEnd={endDrawing}
            onTouchMove={scratch}
          />
        )}
      </div>

      <div className="w-full px-2">
        <div className="mb-2 flex items-center justify-between font-mono text-lg text-zinc-500">
          <span>스크래치율</span>
          <span className="font-semibold text-pink-500">{Math.min(100, Math.round(scratchedPercent))}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full border border-zinc-200/50 bg-zinc-100">
          <div
            className="h-full bg-gradient-to-r from-pink-500 to-indigo-600 transition-all duration-100"
            style={{ width: `${Math.min(100, (scratchedPercent / 45) * 100)}%` }}
          />
        </div>
      </div>
    </GameScreenLayout>
  );
}
