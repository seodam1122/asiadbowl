/** Resize & compress an image data URL for local storage (JPEG). */
export function compressDataUrl(
  dataUrl: string,
  maxDimension = 512,
  quality = 0.82
): Promise<string> {
  if (!isBrowser || !dataUrl.startsWith('data:image/')) {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const largest = Math.max(img.width, img.height);
      const scale = largest > maxDimension ? maxDimension / largest : 1;
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'));
    img.src = dataUrl;
  });
}

const isBrowser = typeof window !== 'undefined';

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

export async function fileToCompressedDataUrl(
  file: File,
  maxDimension = 512,
  quality = 0.82
): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  if (!file.type.startsWith('image/')) {
    return raw;
  }
  return compressDataUrl(raw, maxDimension, quality);
}
