import { supabase, isSupabaseConfigured } from './supabase';
import {
  buildKioskMediaPublicUrl,
  isKioskStoragePublicUrl,
  KIOSK_MEDIA_BUCKET,
} from './kiosk-storage-url';
import {
  isDataUrl,
  isLocalMediaRef,
  localMediaKeyFromRef,
  localMediaStore,
} from './local-media-store';

async function readImageSource(imageUrl: string): Promise<string> {
  if (isLocalMediaRef(imageUrl)) {
    const stored = await localMediaStore.get(localMediaKeyFromRef(imageUrl));
    if (stored) return stored;
    throw new Error('로컬에만 저장된 이미지입니다. 파일을 다시 업로드해 주세요.');
  }
  return imageUrl;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('이미지 데이터 형식이 올바르지 않습니다.');
  }
  const mime = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function extensionFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

/**
 * data URL / local-media → Supabase Storage 공개 URL.
 * 형식: https://프로젝트ID.supabase.co/storage/v1/object/public/kiosk-media/경로
 */
export async function persistImageToServer(
  storagePath: string,
  imageUrl: string
): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase가 연결되지 않았습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하고 개발 서버를 재시작하세요.'
    );
  }

  const source = await readImageSource(imageUrl);

  if (!isDataUrl(source)) {
    if (isKioskStoragePublicUrl(source)) {
      return source;
    }
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return source;
    }
    throw new Error('업로드할 이미지가 없습니다. 파일을 다시 선택해 주세요.');
  }

  const blob = dataUrlToBlob(source);
  const ext = extensionFromMime(blob.type || 'image/jpeg');
  const basePath = storagePath.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
  const objectPath = `${basePath}.${ext}`;

  const { error } = await supabase.storage.from(KIOSK_MEDIA_BUCKET).upload(objectPath, blob, {
    upsert: true,
    contentType: blob.type || 'image/jpeg',
    cacheControl: '3600',
  });

  if (error) {
    console.error('Supabase storage upload failed:', error);
    throw new Error(
      `Storage 업로드 실패: ${error.message}\n` +
        `Supabase SQL Editor에서 supabase/storage.sql 실행 여부와 버킷 "${KIOSK_MEDIA_BUCKET}"(public)을 확인하세요.`
    );
  }

  const publicUrl = buildKioskMediaPublicUrl(objectPath);
  return `${publicUrl}?t=${Date.now()}`;
}

export function isServerPersistedImageUrl(url: string): boolean {
  return isKioskStoragePublicUrl(url);
}
