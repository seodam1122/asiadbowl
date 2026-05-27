/** 경품명에서 쿠폰 사용 시 적립할 포인트 (숫자+point 패턴) */
export function pointsFromPrizeName(prizeName: string): number {
  const normalized = prizeName.trim();
  const match = normalized.match(/(\d{1,6})\s*point/i);
  if (match) return Number(match[1]);
  if (/2000\s*point/i.test(normalized) || normalized.includes('2000 point')) {
    return 2000;
  }
  return 0;
}

export type PointTransactionType = 'coupon_earn' | 'admin_add' | 'admin_subtract';

export interface CustomerPoints {
  phone_number: string;
  balance: number;
  updated_at: string;
}

export interface PointTransaction {
  id?: number;
  phone_number: string;
  amount: number;
  balance_after: number;
  transaction_type: PointTransactionType;
  reason: string;
  coupon_code?: string | null;
  event_log_id?: number | null;
  prize_name?: string | null;
  created_at: string;
}
