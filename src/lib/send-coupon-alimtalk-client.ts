import type { AlimtalkStatus } from './db';

export interface RequestCouponAlimtalkInput {
  logId?: number;
  phoneNumber: string;
  prizeName: string;
  couponCode: string;
  prizeImageUrl?: string | null;
}

export interface RequestCouponAlimtalkResult {
  ok: boolean;
  status: AlimtalkStatus;
  messageId?: string;
  error?: string;
}

/** 키오스크 → 서버 알림톡 발송 API */
export async function requestCouponAlimtalk(
  input: RequestCouponAlimtalkInput
): Promise<RequestCouponAlimtalkResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const kioskSecret = process.env.NEXT_PUBLIC_KIOSK_ALIMTALK_SECRET?.trim();
  if (kioskSecret) {
    headers['x-kiosk-secret'] = kioskSecret;
  }

  try {
    const response = await fetch('/api/alimtalk/send-coupon', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    const data = (await response.json()) as RequestCouponAlimtalkResult & {
      error?: string;
    };
    return {
      ok: Boolean(data.ok),
      status: data.status ?? (response.ok ? 'sent' : 'failed'),
      messageId: data.messageId,
      error: data.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '알림톡 요청 실패';
    return { ok: false, status: 'failed', error: message };
  }
}
