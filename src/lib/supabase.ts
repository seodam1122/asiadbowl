import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = 
  supabaseUrl.length > 0 && 
  supabaseUrl !== 'https://your-supabase-project-id.supabase.co' &&
  supabaseAnonKey.length > 0 &&
  supabaseAnonKey !== 'your-supabase-anon-key';

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
