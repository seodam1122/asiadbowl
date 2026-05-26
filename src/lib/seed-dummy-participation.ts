import type { ContactConsent, EventLog } from './db';

const PRIZE_POOL = [
  { id: 1, name: '무료 1게임' },
  { id: 2, name: '2000 point' },
  { id: 3, name: '음료 선택권' },
  { id: 4, name: '스낵 선택권' },
] as const;

/** 28명 중 3명은 수신거부(미동의) 샘플 */
const DECLINED_CONTACT_INDICES = new Set([2, 9, 20]);

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function formatPhone(seed: number): string {
  const a = 1000 + (seed % 9000);
  const b = 1000 + ((seed * 7 + 13) % 9000);
  return `010-${pad4(a)}-${pad4(b)}`;
}

function randomDateBetween(start: Date, end: Date, seed: number): Date {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const ratio = ((seed * 9301 + 49297) % 10000) / 10000;
  return new Date(startMs + Math.floor(ratio * (endMs - startMs)));
}

function generateUniqueCouponCode(used: Set<string>, seed: number): string {
  let attempt = 0;
  while (attempt < 10000) {
    const part1 = pad4(1000 + ((seed + attempt * 17) % 9000));
    const part2 = pad4(1000 + ((seed + attempt * 31) % 9000));
    const code = `C-${part1}-${part2}`;
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
    attempt += 1;
  }
  return `C-${Date.now().toString().slice(-4)}-${pad4(seed % 10000)}`;
}

export interface AprilMayDummySeedPayload {
  logs: EventLog[];
  consents: ContactConsent[];
}

/** 4월~5월 임의 참여 더미 데이터 (기본 52건, 연락처 28명) */
export function buildAprilMayDummyParticipation(
  year = new Date().getFullYear(),
  entryCount = 52,
  salt = 0
): AprilMayDummySeedPayload {
  const rangeStart = new Date(`${year}-04-01T10:00:00+09:00`);
  const rangeEnd = new Date(`${year}-05-31T21:00:00+09:00`);
  const usedCoupons = new Set<string>();
  const phoneBySeed = new Map<number, string>();

  const logs: EventLog[] = [];

  for (let i = 0; i < entryCount; i += 1) {
    const phoneSeed = 100 + (i % 28);
    if (!phoneBySeed.has(phoneSeed)) {
      phoneBySeed.set(phoneSeed, formatPhone(phoneSeed));
    }
    const phone = phoneBySeed.get(phoneSeed)!;
    const prize = PRIZE_POOL[i % PRIZE_POOL.length];
    const createdAt = randomDateBetween(rangeStart, rangeEnd, i + 1);
    const isUsed = i % 3 === 0;
    const couponCode = generateUniqueCouponCode(usedCoupons, 5000 + i + salt);

    logs.push({
      phone_number: phone,
      prize_name: prize.name,
      prize_id: prize.id,
      coupon_code: couponCode,
      is_used: isUsed,
      used_at: isUsed
        ? new Date(createdAt.getTime() + 1000 * 60 * (30 + (i % 120))).toISOString()
        : null,
      privacy_consent: true,
      created_at: createdAt.toISOString(),
    });
  }

  logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const consents: ContactConsent[] = [];
  for (const [seed, phone] of phoneBySeed.entries()) {
    const phoneLogs = logs.filter((l) => l.phone_number === phone);
    const firstAt = phoneLogs[phoneLogs.length - 1]?.created_at ?? rangeStart.toISOString();
    const index = seed - 100;
    const isDeclined = DECLINED_CONTACT_INDICES.has(index);
    consents.push({
      phone_number: phone,
      consent_status: isDeclined ? 'declined' : 'agreed',
      agreed_at: isDeclined ? null : firstAt,
      declined_at: isDeclined
        ? new Date(new Date(firstAt).getTime() + 1000 * 60 * 60 * 24 * 3).toISOString()
        : null,
      updated_at: isDeclined
        ? new Date(new Date(firstAt).getTime() + 1000 * 60 * 60 * 24 * 3).toISOString()
        : firstAt,
    });
  }

  return { logs, consents };
}

export interface DummySeedResult {
  logsAdded: number;
  consentsAdded: number;
  consentsUpdated: number;
}
