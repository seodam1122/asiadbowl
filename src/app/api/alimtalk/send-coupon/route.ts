import { NextRequest, NextResponse } from 'next/server';
import {
  digitsOnlyPhone,
  getAlimtalkConfig,
  isAlimtalkConfigured,
  sendCouponAlimtalk,
} from '@/lib/alimtalk';
import {
  updateEventLogAlimtalkOnServer,
  verifyEventLogForAlimtalk,
} from '@/lib/alimtalk-event-log';

export const runtime = 'nodejs';

interface SendCouponBody {
  logId?: number;
  phoneNumber: string;
  prizeName: string;
  couponCode: string;
  prizeImageUrl?: string | null;
}

function isAuthorizedKioskRequest(request: NextRequest): boolean {
  const secret = process.env.KIOSK_ALIMTALK_SECRET?.trim();
  if (!secret) return true;
  return request.headers.get('x-kiosk-secret') === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedKioskRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAlimtalkConfigured()) {
    return NextResponse.json({
      ok: false,
      status: 'skipped',
      error: 'ALIMTALK_ENABLED 또는 SOLAPI/카카오 환경 변수를 확인하세요.',
    });
  }

  let body: SendCouponBody;
  try {
    body = (await request.json()) as SendCouponBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { logId, phoneNumber, prizeName, couponCode, prizeImageUrl } = body;
  if (!phoneNumber || !prizeName || !couponCode) {
    return NextResponse.json(
      { ok: false, error: 'phoneNumber, prizeName, couponCode가 필요합니다.' },
      { status: 400 }
    );
  }

  if (logId) {
    const verified = await verifyEventLogForAlimtalk(logId, phoneNumber, couponCode);
    if (!verified) {
      return NextResponse.json(
        { ok: false, error: '참여 기록을 확인할 수 없습니다.' },
        { status: 403 }
      );
    }
  } else if (process.env.KIOSK_ALIMTALK_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'logId가 필요합니다.' },
      { status: 400 }
    );
  }

  const config = getAlimtalkConfig();
  if (!config) {
    return NextResponse.json({
      ok: false,
      status: 'skipped',
      error: '알림톡 설정이 완료되지 않았습니다.',
    });
  }

  const result = await sendCouponAlimtalk({
    toPhone: digitsOnlyPhone(phoneNumber),
    prizeName,
    couponCode,
    prizeImageUrl,
  });

  if (logId) {
    await updateEventLogAlimtalkOnServer(logId, result.status, {
      error: result.error,
      sentAt: result.ok ? new Date().toISOString() : undefined,
    });
  }

  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    messageId: result.messageId,
    error: result.error,
  });
}
