import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Vercel Toolbar( #feedback-toolbar ) 주입 방지 — 플랫폼·E2E 문서 권장 헤더 */
const SKIP_TOOLBAR_HEADER = 'x-vercel-skip-toolbar';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(SKIP_TOOLBAR_HEADER, '1');

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(SKIP_TOOLBAR_HEADER, '1');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
