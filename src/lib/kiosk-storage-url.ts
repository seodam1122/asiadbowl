export const KIOSK_MEDIA_BUCKET = 'kiosk-media';

/** Storage 공개 URL (Supabase 표준 형식) */
export function buildKioskMediaPublicUrl(objectPath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
  }
  const path = objectPath.replace(/^\//, '');
  return `${base}/storage/v1/object/public/${KIOSK_MEDIA_BUCKET}/${path}`;
}

/** 업로드 성공 시 받는 URL 형식인지 확인 */
export function isKioskStoragePublicUrl(url: string): boolean {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }
  try {
    const parsed = new URL(url.split('?')[0]);
    return (
      parsed.pathname.includes('/storage/v1/object/public/kiosk-media/') ||
      parsed.pathname.includes('/storage/v1/object/public/kiosk-media')
    );
  } catch {
    return false;
  }
}

export function stripUrlCacheBust(url: string): string {
  return url.split('?')[0];
}

/** 브라우저에만 있는 임시 이미지 (Storage URL 아님) */
export function isEmbeddedImageData(url: string): boolean {
  return url.startsWith('data:') || url.startsWith('local-media:');
}
