export type Rng = () => number;

/**
 * Deterministic RNG (Mulberry32).
 * Same seed => same scene/differences every time.
 */
export function createRng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export type NormalizedPoint = { x: number; y: number };

export type DifferenceRegion = {
  id: number;
  label: string;
  /** normalized center (0..1) */
  center: NormalizedPoint;
  /** normalized radius (0..1), relative to min(width,height) */
  radius: number;
};

type SceneParams = {
  seed: number;
  /** "easier" means larger targets */
  difficulty?: 'easy';
};

/**
 * Generates a friendly, easy-to-read "scene" and three difference regions.
 * Everything is drawn programmatically so there are no external image dependencies.
 */
export function buildSpotDiffScene(params: SceneParams): {
  seed: number;
  differences: DifferenceRegion[];
  drawBase: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  drawModified: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
} {
  const rng = createRng(params.seed);

  // Use seed to pick one of 10 distinct "scene templates"
  const templateIndex = ((params.seed % 10) + 10) % 10;

  const palette = pick(rng, [
    { a: '#0ea5e9', b: '#6366f1', c: '#0b1020' },
    { a: '#22c55e', b: '#06b6d4', c: '#0b1020' },
    { a: '#f97316', b: '#ec4899', c: '#0b1020' },
  ]);

  // Differences vary by template so it feels like "different images"
  const diffs: DifferenceRegion[] = (() => {
    const R = 0.075; // easy target
    switch (templateIndex) {
      case 0:
        return [
          { id: 1, label: '색이 다른 풍선', center: { x: 0.26, y: 0.28 }, radius: R },
          { id: 2, label: '추가된 별', center: { x: 0.74, y: 0.33 }, radius: R },
          { id: 3, label: '모양이 다른 깃발', center: { x: 0.52, y: 0.76 }, radius: R },
        ];
      case 1:
        return [
          { id: 1, label: '다른 색 물고기', center: { x: 0.22, y: 0.62 }, radius: R },
          { id: 2, label: '추가된 조개', center: { x: 0.78, y: 0.72 }, radius: R },
          { id: 3, label: '다른 모양 돛', center: { x: 0.58, y: 0.34 }, radius: R },
        ];
      case 2:
        return [
          { id: 1, label: '달의 크기', center: { x: 0.22, y: 0.22 }, radius: R },
          { id: 2, label: '추가된 별똥별', center: { x: 0.72, y: 0.34 }, radius: R },
          { id: 3, label: '다른 색 행성', center: { x: 0.55, y: 0.70 }, radius: R },
        ];
      case 3:
        return [
          { id: 1, label: '다른 잎사귀', center: { x: 0.24, y: 0.40 }, radius: R },
          { id: 2, label: '추가된 버섯', center: { x: 0.80, y: 0.78 }, radius: R },
          { id: 3, label: '다른 색 새', center: { x: 0.70, y: 0.24 }, radius: R },
        ];
      case 4:
        return [
          { id: 1, label: '다른 색 머그컵', center: { x: 0.28, y: 0.70 }, radius: R },
          { id: 2, label: '추가된 쿠키', center: { x: 0.78, y: 0.76 }, radius: R },
          { id: 3, label: '다른 모양 스팀', center: { x: 0.58, y: 0.34 }, radius: R },
        ];
      case 5:
        return [
          { id: 1, label: '다른 색 창문', center: { x: 0.26, y: 0.52 }, radius: R },
          { id: 2, label: '추가된 표지판', center: { x: 0.78, y: 0.72 }, radius: R },
          { id: 3, label: '다른 색 자동차', center: { x: 0.55, y: 0.84 }, radius: R },
        ];
      case 6:
        return [
          { id: 1, label: '다른 색 나비', center: { x: 0.26, y: 0.30 }, radius: R },
          { id: 2, label: '추가된 꽃', center: { x: 0.78, y: 0.72 }, radius: R },
          { id: 3, label: '다른 색 연', center: { x: 0.60, y: 0.46 }, radius: R },
        ];
      case 7:
        return [
          { id: 1, label: '다른 색 선물상자', center: { x: 0.26, y: 0.72 }, radius: R },
          { id: 2, label: '추가된 리본', center: { x: 0.78, y: 0.64 }, radius: R },
          { id: 3, label: '다른 색 풍선', center: { x: 0.58, y: 0.28 }, radius: R },
        ];
      case 8:
        return [
          { id: 1, label: '다른 색 책', center: { x: 0.28, y: 0.74 }, radius: R },
          { id: 2, label: '추가된 연필', center: { x: 0.78, y: 0.72 }, radius: R },
          { id: 3, label: '다른 색 스탠드', center: { x: 0.58, y: 0.34 }, radius: R },
        ];
      default:
        return [
          { id: 1, label: '다른 색 눈사람', center: { x: 0.28, y: 0.66 }, radius: R },
          { id: 2, label: '추가된 눈송이', center: { x: 0.76, y: 0.30 }, radius: R },
          { id: 3, label: '다른 색 모자', center: { x: 0.54, y: 0.34 }, radius: R },
        ];
    }
  })();

  const strokeFrame = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.008));
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
  };

  const drawCommonSkyCity = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, palette.a);
    bg.addColorStop(1, palette.b);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Soft clouds
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 8; i++) {
      const cx = (rng() * 1.2 - 0.1) * w;
      const cy = (0.05 + rng() * 0.35) * h;
      const r = (0.08 + rng() * 0.12) * Math.min(w, h);
      const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cute city silhouette at bottom
    const baseY = h * 0.78;
    ctx.fillStyle = palette.c;
    ctx.fillRect(0, baseY, w, h - baseY);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let x = 0; x < w; x += Math.max(14, Math.round(w * 0.03))) {
      const bh = (0.06 + rng() * 0.18) * h;
      ctx.fillRect(x, baseY - bh, Math.max(10, Math.round(w * 0.018)), bh);
    }

    // Polka dots overlay
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffffff';
    const step = Math.max(20, Math.round(Math.min(w, h) * 0.08));
    for (let y = step / 2; y < baseY; y += step) {
      for (let x = step / 2; x < w; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.5, step * 0.06), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    strokeFrame(ctx, w, h);
  };

  const drawBalloon = (ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number, color: string) => {
    const s = Math.min(w, h);
    const r = s * 0.06;
    ctx.save();
    ctx.translate(cx, cy);
    // Balloon
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.15, color);
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.9, r * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Knot
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, r * 0.95);
    ctx.lineTo(r * 0.12, r * 0.95);
    ctx.lineTo(0, r * 1.18);
    ctx.closePath();
    ctx.fill();
    // String
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = Math.max(1, s * 0.003);
    ctx.beginPath();
    ctx.moveTo(0, r * 1.18);
    ctx.bezierCurveTo(r * 0.2, r * 1.7, -r * 0.2, r * 2.1, 0, r * 2.8);
    ctx.stroke();
    ctx.restore();
  };

  const drawStar = (ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number, size: number, color: string) => {
    const s = Math.min(w, h) * size;
    const spikes = 5;
    const outerR = s;
    const innerR = s * 0.45;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (Math.PI / spikes) * i - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = s * 0.25;
    ctx.fill();
    ctx.restore();
  };

  const drawFlag = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    cy: number,
    variant: 'triangle' | 'swallowtail',
  ) => {
    const s = Math.min(w, h);
    const poleH = s * 0.18;
    const poleW = Math.max(2, s * 0.006);
    const flagW = s * 0.12;
    const flagH = s * 0.07;
    ctx.save();
    ctx.translate(cx, cy);
    // Pole
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(-poleW / 2, -poleH / 2, poleW, poleH);
    // Flag
    ctx.fillStyle = 'rgba(236,72,153,0.9)'; // pink
    ctx.beginPath();
    ctx.moveTo(0, -poleH * 0.25);
    ctx.lineTo(flagW, -poleH * 0.25 + flagH / 2);
    if (variant === 'triangle') {
      ctx.lineTo(0, -poleH * 0.25 + flagH);
    } else {
      // swallowtail notch
      ctx.lineTo(flagW * 0.7, -poleH * 0.25 + flagH * 0.5);
      ctx.lineTo(0, -poleH * 0.25 + flagH);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawOcean = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, '#38bdf8');
    sky.addColorStop(1, '#a5f3fc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const seaTop = h * 0.48;
    const sea = ctx.createLinearGradient(0, seaTop, 0, h);
    sea.addColorStop(0, '#0ea5e9');
    sea.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = sea;
    ctx.fillRect(0, seaTop, w, h - seaTop);

    // Waves
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.004));
    for (let i = 0; i < 7; i++) {
      const y = seaTop + (i + 1) * (h - seaTop) / 10;
      ctx.beginPath();
      for (let x = -20; x <= w + 20; x += 30) {
        ctx.quadraticCurveTo(x + 15, y - 6, x + 30, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    strokeFrame(ctx, w, h);
  };

  const drawSpace = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0b1020');
    bg.addColorStop(1, '#1f1147');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // Stars field
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    const count = 70;
    for (let i = 0; i < count; i++) {
      const x = rng() * w;
      const y = rng() * h * 0.8;
      const r = 0.6 + rng() * 1.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    strokeFrame(ctx, w, h);
  };

  const drawForest = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#bbf7d0');
    sky.addColorStop(1, '#34d399');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const groundY = h * 0.75;
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, groundY, w, h - groundY);
    // Trees
    for (let i = 0; i < 10; i++) {
      const x = (i + 0.5) * (w / 10);
      const trunkH = h * (0.10 + rng() * 0.08);
      const trunkW = Math.max(6, w * 0.012);
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);
      const crownR = h * (0.06 + rng() * 0.05);
      ctx.fillStyle = 'rgba(22,163,74,0.95)';
      ctx.beginPath();
      ctx.arc(x, groundY - trunkH, crownR, 0, Math.PI * 2);
      ctx.fill();
    }
    strokeFrame(ctx, w, h);
  };

  const drawCafe = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff7ed';
    ctx.fillRect(0, 0, w, h);
    // Table
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    // Wall pattern
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#0f172a';
    const step = Math.max(22, Math.round(Math.min(w, h) * 0.07));
    for (let y = 0; y < h * 0.6; y += step) {
      for (let x = 0; x < w; x += step) {
        ctx.fillRect(x, y, step * 0.45, step * 0.45);
      }
    }
    ctx.globalAlpha = 1;
    strokeFrame(ctx, w, h);
  };

  const drawCityStreet = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(0, 0, w, h);
    // Buildings
    for (let i = 0; i < 6; i++) {
      const bx = (i * w) / 6;
      const bw = w / 6 - 8;
      const bh = h * (0.35 + rng() * 0.25);
      ctx.fillStyle = i % 2 === 0 ? '#94a3b8' : '#64748b';
      ctx.fillRect(bx + 4, h * 0.6 - bh, bw, bh);
    }
    // Road
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(2, h * 0.01);
    ctx.setLineDash([20, 16]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.8);
    ctx.lineTo(w, h * 0.8);
    ctx.stroke();
    ctx.setLineDash([]);
    strokeFrame(ctx, w, h);
  };

  const drawPark = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#bae6fd');
    sky.addColorStop(1, '#38bdf8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const grassY = h * 0.72;
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(0, grassY, w, h - grassY);
    // Flowers
    for (let i = 0; i < 16; i++) {
      const x = rng() * w;
      const y = grassY + rng() * (h - grassY);
      ctx.fillStyle = i % 2 ? '#fb7185' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(x, y, 4 + rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    strokeFrame(ctx, w, h);
  };

  const drawParty = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#fde047');
    bg.addColorStop(1, '#f472b6');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // Confetti
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = pick(rng, ['#60a5fa', '#34d399', '#fb7185', '#fbbf24', '#a78bfa']);
      ctx.fillRect(rng() * w, rng() * h, 3 + rng() * 6, 3 + rng() * 6);
    }
    strokeFrame(ctx, w, h);
  };

  const drawStudy = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, h * 0.70, w, h * 0.30); // desk
    // Notebook lines
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    for (let y = h * 0.08; y < h * 0.62; y += 18) {
      ctx.beginPath();
      ctx.moveTo(w * 0.08, y);
      ctx.lineTo(w * 0.92, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    strokeFrame(ctx, w, h);
  };

  const drawSnow = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#e0f2fe');
    sky.addColorStop(1, '#93c5fd');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, h * 0.74, w, h * 0.26);
    // Snowflakes
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 80; i++) {
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 0.8 + rng() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    strokeFrame(ctx, w, h);
  };

  const drawTemplateBackground = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    switch (templateIndex) {
      case 0:
        drawCommonSkyCity(ctx, w, h);
        return;
      case 1:
        drawOcean(ctx, w, h);
        return;
      case 2:
        drawSpace(ctx, w, h);
        return;
      case 3:
        drawForest(ctx, w, h);
        return;
      case 4:
        drawCafe(ctx, w, h);
        return;
      case 5:
        drawCityStreet(ctx, w, h);
        return;
      case 6:
        drawPark(ctx, w, h);
        return;
      case 7:
        drawParty(ctx, w, h);
        return;
      case 8:
        drawStudy(ctx, w, h);
        return;
      default:
        drawSnow(ctx, w, h);
        return;
    }
  };

  const drawBase = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    drawTemplateBackground(ctx, w, h);
    // Per-template base objects (keep it visually distinct)
    switch (templateIndex) {
      case 0:
        drawBalloon(ctx, w, h, diffs[0]!.center.x * w, diffs[0]!.center.y * h, '#38bdf8');
        for (let i = 0; i < 4; i++) {
          drawStar(ctx, w, h, (0.1 + rng() * 0.8) * w, (0.12 + rng() * 0.45) * h, 0.018, 'rgba(255,255,255,0.55)');
        }
        drawFlag(ctx, w, h, diffs[2]!.center.x * w, diffs[2]!.center.y * h, 'triangle');
        return;
      case 1: {
        // Boat + fish
        const cx = diffs[2]!.center.x * w;
        const cy = diffs[2]!.center.y * h;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(cx - 70, cy);
        ctx.lineTo(cx + 70, cy);
        ctx.lineTo(cx + 40, cy + 28);
        ctx.lineTo(cx - 40, cy + 28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 4, cy - 88, 8, 88);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 80);
        ctx.lineTo(cx + 56, cy - 40);
        ctx.lineTo(cx, cy - 40);
        ctx.closePath();
        ctx.fill();
        // Fish (base)
        ctx.fillStyle = '#38bdf8';
        const fx = diffs[0]!.center.x * w;
        const fy = diffs[0]!.center.y * h;
        ctx.beginPath();
        ctx.ellipse(fx, fy, 22, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case 2: {
        // Planets
        const moon = diffs[0]!;
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(moon.center.x * w, moon.center.y * h, 22, 0, Math.PI * 2);
        ctx.fill();
        const planet = diffs[3 - 1]!;
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.arc(planet.center.x * w, planet.center.y * h, 28, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case 3: {
        // Leaf + bird
        const leaf = diffs[0]!;
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(leaf.center.x * w, leaf.center.y * h, 26, 16, -0.6, 0, Math.PI * 2);
        ctx.fill();
        const bird = diffs[2]!;
        ctx.fillStyle = '#0ea5e9';
        ctx.beginPath();
        ctx.arc(bird.center.x * w, bird.center.y * h, 14, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case 4: {
        // Mug + steam
        const mug = diffs[0]!;
        const mx = mug.center.x * w;
        const my = mug.center.y * h;
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(mx - 34, my - 26, 68, 58);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(mx + 38, my, 16, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        return;
      }
      case 5: {
        // Car + window lights
        const car = diffs[2]!;
        const x = car.center.x * w;
        const y = car.center.y * h;
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(x - 56, y - 18, 112, 36);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - 18, y - 42, 56, 24);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(x - 34, y + 20, 12, 0, Math.PI * 2);
        ctx.arc(x + 34, y + 20, 12, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case 6: {
        // Butterfly + kite
        const b = diffs[0]!;
        const bx = b.center.x * w;
        const by = b.center.y * h;
        ctx.fillStyle = '#a78bfa';
        ctx.beginPath();
        ctx.arc(bx - 14, by, 14, 0, Math.PI * 2);
        ctx.arc(bx + 14, by, 14, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case 7: {
        // Gift + balloon
        const g = diffs[0]!;
        const gx = g.center.x * w;
        const gy = g.center.y * h;
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(gx - 40, gy - 34, 80, 68);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(gx - 6, gy - 34, 12, 68);
        ctx.fillRect(gx - 40, gy - 6, 80, 12);
        return;
      }
      case 8: {
        // Lamp + book
        const lamp = diffs[2]!;
        const lx = lamp.center.x * w;
        const ly = lamp.center.y * h;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(lx - 8, ly - 40, 16, 70);
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(lx - 50, ly - 40);
        ctx.lineTo(lx + 50, ly - 40);
        ctx.lineTo(lx + 26, ly - 80);
        ctx.lineTo(lx - 26, ly - 80);
        ctx.closePath();
        ctx.fill();
        return;
      }
      default: {
        // Snowman
        const s = diffs[0]!;
        const x = s.center.x * w;
        const y = s.center.y * h;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y + 28, 28, 0, Math.PI * 2);
        ctx.arc(x, y - 10, 20, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
    }
  };

  const drawModified = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    drawTemplateBackground(ctx, w, h);
    switch (templateIndex) {
      case 0:
        drawBalloon(ctx, w, h, diffs[0]!.center.x * w, diffs[0]!.center.y * h, '#fb7185'); // changed
        drawStar(ctx, w, h, diffs[1]!.center.x * w, diffs[1]!.center.y * h, 0.030, '#fde047'); // added
        for (let i = 0; i < 4; i++) {
          drawStar(ctx, w, h, (0.1 + rng() * 0.8) * w, (0.12 + rng() * 0.45) * h, 0.018, 'rgba(255,255,255,0.55)');
        }
        drawFlag(ctx, w, h, diffs[2]!.center.x * w, diffs[2]!.center.y * h, 'swallowtail'); // changed
        return;
      case 1: {
        // Boat sail shape changed + shell added + fish recolored
        const cx = diffs[2]!.center.x * w;
        const cy = diffs[2]!.center.y * h;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(cx - 70, cy);
        ctx.lineTo(cx + 70, cy);
        ctx.lineTo(cx + 40, cy + 28);
        ctx.lineTo(cx - 40, cy + 28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 4, cy - 88, 8, 88);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        // different sail
        ctx.moveTo(cx, cy - 80);
        ctx.lineTo(cx + 68, cy - 48);
        ctx.lineTo(cx, cy - 24);
        ctx.closePath();
        ctx.fill();
        // Fish changed color
        ctx.fillStyle = '#fb7185';
        const fx = diffs[0]!.center.x * w;
        const fy = diffs[0]!.center.y * h;
        ctx.beginPath();
        ctx.ellipse(fx, fy, 22, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        // Shell added
        const sh = diffs[1]!;
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(sh.center.x * w, sh.center.y * h, 16, 0, Math.PI);
        ctx.fill();
        return;
      }
      case 2: {
        // Moon bigger/smaller + meteor + planet recolor
        const moon = diffs[0]!;
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(moon.center.x * w, moon.center.y * h, 30, 0, Math.PI * 2);
        ctx.fill();
        const planet = diffs[2]!;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(planet.center.x * w, planet.center.y * h, 28, 0, Math.PI * 2);
        ctx.fill();
        const meteor = diffs[1]!;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(meteor.center.x * w - 45, meteor.center.y * h - 25);
        ctx.lineTo(meteor.center.x * w + 45, meteor.center.y * h + 25);
        ctx.stroke();
        return;
      }
      case 3: {
        // Leaf different + mushroom added + bird recolor
        const leaf = diffs[0]!;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.ellipse(leaf.center.x * w, leaf.center.y * h, 26, 16, -0.6, 0, Math.PI * 2);
        ctx.fill();
        const mush = diffs[1]!;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(mush.center.x * w, mush.center.y * h, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mush.center.x * w - 6, mush.center.y * h + 8, 12, 18);
        const bird = diffs[2]!;
        ctx.fillStyle = '#a78bfa';
        ctx.beginPath();
        ctx.arc(bird.center.x * w, bird.center.y * h, 14, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case 4: {
        // Mug recolor + cookie add + steam shape change
        const mug = diffs[0]!;
        const mx = mug.center.x * w;
        const my = mug.center.y * h;
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(mx - 34, my - 26, 68, 58);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(mx + 38, my, 16, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        const steam = diffs[2]!;
        ctx.strokeStyle = 'rgba(15,23,42,0.55)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(steam.center.x * w - 18, steam.center.y * h + 18);
        ctx.bezierCurveTo(steam.center.x * w - 8, steam.center.y * h - 10, steam.center.x * w - 2, steam.center.y * h - 24, steam.center.x * w + 14, steam.center.y * h - 38);
        ctx.stroke();
        const cookie = diffs[1]!;
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(cookie.center.x * w, cookie.center.y * h, 18, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case 5: {
        // Window different + sign add + car recolor
        const car = diffs[2]!;
        const x = car.center.x * w;
        const y = car.center.y * h;
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(x - 56, y - 18, 112, 36);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - 18, y - 42, 56, 24);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(x - 34, y + 20, 12, 0, Math.PI * 2);
        ctx.arc(x + 34, y + 20, 12, 0, Math.PI * 2);
        ctx.fill();
        const sign = diffs[1]!;
        ctx.fillStyle = '#fde047';
        ctx.fillRect(sign.center.x * w - 24, sign.center.y * h - 16, 48, 32);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px system-ui, -apple-system, Segoe UI, Roboto, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('STOP', sign.center.x * w, sign.center.y * h);
        const win = diffs[0]!;
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(win.center.x * w - 10, win.center.y * h - 10, 20, 20);
        return;
      }
      case 6: {
        // Butterfly recolor + flower add + kite recolor
        const b = diffs[0]!;
        const bx = b.center.x * w;
        const by = b.center.y * h;
        ctx.fillStyle = '#fb7185';
        ctx.beginPath();
        ctx.arc(bx - 14, by, 14, 0, Math.PI * 2);
        ctx.arc(bx + 14, by, 14, 0, Math.PI * 2);
        ctx.fill();
        const flower = diffs[1]!;
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(flower.center.x * w, flower.center.y * h, 14, 0, Math.PI * 2);
        ctx.fill();
        const kite = diffs[2]!;
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.moveTo(kite.center.x * w, kite.center.y * h - 22);
        ctx.lineTo(kite.center.x * w + 22, kite.center.y * h);
        ctx.lineTo(kite.center.x * w, kite.center.y * h + 22);
        ctx.lineTo(kite.center.x * w - 22, kite.center.y * h);
        ctx.closePath();
        ctx.fill();
        return;
      }
      case 7: {
        // Gift recolor + ribbon add + balloon recolor
        const g = diffs[0]!;
        const gx = g.center.x * w;
        const gy = g.center.y * h;
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(gx - 40, gy - 34, 80, 68);
        const ribbon = diffs[1]!;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(ribbon.center.x * w, ribbon.center.y * h, 18, 0, Math.PI * 2);
        ctx.stroke();
        const bal = diffs[2]!;
        drawBalloon(ctx, w, h, bal.center.x * w, bal.center.y * h, '#60a5fa');
        return;
      }
      case 8: {
        // Book recolor + pencil add + lamp recolor
        const lamp = diffs[2]!;
        const lx = lamp.center.x * w;
        const ly = lamp.center.y * h;
        ctx.fillStyle = '#111827';
        ctx.fillRect(lx - 8, ly - 40, 16, 70);
        ctx.fillStyle = '#fb7185';
        ctx.beginPath();
        ctx.moveTo(lx - 50, ly - 40);
        ctx.lineTo(lx + 50, ly - 40);
        ctx.lineTo(lx + 26, ly - 80);
        ctx.lineTo(lx - 26, ly - 80);
        ctx.closePath();
        ctx.fill();
        const pencil = diffs[1]!;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(pencil.center.x * w - 30, pencil.center.y * h + 30);
        ctx.lineTo(pencil.center.x * w + 30, pencil.center.y * h - 30);
        ctx.stroke();
        const book = diffs[0]!;
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(book.center.x * w - 28, book.center.y * h - 18, 56, 36);
        return;
      }
      default: {
        // Snowman hat color + snowflake add + body tint
        const s = diffs[0]!;
        const x = s.center.x * w;
        const y = s.center.y * h;
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.arc(x, y + 28, 28, 0, Math.PI * 2);
        ctx.arc(x, y - 10, 20, 0, Math.PI * 2);
        ctx.fill();
        const hat = diffs[2]!;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(hat.center.x * w - 20, hat.center.y * h - 14, 40, 18);
        ctx.fillRect(hat.center.x * w - 28, hat.center.y * h + 4, 56, 8);
        const flake = diffs[1]!;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(flake.center.x * w - 16, flake.center.y * h);
        ctx.lineTo(flake.center.x * w + 16, flake.center.y * h);
        ctx.moveTo(flake.center.x * w, flake.center.y * h - 16);
        ctx.lineTo(flake.center.x * w, flake.center.y * h + 16);
        ctx.stroke();
        return;
      }
    }
  };

  return { seed: params.seed, differences: diffs, drawBase, drawModified };
}

export type HiddenItemTarget = {
  id: number;
  name: string;
  symbol: string;
  center: NormalizedPoint;
  radius: number;
};

export function buildHiddenObjectScene(params: SceneParams): {
  seed: number;
  items: HiddenItemTarget[];
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, foundIds: number[]) => void;
} {
  const rng = createRng(params.seed);

  const items: HiddenItemTarget[] = [
    {
      id: 1,
      name: '작은 별',
      symbol: '★',
      center: { x: 0.22 + rng() * 0.18, y: 0.56 + rng() * 0.14 },
      radius: 0.07,
    },
    {
      id: 2,
      name: '하트',
      symbol: '♥',
      center: { x: 0.72 + rng() * 0.14, y: 0.34 + rng() * 0.16 },
      radius: 0.07,
    },
    {
      id: 3,
      name: '다이아',
      symbol: '◆',
      center: { x: 0.48 + rng() * 0.16, y: 0.78 + rng() * 0.12 },
      radius: 0.07,
    },
  ];

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, foundIds: number[]) => {
    ctx.clearRect(0, 0, w, h);

    // Warm illustrated background
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#f59e0b');
    bg.addColorStop(0.5, '#ec4899');
    bg.addColorStop(1, '#6366f1');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Noise dots (gives texture)
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    const step = Math.max(18, Math.round(Math.min(w, h) * 0.06));
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.2, step * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Big shapes layer to "hide" objects
    for (let i = 0; i < 10; i++) {
      const cx = (rng() * 1.1 - 0.05) * w;
      const cy = (rng() * 1.1 - 0.05) * h;
      const r = (0.08 + rng() * 0.18) * Math.min(w, h);
      const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw hidden symbols (subtle)
    const baseSize = Math.min(w, h) * 0.085;
    for (const item of items) {
      const found = foundIds.includes(item.id);
      const x = item.center.x * w;
      const y = item.center.y * h;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rng() - 0.5) * 0.35);
      ctx.font = `900 ${Math.round(baseSize)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (found) {
        ctx.fillStyle = 'rgba(16,185,129,0.95)';
        ctx.shadowColor = 'rgba(16,185,129,0.45)';
        ctx.shadowBlur = baseSize * 0.4;
      } else {
        // subtle: low alpha + slight blur-like effect by drawing twice
        ctx.fillStyle = 'rgba(15,23,42,0.32)';
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = baseSize * 0.12;
      }

      ctx.fillText(item.symbol, 0, 0);
      if (!found) {
        ctx.globalAlpha = 0.6;
        ctx.fillText(item.symbol, 1.5, 1.5);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // Frame
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.008));
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
  };

  return { seed: params.seed, items, draw };
}

