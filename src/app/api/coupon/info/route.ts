import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const DEFAULT_PRIZE_IMAGE =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim();
  if (!code) {
    return NextResponse.json({ error: '쿠폰 번호가 필요합니다.' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: '서버 DB가 연결되지 않았습니다. Supabase 설정을 확인해 주세요.' },
      { status: 503 }
    );
  }

  const { data: log, error: logError } = await supabase
    .from('event_logs')
    .select('id, coupon_code, prize_name, prize_id')
    .eq('coupon_code', code)
    .maybeSingle();

  if (logError || !log) {
    return NextResponse.json(
      { error: '유효하지 않은 쿠폰입니다.' },
      { status: 404 }
    );
  }

  let prizeImageUrl = DEFAULT_PRIZE_IMAGE;
  if (log.prize_id) {
    const { data: prize } = await supabase
      .from('prizes')
      .select('image_url')
      .eq('id', log.prize_id)
      .maybeSingle();
    const url = prize?.image_url?.trim();
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      prizeImageUrl = url;
    }
  }

  const { data: settings } = await supabase
    .from('settings')
    .select('ad_title')
    .eq('id', 1)
    .maybeSingle();

  return NextResponse.json({
    couponCode: log.coupon_code,
    prizeName: log.prize_name,
    prizeImageUrl,
    eventTitle: settings?.ad_title || '이벤트 당첨 쿠폰',
  });
}
