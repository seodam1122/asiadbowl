'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Reward =
  | { label: '무료 1게임'; scoreRange: '0~2' }
  | { label: '음료 교환권'; scoreRange: '3~5' }
  | { label: '스낵 교환권'; scoreRange: '6~8' }
  | { label: '2000 point'; scoreRange: '9~10' };

function getReward(score: number): Reward {
  if (score <= 2) return { label: '무료 1게임', scoreRange: '0~2' };
  if (score <= 5) return { label: '음료 교환권', scoreRange: '3~5' };
  if (score <= 8) return { label: '스낵 교환권', scoreRange: '6~8' };
  return { label: '2000 point', scoreRange: '9~10' };
}

type Pin = {
  id: number;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  angle: number;
  angularV: number;
  down: boolean;
};

type Ball = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  spin: number;
  moving: boolean;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function resolveDiscCollision(
  a: { x: number; y: number; vx: number; vy: number; r: number },
  b: { x: number; y: number; vx: number; vy: number; r: number },
  restitution = 0.75,
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const minD = a.r + b.r;
  if (d2 <= 0 || d2 > minD * minD) return false;

  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const overlap = minD - d;

  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal > 0) return true;

  const j = (-(1 + restitution) * velAlongNormal) / 2;
  const ix = j * nx;
  const iy = j * ny;
  a.vx -= ix;
  a.vy -= iy;
  b.vx += ix;
  b.vy += iy;
  return true;
}

/**
 * 관리자 전용: 볼링 1샷 테스트(핀 10개).
 * - 드래그로 방향/세기 설정
 * - 1번 던지면 종료(Reset으로 재시작)
 * - 점수(0~10) => 보상 매핑 표시
 */
export default function BowlingDevGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<'aim' | 'rolling' | 'done'>('aim');
  const [score, setScore] = useState<number | null>(null);

  const [aimStart, setAimStart] = useState<{ x: number; y: number } | null>(null);
  const [aimNow, setAimNow] = useState<{ x: number; y: number } | null>(null);
  const phaseRef = useRef<'aim' | 'rolling' | 'done'>('aim');
  const aimStartRef = useRef<{ x: number; y: number } | null>(null);
  const aimNowRef = useRef<{ x: number; y: number } | null>(null);

  // Simulation state in refs (avoid re-rendering each frame)
  const pinsRef = useRef<Pin[]>([]);
  const ballRef = useRef<Ball | null>(null);
  const lastTsRef = useRef<number>(0);

  const constants = useMemo(() => {
    return {
      // game feel
      friction: 0.985,
      pinFriction: 0.975,
      angularFriction: 0.94,
      bounce: 0.25,
      impulse: 0.9,
      sideSpinStrength: 0.065,
      pinSpinImpulse: 0.06,
      // aim limits
      minPower: 6,
      maxPower: 34,
    } as const;
  }, []);

  const updatePhase = (next: 'aim' | 'rolling' | 'done') => {
    phaseRef.current = next;
    setPhase(next);
  };

  const reset = () => {
    updatePhase('aim');
    setScore(null);
    aimStartRef.current = null;
    aimNowRef.current = null;
    setAimStart(null);
    setAimNow(null);
    lastTsRef.current = 0;

    const w = canvasRef.current?.width ?? 600;
    const h = canvasRef.current?.height ?? 900;

    // Lane coordinate system: (0..w, 0..h). Ball starts bottom-center.
    const ballR = Math.max(12, Math.round(Math.min(w, h) * 0.028));
    ballRef.current = {
      x: w * 0.5,
      y: h * 0.86,
      r: ballR,
      vx: 0,
      vy: 0,
      spin: 0,
      moving: false,
    };

    // Pins: 10 in triangle near top
    const pinR = Math.max(10, Math.round(Math.min(w, h) * 0.022));
    const topY = h * 0.20;
    const dx = pinR * 2.2;
    const dy = pinR * 2.0;
    const startX = w * 0.5;

    const pins: Pin[] = [];
    let id = 1;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col <= row; col++) {
        const x = startX + (col - row / 2) * dx;
        // 역삼각형 배치 (플레이어 기준으로 한 줄짜리 헤드핀이 아래쪽)
        const y = topY + (3 - row) * dy;
        pins.push({ id, x, y, r: pinR, vx: 0, vy: 0, angle: 0, angularV: 0, down: false });
        id++;
      }
    }
    pinsRef.current = pins;
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const w = Math.max(320, Math.round(wrap.clientWidth));
    const h = Math.max(520, Math.round(wrap.clientHeight));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  };

  const computeScore = () => {
    const pins = pinsRef.current;
    const down = pins.filter((p) => p.down).length;
    setScore(down);
    setPhase('done');
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Lane background
    const lane = ctx.createLinearGradient(0, 0, 0, h);
    lane.addColorStop(0, '#0b1020');
    lane.addColorStop(1, '#111827');
    ctx.fillStyle = lane;
    ctx.fillRect(0, 0, w, h);

    // Wooden lane strip
    const laneInset = w * 0.14;
    ctx.fillStyle = '#6b4f2a';
    ctx.fillRect(laneInset, h * 0.06, w - laneInset * 2, h * 0.90);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(laneInset + i * ((w - laneInset * 2) / 10), h * 0.06, 1, h * 0.90);
    }

    // Gutters
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, h * 0.06, laneInset, h * 0.90);
    ctx.fillRect(w - laneInset, h * 0.06, laneInset, h * 0.90);

    // Target line near pins
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(laneInset, h * 0.24);
    ctx.lineTo(w - laneInset, h * 0.24);
    ctx.stroke();

    // Pins (upright bowling pin silhouette)
    const pins = pinsRef.current;
    for (const p of pins) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      const alpha = p.down ? 0.35 : 1;
      ctx.globalAlpha = alpha;

      const topR = p.r * 0.4;
      const midR = p.r * 0.78;
      const botR = p.r * 0.92;
      const neckY = -p.r * 1.1;
      const bellyY = -p.r * 0.1;
      const baseY = p.r * 1.1;

      ctx.beginPath();
      ctx.moveTo(-topR, neckY);
      ctx.quadraticCurveTo(-midR, -p.r * 0.55, -botR, bellyY);
      ctx.quadraticCurveTo(-botR * 1.02, p.r * 0.55, -botR * 0.75, baseY);
      ctx.lineTo(botR * 0.75, baseY);
      ctx.quadraticCurveTo(botR * 1.02, p.r * 0.55, botR, bellyY);
      ctx.quadraticCurveTo(midR, -p.r * 0.55, topR, neckY);
      ctx.closePath();

      const pinGrad = ctx.createLinearGradient(0, neckY, 0, baseY);
      pinGrad.addColorStop(0, '#ffffff');
      pinGrad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = pinGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(1.5, p.r * 0.08);
      ctx.stroke();

      // red neck band (upper area)
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(0, -p.r * 0.78, p.r * 0.52, p.r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha * 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-p.r * 0.2, -p.r * 0.35, p.r * 0.22, p.r * 0.48, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ball
    const ball = ballRef.current;
    if (ball) {
      const g = ctx.createRadialGradient(ball.x - ball.r * 0.35, ball.y - ball.r * 0.35, ball.r * 0.2, ball.x, ball.y, ball.r);
      g.addColorStop(0, '#93c5fd');
      g.addColorStop(1, '#1d4ed8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Aim line
    if (phaseRef.current === 'aim' && aimStartRef.current && aimNowRef.current && ball) {
      ctx.strokeStyle = 'rgba(250,204,21,0.95)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(aimNowRef.current.x, aimNowRef.current.y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(250,204,21,0.18)';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r * 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // HUD hint text
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 ${Math.max(14, Math.round(w * 0.03))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('드래그로 1번만 던져서 점수를 확인하세요 (좌우 드래그: 커브)', laneInset, Math.round(h * 0.065));
  };

  const step = (ts: number) => {
    rafRef.current = window.requestAnimationFrame(step);
    const last = lastTsRef.current || ts;
    const dt = clamp((ts - last) / 16.666, 0.5, 2.0);
    lastTsRef.current = ts;

    const canvas = canvasRef.current;
    const ball = ballRef.current;
    if (!canvas || !ball) {
      draw();
      return;
    }

    const w = canvas.width;
    const h = canvas.height;
    const laneInset = w * 0.14;

    if (phaseRef.current === 'rolling') {
      // Update ball
      ball.vx += ball.spin * constants.sideSpinStrength * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      ball.vx *= Math.pow(constants.friction, dt);
      ball.vy *= Math.pow(constants.friction, dt);
      ball.spin *= Math.pow(0.985, dt);

      // Lane bounds (bounce from gutters)
      const minX = laneInset + ball.r;
      const maxX = w - laneInset - ball.r;
      if (ball.x < minX) {
        ball.x = minX;
        ball.vx = Math.abs(ball.vx) * constants.bounce;
      } else if (ball.x > maxX) {
        ball.x = maxX;
        ball.vx = -Math.abs(ball.vx) * constants.bounce;
      }

      // Collisions with pins
      const pins = pinsRef.current;
      for (const p of pins) {
        const rr = ball.r + p.r;
        if (dist2(ball.x, ball.y, p.x, p.y) <= rr * rr) {
          const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
          if (speed > 3.2) p.down = true;

          // Give pin some impulse
          const dx = p.x - ball.x;
          const dy = p.y - ball.y;
          const len = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
          const nx = dx / len;
          const ny = dy / len;
          p.vx += nx * speed * constants.impulse;
          p.vy += ny * speed * constants.impulse;
          p.angularV += (ball.vx * ny - ball.vy * nx) * constants.pinSpinImpulse;

          // Ball loses some energy
          ball.vx *= 0.82;
          ball.vy *= 0.82;
        }
      }

      // Pin-pin chain collisions
      for (let i = 0; i < pins.length; i++) {
        for (let j = i + 1; j < pins.length; j++) {
          const a = pins[i]!;
          const b = pins[j]!;
          const collided = resolveDiscCollision(a, b, 0.72);
          if (collided) {
            a.down = true;
            b.down = true;
            a.angularV += (b.vx - a.vx) * 0.015;
            b.angularV += (a.vx - b.vx) * 0.015;
          }
        }
      }

      // Update pins movement and tilt
      for (const p of pins) {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 0.65) p.down = true;

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(constants.pinFriction, dt);
        p.vy *= Math.pow(constants.pinFriction, dt);
        p.angle += p.angularV * dt;
        p.angularV *= Math.pow(constants.angularFriction, dt);

        if (p.down) {
          const targetTilt = p.vx >= 0 ? 0.65 : -0.65;
          p.angle = p.angle * 0.92 + targetTilt * 0.08;
        } else {
          p.angle *= 0.85;
        }
      }

      // End condition: ball slows enough or leaves play area
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (speed < 0.35 || ball.y < h * 0.08) {
        updatePhase('done');
        computeScore();
      }
    }

    draw();
  };

  useEffect(() => {
    resizeCanvas();
    reset();
    rafRef.current = window.requestAnimationFrame(step);
    const ro = new ResizeObserver(() => {
      resizeCanvas();
      // Keep current state but redraw nicely
      draw();
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      ro.disconnect();
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== 'aim') return;
    const canvas = canvasRef.current;
    const ball = ballRef.current;
    if (!canvas || !ball) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    aimStartRef.current = { x, y };
    aimNowRef.current = { x, y };
    setAimStart({ x, y });
    setAimNow({ x, y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (phaseRef.current !== 'aim') return;
    if (!aimStartRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    aimNowRef.current = { x, y };
    setAimNow({ x, y });
  };

  const onPointerUp = () => {
    if (phaseRef.current !== 'aim') return;
    const ball = ballRef.current;
    if (!ball || !aimStartRef.current || !aimNowRef.current) return;

    const dx = aimNowRef.current.x - ball.x;
    const dy = aimNowRef.current.y - ball.y;
    const len = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));

    // We only allow shooting "upwards" (toward pins). If dragging downward, clamp.
    const ndx = dx / len;
    const ndy = dy / len;
    const upBias = ndy > -0.1 ? -0.1 : ndy;

    // Power based on drag length
    const power = clamp(len / 10, constants.minPower, constants.maxPower);

    ball.vx = ndx * power;
    ball.vy = upBias * power;
    ball.spin = clamp((aimNowRef.current.x - ball.x) / 26, -2.4, 2.4);
    ball.moving = true;

    aimStartRef.current = null;
    aimNowRef.current = null;
    setAimStart(null);
    setAimNow(null);
    updatePhase('rolling');
  };

  const reward = score === null ? null : getReward(score);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-zinc-800">볼링 1프레임(1샷) 테스트</h3>
            <p className="text-sm text-zinc-500 mt-1 font-medium">
              드래그로 공을 1번만 던져서 핀을 쓰러뜨립니다. 점수(0~10)에 따라 보상을 확인하세요.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-bold text-zinc-700"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">현재 상태</div>
            <div className="mt-2 text-lg font-black text-zinc-800">
              {phase === 'aim' ? '조준 중(드래그)' : phase === 'rolling' ? '굴러가는 중…' : '종료'}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">점수 / 보상</div>
            <div className="mt-2 text-lg font-black text-zinc-800">
              {score === null ? '-' : `${score}점`}
            </div>
            <div className="mt-1 text-sm font-bold text-pink-600">
              {reward ? `${reward.scoreRange}점: ${reward.label}` : '0~2 무료1게임 / 3~5 음료 / 6~8 스낵 / 9~10 2000point'}
            </div>
          </div>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-3xl border border-zinc-200 bg-black shadow-md"
        style={{ aspectRatio: '3 / 4', minHeight: 520 }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
}

