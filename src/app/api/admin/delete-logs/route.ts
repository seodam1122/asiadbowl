import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/admin/delete-logs
 * 
 * 관리자 개발자 모드에서 event_logs를 삭제하는 API.
 * RLS에 DELETE 정책이 없으므로 service_role 키를 사용하여 삭제합니다.
 * 
 * Body: { ids: number[] }          → 선택 삭제
 * Body: { deleteAll: true }        → 전체 삭제
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

  let body: { ids?: number[]; deleteAll?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  try {
    if (body.deleteAll) {
      // 전체 삭제
      const { error } = await supabaseAdmin
        .from('event_logs')
        .delete()
        .neq('id', -1); // 모든 행 삭제
      if (error) throw error;

      return NextResponse.json({ ok: true, message: '전체 참여 기록을 삭제했습니다.' });
    }

    if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
      const uniqueIds = [...new Set(body.ids.map(Number).filter((id) => Number.isFinite(id)))];
      if (uniqueIds.length === 0) {
        return NextResponse.json({ error: '삭제할 항목이 없습니다.' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('event_logs')
        .delete()
        .in('id', uniqueIds);
      if (error) throw error;

      return NextResponse.json({
        ok: true,
        message: `${uniqueIds.length}건의 참여 기록을 삭제했습니다.`,
        deletedCount: uniqueIds.length,
      });
    }

    return NextResponse.json({ error: 'ids 또는 deleteAll 파라미터가 필요합니다.' }, { status: 400 });
  } catch (err) {
    console.error('[API] delete-logs error:', err);
    const message = err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
