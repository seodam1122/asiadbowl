import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = 
  supabaseUrl.length > 0 && 
  supabaseUrl !== 'https://your-supabase-project-id.supabase.co' &&
  supabaseAnonKey.length > 0 &&
  supabaseAnonKey !== 'your-supabase-anon-key';

if (!isSupabaseConfigured) {
  console.warn(
    '[Kiosk] Supabase 환경 변수가 설정되지 않았습니다. 모든 데이터가 브라우저 localStorage에만 저장됩니다.\n' +
    'Vercel 배포 시 Environment Variables에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 추가한 뒤 재배포해 주세요.\n' +
    `  NEXT_PUBLIC_SUPABASE_URL = "${supabaseUrl || '(비어 있음)'}"\n` +
    `  NEXT_PUBLIC_SUPABASE_ANON_KEY = "${supabaseAnonKey ? '***설정됨***' : '(비어 있음)'}"`
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/** 관리자 화면 연결 상태 표시용 */
export function getSupabaseConnectionHint(): string {
  if (!isSupabaseConfigured) {
    return 'Supabase 미연결 — .env.local 설정 후 npm run dev 재시작 필요';
  }
  return `Supabase 연결됨 (${supabaseUrl.replace(/^https?:\/\//, '').slice(0, 40)}…)`;
}
