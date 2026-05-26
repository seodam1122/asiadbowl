import { buildCouponDownloadPageUrl } from './coupon-download-url';

export async function generateCouponQrDataUrl(
  couponCode: string,
  origin?: string
): Promise<string> {
  const { default: QRCode } = await import('qrcode');
  const url = buildCouponDownloadPageUrl(couponCode, origin);
  return QRCode.toDataURL(url, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#18181b', light: '#ffffff' },
  });
}
