/**
 * 쿠폰 사용 기한 유틸리티
 *
 * 정책: 쿠폰은 발행일로부터 일주일(7일) 동안 사용 가능하다.
 * 예) 6월 1일(월) 발행 → 6월 8일(월) 23:59:59 까지 사용 가능.
 *     (발행일 기준 7일째 되는 날의 자정 직전까지)
 */

export const COUPON_VALID_DAYS = 7;

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** 발행일(created_at) 기준 만료 시각 = 발행일 + 7일, 그 날 23:59:59.999 */
export function getCouponExpiryDate(createdAtIso: string): Date {
  const created = new Date(createdAtIso);
  return new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate() + COUPON_VALID_DAYS,
    23,
    59,
    59,
    999
  );
}

/** 현재(now) 기준으로 쿠폰 기한이 지났는지 여부 */
export function isCouponExpired(createdAtIso: string | null | undefined, now: Date = new Date()): boolean {
  if (!createdAtIso) return false;
  const expiry = getCouponExpiryDate(createdAtIso);
  if (Number.isNaN(expiry.getTime())) return false;
  return now.getTime() > expiry.getTime();
}

/** "6월 8일(월)" 형식의 만료일 문자열 */
export function formatCouponExpiryShort(createdAtIso: string): string {
  const e = getCouponExpiryDate(createdAtIso);
  if (Number.isNaN(e.getTime())) return '';
  return `${e.getMonth() + 1}월 ${e.getDate()}일(${WEEKDAYS_KO[e.getDay()]})`;
}

/** "사용기한 : ~ 6월 8일(월)" 형식의 라벨 */
export function formatCouponExpiryLabel(createdAtIso: string): string {
  const short = formatCouponExpiryShort(createdAtIso);
  return short ? `사용기한 : ~ ${short}` : '';
}
