/** 휴대폰 QR 스캔 시 열리는 쿠폰 이미지 다운로드 페이지 URL */
export function buildCouponDownloadPageUrl(couponCode: string, origin?: string): string {
  const base =
    origin?.replace(/\/$/, '') ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3010'));

  return `${base}/coupon?c=${encodeURIComponent(couponCode)}`;
}
