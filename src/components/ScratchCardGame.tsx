'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Prize } from '@/lib/db';
import { Award, Sparkles } from 'lucide-react';

interface ScratchCardGameProps {
  prizes: Prize[];
  onFinished: (prize: Prize) => void;
}

export default function ScratchCardGame({ prizes, onFinished }: ScratchCardGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [scratchedPercent, setScratchedPercent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [prize, setPrize] = useState<Prize | null>(null);

  // Pick a prize based on weight probabilities
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

  // Initialize prize on mount
  useEffect(() => {
    if (prizes.length > 0 && !prize) {
      setPrize(pickPrizeByProbability());
    }
  }, [prizes, prize]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas based on bounds
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Draw scratch layer background
    const drawOverlay = () => {
      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#3f3f46'); // Zinc 600
      grad.addColorStop(0.5, '#71717a'); // Zinc 500
      grad.addColorStop(1, '#27272a'); // Zinc 800
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add a metallic grid/pattern effect
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

      // Scratch instructions text
      ctx.fillStyle = '#f43f5e'; // Pink 500
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 4;
      ctx.fillText('복권을 긁어주세요!', canvas.width / 2, canvas.height / 2 - 15);

      ctx.fillStyle = '#a1a1aa'; // Zinc 400
      ctx.font = '12px sans-serif';
      ctx.shadowBlur = 0;
      ctx.fillText('마우스나 터치로 문지르세요', canvas.width / 2, canvas.height / 2 + 15);
    };

    drawOverlay();
  }, [isComplete]);

  // Scratch coordinates calculation
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    // Check if TouchEvent
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
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
    ctx.arc(coords.x, coords.y, 25, 0, Math.PI * 2);
    ctx.fill();

    // Prevent default scrolling on mobile screens while scratching
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
      // Clean canvas fully
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Auto trigger complete callback
      if (prize) {
        setTimeout(() => {
          onFinished(prize);
        }, 1200);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-6">
      {/* Title */}
      <div className="text-center pt-4 select-none">
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600">
          DIGITAL SCRATCH
        </span>
        <h2 className="text-2xl font-black tracking-tight text-zinc-800 mt-2">
          디지털 스크래치 복권
        </h2>
        <p className="text-xs text-zinc-500 mt-1.5 font-medium">
          화면의 은색 패널 부분을 문질러서<br />숨겨진 당첨 결과를 확인해 보세요!
        </p>
      </div>

      {/* Scratch Box Wrapper */}
      <div 
        ref={containerRef}
        className="w-full aspect-[4/3] max-w-[340px] relative rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200/80 my-4 shadow-md select-none"
      >
        {/* Underlay: Winning Prize Display */}
        {prize && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-zinc-50 to-white select-none">
            <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] text-pink-500 font-bold bg-pink-500/10 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" />
              <span>당첨</span>
            </div>
            
            {/* Prize Image wrapper */}
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-100 p-1 mb-3 bg-white shadow-sm">
              <img 
                src={prize.image_url} 
                alt={prize.name} 
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            
            <h3 className="text-sm font-semibold text-zinc-500">당첨된 상품</h3>
            <p className="text-xl font-bold text-transparent bg-gradient-to-r from-pink-600 to-indigo-600 bg-clip-text mt-1 text-center">
              {prize.name}
            </p>
          </div>
        )}

        {/* Scratch Canvas Overlay */}
        {!isComplete && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 z-10 w-full h-full cursor-crosshair touch-none"
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

      {/* Progress feedback bar */}
      <div className="w-full px-4 mb-2">
        <div className="flex justify-between items-center text-xs text-zinc-500 mb-1 font-mono">
          <span>스크래치율</span>
          <span className="font-semibold text-pink-500">{Math.min(100, Math.round(scratchedPercent))}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200/50">
          <div 
            className="h-full bg-gradient-to-r from-pink-500 to-indigo-600 transition-all duration-100" 
            style={{ width: `${Math.min(100, (scratchedPercent / 45) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
