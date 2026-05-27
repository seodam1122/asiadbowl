/** 키오스크 UI 설계 기준 해상도 (세로 1080×1920) */
export const KIOSK_DESIGN_WIDTH = 1080;
export const KIOSK_DESIGN_HEIGHT = 1920;

export function getKioskScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(width / KIOSK_DESIGN_WIDTH, height / KIOSK_DESIGN_HEIGHT);
}

export function readViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: KIOSK_DESIGN_WIDTH, height: KIOSK_DESIGN_HEIGHT };
  }

  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
}
