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

/**
다른 패널 해상도(예: 720×1280)에 맞추고 싶으면 
src/lib/kiosk-viewport.ts의 KIOSK_DESIGN_WIDTH / KIOSK_DESIGN_HEIGHT만 바꾸면 됩니다.
개발 서버가 켜져 있으면 새로고침 후, 다른 기기나 브라우저 개발자 도구에서 기기 모드로 바꿔 보면서 확인해 보시면 됩니다.
 */
