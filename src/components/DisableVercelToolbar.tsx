'use client';

import { useEffect } from 'react';

const TOOLBAR_ROOT_SELECTORS = [
  '#feedback-toolbar',
  '[data-vercel-toolbar]',
  'vercel-live-feedback',
  '[id^="vercel-toolbar"]',
];

function removeToolbarNodes() {
  for (const selector of TOOLBAR_ROOT_SELECTORS) {
    document.querySelectorAll(selector).forEach((node) => {
      node.remove();
    });
  }
}

/** Vercel이 HTML에 주입하는 피드백 툴바 DOM을 제거 (키오스크·일반 방문자 UI 방해 방지) */
export default function DisableVercelToolbar() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;

    removeToolbarNodes();

    const observer = new MutationObserver(() => {
      removeToolbarNodes();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
