import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/admin/delete-points
 * 
 * 관리자 개발자 모드에서 모든 포인트 내역(customer_points, point_transactions)을 삭제하는 API.
 * RLS 우회를 위해 service_role 키를 사용합니다.
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Supabase 환경 변수가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  // service_role 키로 Supabase 클라이언트 생성 (RLS 우회)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 트랜잭션 내역 삭제
    const { error: txError } = await supabaseAdmin
      .from('point_transactions')
      .delete()
      .neq('id', -1);
    if (txError) throw txError;

    // 고객 포인트 잔액 삭제 (폰번호를 기본키로 사용하는 테이블)
    const { error: ptError } = await supabaseAdmin
      .from('customer_points')
      .delete()
      .neq('phone_number', '0'); // 모든 텍스트 값은 '0'과 다름
    if (ptError) throw ptError;

    return NextResponse.json({ ok: true, message: '모든 포인트 내역을 삭제했습니다.' });
  } catch (err) {
    console.error('[API] delete-points error:', err);
    const message = err instanceof Error ? err.message : '포인트 삭제 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
