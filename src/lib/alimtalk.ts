import { createSolapiAuthorizationHeader } from './solapi-auth';

export type AlimtalkStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface AlimtalkConfig {
  enabled: boolean;
  apiKey: string;
  apiSecret: string;
  senderFrom: string;
  pfId: string;
  templateId: string;
  disableSms: boolean;
  varPrize: string;
  varCoupon: string;
  varImage: string | null;
}

export interface SendCouponAlimtalkInput {
  toPhone: string;
  prizeName: string;
  couponCode: string;
  prizeImageUrl?: string | null;
}

export interface SendCouponAlimtalkResult {
  ok: boolean;
  status: AlimtalkStatus;
  messageId?: string;
  error?: string;
}

export function getAlimtalkConfig(): AlimtalkConfig | null {
  const enabled = process.env.ALIMTALK_ENABLED === 'true';
  const apiKey = process.env.SOLAPI_API_KEY?.trim();
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim();
  const senderFrom = process.env.ALIMTALK_SENDER_FROM?.trim();
  const pfId = process.env.KAKAO_PF_ID?.trim();
  const templateId = process.env.KAKAO_TEMPLATE_ID?.trim();

  if (!enabled) return null;
  if (!apiKey || !apiSecret || !senderFrom || !pfId || !templateId) {
    return null;
  }

  const varImage = process.env.ALIMTALK_VAR_IMAGE?.trim();
  return {
    enabled: true,
    apiKey,
    apiSecret,
    senderFrom,
    pfId,
    templateId,
    disableSms: process.env.ALIMTALK_DISABLE_SMS === 'true',
    varPrize: process.env.ALIMTALK_VAR_PRIZE?.trim() || '#{상품명}',
    varCoupon: process.env.ALIMTALK_VAR_COUPON?.trim() || '#{쿠폰번호}',
    varImage: varImage === '' || varImage === 'none' ? null : varImage || '#{이미지URL}',
  };
}

export function isAlimtalkConfigured(): boolean {
  return getAlimtalkConfig() !== null;
}

/** 알림톡 템플릿에 넣을 공개 HTTPS 이미지 URL만 허용 */
export function resolvePublicPrizeImageUrl(imageUrl?: string | null): string | undefined {
  if (!imageUrl) return undefined;
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('http://')) return trimmed;
  return undefined;
}

export function buildAlimtalkVariables(
  config: AlimtalkConfig,
  input: SendCouponAlimtalkInput
): Record<string, string> {
  const variables: Record<string, string> = {
    [config.varPrize]: input.prizeName,
    [config.varCoupon]: input.couponCode,
  };

  const imageUrl = resolvePublicPrizeImageUrl(input.prizeImageUrl);
  if (config.varImage && imageUrl) {
    variables[config.varImage] = imageUrl;
  }

  return variables;
}

export function digitsOnlyPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** SOLAPI 카카오 알림톡(ATA) 발송 */
export async function sendCouponAlimtalk(
  input: SendCouponAlimtalkInput
): Promise<SendCouponAlimtalkResult> {
  const config = getAlimtalkConfig();
  if (!config) {
    return { ok: false, status: 'skipped', error: '알림톡이 설정되지 않았습니다.' };
  }

  const to = digitsOnlyPhone(input.toPhone);
  if (to.length < 10) {
    return { ok: false, status: 'failed', error: '유효하지 않은 수신 번호입니다.' };
  }

  const variables = buildAlimtalkVariables(config, input);
  const authorization = createSolapiAuthorizationHeader(config.apiKey, config.apiSecret);

  const body = {
    messages: [
      {
        to,
        from: digitsOnlyPhone(config.senderFrom),
        kakaoOptions: {
          pfId: config.pfId,
          templateId: config.templateId,
          variables,
          disableSms: config.disableSms,
        },
      },
    ],
  };

  try {
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as {
      statusCode?: string;
      statusMessage?: string;
      errorCode?: string;
      errorMessage?: string;
      messageId?: string;
      groupId?: string;
    };

    if (!response.ok) {
      const err =
        payload.errorMessage ||
        payload.statusMessage ||
        `SOLAPI HTTP ${response.status}`;
      return { ok: false, status: 'failed', error: err };
    }

    return {
      ok: true,
      status: 'sent',
      messageId: payload.messageId || payload.groupId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '알림톡 발송 요청 실패';
    return { ok: false, status: 'failed', error: message };
  }
}
