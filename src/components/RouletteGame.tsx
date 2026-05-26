'use client';

import React, { useState, useRef } from 'react';
import { Prize } from '@/lib/db';
import { Sparkles, HelpCircle } from 'lucide-react';

// Helper function to split prize name into maximum 2 lines for wrapping
const splitPrizeName = (name: string): string[] => {
  if (name.length <= 5) return [name];
  
  // If it contains spaces, split by the spaces
  if (name.includes(' ')) {
    const parts = name.split(' ');
    if (parts.length === 2) {
      return parts;
    }
    // Merge into two equal-ish lines
    const mid = Math.ceil(parts.length / 2);
    return [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
  }
  
  // If no space, split directly in half
  const half = Math.ceil(name.length / 2);
  return [name.slice(0, half), name.slice(half)];
};

interface RouletteGameProps {
  prizes: Prize[];
  onFinished: (prize: Prize) => void;
}

/** Same id comparison even when Supabase returns string ids */
const samePrizeId = (a: Prize['id'], b: Prize['id']) => Number(a) === Number(b);

/** Pointer is at 12 o'clock; sector 0 starts at top (matches SVG layout). */
function getSectorIndexAtPointer(rotationDeg: number, sectorCount: number): number {
  const sectorAngle = 360 / sectorCount;
  const normalized = ((rotationDeg % 360) + 360) % 360;
  const pointerAngle = (360 - normalized) % 360;
  const index = Math.floor(pointerAngle / sectorAngle);
  return ((index % sectorCount) + sectorCount) % sectorCount;
}

export default function RouletteGame({ prizes, onFinished }: RouletteGameProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null);
  const wheelRef = useRef<SVGGElement>(null);

  // Generate beautiful colors for sectors
  const sectorColors = [
    '#ec4899', // Pink
    '#6366f1', // Indigo
    '#a855f7', // Purple
    '#14b8a6', // Teal
    '#f59e0b', // Amber
    '#ef4444', // Red
  ];

  // Pick a prize based on probability distribution
  const pickPrizeByProbability = (): Prize => {
    const random = Math.random() * 100;
    let sum = 0;
    for (const prize of prizes) {
      sum += Number(prize.probability);
      if (random <= sum) {
        return prize;
      }
    }
    return prizes[prizes.length - 1]; // Fallback to last
  };

  const startSpin = () => {
    if (isSpinning || prizes.length === 0) return;

    setIsSpinning(true);
    const prize = pickPrizeByProbability();
    setSelectedPrize(prize);

    const sectors = [...prizes, ...prizes];
    const sectorCount = sectors.length;
    const sectorAngle = 360 / sectorCount;

    // Find all matching indices in the duplicated 8-sector array
    const matchingIndices: number[] = [];
    sectors.forEach((p, idx) => {
      if (samePrizeId(p.id, prize.id)) {
        matchingIndices.push(idx);
      }
    });

    const targetIndex =
      matchingIndices.length > 0
        ? matchingIndices[Math.floor(Math.random() * matchingIndices.length)]
        : prizes.findIndex((p) => samePrizeId(p.id, prize.id));

    if (targetIndex < 0) {
      setIsSpinning(false);
      return;
    }

    // Align sector center with top pointer (0° in wheel-local coordinates)
    const centerAngle = (targetIndex + 0.5) * sectorAngle;
    const targetAngle = (360 - centerAngle) % 360;

    const extraRounds = 5;
    const finalRotation = rotation + (360 - (rotation % 360)) + extraRounds * 360 + targetAngle;

    setRotation(finalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      const landedIndex = getSectorIndexAtPointer(finalRotation, sectorCount);
      const landedPrize = sectors[landedIndex];
      onFinished(landedPrize);
    }, 4100);
  };

  const sectors = [...prizes, ...prizes];
  const sectorCount = sectors.length;
  const sectorAngle = 360 / sectorCount;

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-6">
      {/* Title */}
      <div className="text-center pt-4 select-none">
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-600">
          LUCKY WHEEL
        </span>
        <h2 className="text-2xl font-black tracking-tight text-zinc-800 mt-2">
          행운의 룰렛 돌리기
        </h2>
        <p className="text-xs text-zinc-500 mt-1.5 font-medium">
          화면 중앙의 START 버튼을 터치하여<br />경품 룰렛을 돌려보세요!
        </p>
      </div>

      {/* Wheel Area */}
      <div className="relative w-full aspect-square max-w-[340px] flex items-center justify-center my-4">
        {/* Outer Glowing Border */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-500 opacity-10 blur-xl pointer-events-none" />
        <div className="absolute inset-[-4px] rounded-full border border-zinc-200 pointer-events-none shadow-sm" />
        <div className="absolute inset-[-12px] rounded-full border-2 border-zinc-100 pointer-events-none animate-pulse-glow" />

        {/* Wheel SVG */}
        <svg
          viewBox="0 0 400 400"
          className="w-full h-full drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)] select-none"
        >
          <defs>
            {/* Inner shadows and glows */}
            <radialGradient id="wheel-center-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f4f4f5" />
            </radialGradient>
            <filter id="shadow">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Rotatable wheel group */}
          <g
            ref={wheelRef}
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: '200px 200px',
            }}
            className="roulette-transition"
          >
            {/* Draw sectors */}
            {sectors.map((prize, i) => {
              const startAngle = i * sectorAngle;
              const endAngle = (i + 1) * sectorAngle;
              
              // Polar to cartesian coordinates helper
              const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
                const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
                return {
                  x: centerX + radius * Math.cos(angleInRadians),
                  y: centerY + radius * Math.sin(angleInRadians),
                };
              };

              const start = polarToCartesian(200, 200, 185, endAngle);
              const end = polarToCartesian(200, 200, 185, startAngle);
              const largeArcFlag = sectorAngle <= 180 ? '0' : '1';

              // Sector Path
              const d = [
                'M', 200, 200,
                'L', start.x, start.y,
                'A', 185, 185, 0, largeArcFlag, 0, end.x, end.y,
                'Z',
              ].join(' ');

              const color = sectorColors[i % sectorColors.length];

              // Sector label rotation
              const textRotation = startAngle + sectorAngle / 2;
              const nameLines = splitPrizeName(prize.name);
              const isMultiLine = nameLines.length > 1;

              return (
                <g key={`${prize.id}-${i}`}>
                  {/* Sector shape */}
                  <path
                    d={d}
                    fill={color}
                    opacity="0.85"
                    stroke="#09090b"
                    strokeWidth="4"
                  />
                  {/* Prize Text */}
                  <g transform={`rotate(${textRotation} 200 200)`}>
                    {isMultiLine ? (
                      <text
                        x="200"
                        fill="#ffffff"
                        fontSize="15.5"
                        fontWeight="bold"
                        textAnchor="middle"
                        transform={`rotate(180 200 65)`}
                        style={{ filter: 'url(#shadow)' }}
                      >
                        <tspan x="200" y="51">{nameLines[0]}</tspan>
                        <tspan x="200" y="73">{nameLines[1]}</tspan>
                      </text>
                    ) : (
                      <text
                        x="200"
                        y="67"
                        fill="#ffffff"
                        fontSize="17.5"
                        fontWeight="bold"
                        textAnchor="middle"
                        transform={`rotate(180 200 67)`}
                        style={{ filter: 'url(#shadow)' }}
                      >
                        {nameLines[0]}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}

            {/* Inner circle mask for premium look */}
            <circle cx="200" cy="200" r="45" fill="url(#wheel-center-glow)" stroke="#ffffff" strokeWidth="4" />
          </g>

          {/* Outer circle border (Static) */}
          <circle cx="200" cy="200" r="185" fill="none" stroke="#e4e4e7" strokeWidth="4" />
          {/* Glowing pins around outer ring (Static) */}
          {Array.from({ length: 12 }).map((_, idx) => {
            const angle = (idx * 360) / 12;
            const rad = (angle * Math.PI) / 180;
            const px = 200 + 185 * Math.cos(rad);
            const py = 200 + 185 * Math.sin(rad);
            return (
              <circle
                key={idx}
                cx={px}
                cy={py}
                r="4.5"
                fill={isSpinning ? '#f43f5e' : '#a1a1aa'}
                className={isSpinning ? 'animate-pulse' : ''}
                filter="url(#shadow)"
              />
            );
          })}
        </svg>

        {/* Pointer arrow (Static, at 12 o'clock pointing down) */}
        <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-pink-500 drop-shadow-[0_4px_8px_rgba(236,72,153,0.5)]" />

        {/* Center START Button */}
        <button
          type="button"
          onClick={startSpin}
          disabled={isSpinning}
          className={`absolute w-20 h-20 rounded-full flex flex-col items-center justify-center z-20 touch-press transition-all duration-300 font-bold tracking-wider text-sm select-none border-2 ${
            isSpinning
              ? 'bg-zinc-800 text-zinc-500 border-zinc-700 shadow-none'
              : 'bg-gradient-to-tr from-pink-500 to-indigo-600 text-white border-pink-400/30 shadow-[0_0_20px_rgba(236,72,153,0.4)] hover:shadow-[0_0_30px_rgba(236,72,153,0.6)] animate-pulse-glow'
          }`}
        >
          <Sparkles className={`w-4 h-4 mb-0.5 ${isSpinning ? 'text-zinc-500' : 'text-pink-200'}`} />
          <span className="text-[13px]">START</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="w-full bg-indigo-50/50 border border-indigo-100/80 rounded-2xl p-4 flex gap-3 items-center mb-2">
        <HelpCircle className="w-5 h-5 text-indigo-500 shrink-0" />
        <p className="text-xs text-indigo-900/80 leading-normal font-medium">
          100% 당첨 보장! 룰렛 결과에 따라 푸짐한 상품이 즉시 지급됩니다. 룰렛이 완전히 정지할 때까지 터치스크린을 조작하지 마세요.
        </p>
      </div>
    </div>
  );
}
