import crypto from 'crypto';

/** SOLAPI REST API HMAC-SHA256 Authorization 헤더 생성 */
export function createSolapiAuthorizationHeader(
  apiKey: string,
  apiSecret: string
): string {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex');

  return `HMAC-SHA256 ApiKey=${apiKey}, Date=${date}, salt=${salt}, signature=${signature}`;
}
