import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * 배포 환경에서 Supabase 환경 변수가 올바르게 설정되었는지 확인하는 진단 엔드포인트.
 * 민감한 값은 마스킹하여 반환합니다.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const isConfigured =
    url.length > 0 &&
    url !== 'https://your-supabase-project-id.supabase.co' &&
    anonKey.length > 0 &&
    anonKey !== 'your-supabase-anon-key';

  return NextResponse.json({
    ok: isConfigured,
    supabase: {
      url: url ? `${url.slice(0, 30)}...` : '(미설정)',
      anonKey: anonKey ? `${anonKey.slice(0, 20)}...(${anonKey.length}자)` : '(미설정)',
      serviceKey: serviceKey ? '설정됨' : '(미설정)',
    },
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
