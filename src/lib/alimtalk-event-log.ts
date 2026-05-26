import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AlimtalkStatus } from './alimtalk';

function getServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function verifyEventLogForAlimtalk(
  logId: number,
  phoneNumber: string,
  couponCode: string
): Promise<boolean> {
  const supabase = getServerSupabase();
  if (!supabase) return false;

  const digits = phoneNumber.replace(/\D/g, '');
  const { data, error } = await supabase
    .from('event_logs')
    .select('id, phone_number, coupon_code')
    .eq('id', logId)
    .maybeSingle();

  if (error || !data) return false;

  const storedPhone = String(data.phone_number).replace(/\D/g, '');
  return storedPhone === digits && data.coupon_code === couponCode;
}

export async function updateEventLogAlimtalkOnServer(
  logId: number,
  status: AlimtalkStatus,
  options?: { error?: string; sentAt?: string }
): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase || !logId) return;

  const sentAt =
    status === 'sent' ? options?.sentAt ?? new Date().toISOString() : null;

  await supabase
    .from('event_logs')
    .update({
      alimtalk_status: status,
      alimtalk_sent_at: sentAt,
      alimtalk_error: options?.error ?? null,
    })
    .eq('id', logId);
}
