import {
  isDataUrl,
  isLocalMediaRef,
  localMediaKeyFromRef,
  localMediaStore,
} from './local-media-store';
import { formatCouponExpiryLabel } from './coupon-expiry';

export interface CouponImageInput {
  prizeName: string;
  prizeImageUrl: string;
  couponCode: string;
  eventTitle?: string;
  /** 쿠폰 발행일(ISO). 사용기한(발행일+7일) 표기에 사용 */
  createdAt?: string;
}

const CARD_WIDTH = 900;
const CARD_HEIGHT = 1280;

async function resolvePrizeImageUrl(imageUrl: string): Promise<string> {
  if (isDataUrl(imageUrl) || imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  if (isLocalMediaRef(imageUrl)) {
    const stored = await localMediaStore.get(localMediaKeyFromRef(imageUrl));
    if (stored) return stored;
  }
  return imageUrl;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('경품 이미지를 불러올 수 없습니다.'));
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPlaceholderPrize(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  roundRect(ctx, x, y, size, size, 32);
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, '#fbcfe8');
  gradient.addColorStop(1, '#c7d2fe');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎁', x + size / 2, y + size / 2);
}

/** 당첨 쿠폰 카드 PNG 생성 (경품 이미지 + 쿠폰번호 + QR) */
export async function generateCouponImageBlob(input: CouponImageInput): Promise<Blob> {
  const { prizeName, couponCode, eventTitle = '이벤트 당첨 쿠폰', createdAt } = input;
  const expiryLabel = createdAt ? formatCouponExpiryLabel(createdAt) : '';
  const resolvedUrl = await resolvePrizeImageUrl(input.prizeImageUrl);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스를 생성할 수 없습니다.');
  }

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  bg.addColorStop(0, '#fdf2f8');
  bg.addColorStop(0.5, '#ffffff');
  bg.addColorStop(1, '#eef2ff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Header band
  ctx.fillStyle = '#18181b';
  roundRect(ctx, 48, 48, CARD_WIDTH - 96, 100, 24);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(eventTitle, CARD_WIDTH / 2, 98);

  // Prize image area
  const imageSize = 480;
  const imageX = (CARD_WIDTH - imageSize) / 2;
  const imageY = 200;

  try {
    const prizeImg = await loadImage(resolvedUrl);
    ctx.save();
    roundRect(ctx, imageX, imageY, imageSize, imageSize, 32);
    ctx.clip();
    const scale = Math.max(imageSize / prizeImg.width, imageSize / prizeImg.height);
    const sw = prizeImg.width * scale;
    const sh = prizeImg.height * scale;
    const sx = imageX + (imageSize - sw) / 2;
    const sy = imageY + (imageSize - sh) / 2;
    ctx.drawImage(prizeImg, sx, sy, sw, sh);
    ctx.restore();
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 4;
    roundRect(ctx, imageX, imageY, imageSize, imageSize, 32);
    ctx.stroke();
  } catch {
    drawPlaceholderPrize(ctx, imageX, imageY, imageSize);
  }

  // Prize name
  ctx.fillStyle = '#3f3f46';
  ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(prizeName, CARD_WIDTH / 2, imageY + imageSize + 64, CARD_WIDTH - 120);

  // Coupon code box
  const codeBoxY = imageY + imageSize + 110;
  roundRect(ctx, 80, codeBoxY, CARD_WIDTH - 160, 120, 20);
  ctx.fillStyle = '#fdf2f8';
  ctx.fill();
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#9d174d';
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText('쿠폰 번호', CARD_WIDTH / 2, codeBoxY + 38);

  ctx.fillStyle = '#831843';
  ctx.font = 'bold 52px ui-monospace, monospace';
  ctx.fillText(couponCode, CARD_WIDTH / 2, codeBoxY + 88);

  // QR code (쿠폰 번호 인코딩)
  const qrSize = 220;
  const qrX = (CARD_WIDTH - qrSize) / 2;
  const qrY = codeBoxY + 160;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 16);
  ctx.fill();
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 2;
  ctx.stroke();

  try {
    const { default: QRCode } = await import('qrcode');
    const qrDataUrl = await QRCode.toDataURL(couponCode, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: { dark: '#18181b', light: '#ffffff' },
    });
    const qrImg = await loadImage(qrDataUrl);
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } catch {
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QR', CARD_WIDTH / 2, qrY + qrSize / 2 - 12);
    ctx.font = '500 18px system-ui, sans-serif';
    ctx.fillText(couponCode, CARD_WIDTH / 2, qrY + qrSize / 2 + 20, qrSize - 8);
  }

  ctx.fillStyle = '#71717a';
  ctx.font = '500 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QR 스캔 · 쿠폰 번호 확인', CARD_WIDTH / 2, qrY + qrSize + 44);

  // 사용기한 (발행일 + 7일)
  if (expiryLabel) {
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(expiryLabel, CARD_WIDTH / 2, qrY + qrSize + 92);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('이미지 파일을 만들 수 없습니다.'));
      },
      'image/png',
      1
    );
  });
}

export function downloadCouponImageBlob(blob: Blob, couponCode: string): void {
  const safeName = couponCode.replace(/[^a-zA-Z0-9-]/g, '_');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `coupon-${safeName}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function generateAndDownloadCouponImage(input: CouponImageInput): Promise<void> {
  const blob = await generateCouponImageBlob(input);
  downloadCouponImageBlob(blob, input.couponCode);
}
