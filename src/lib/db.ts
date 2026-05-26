import { isKioskStoragePublicUrl } from './kiosk-storage-url';
import { persistImageToServer } from './media-upload';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  buildAprilMayDummyParticipation,
  type DummySeedResult,
} from './seed-dummy-participation';

export type { DummySeedResult } from './seed-dummy-participation';

const APR_MAY_DUMMY_SEED_FLAG_PREFIX = 'kiosk_apr_may_dummy_seeded_';
import {
  isDataUrl,
  isLocalMediaRef,
  localMediaKeyFromRef,
  localMediaStore,
  toLocalMediaRef,
} from './local-media-store';

export interface KioskSettings {
  id?: number;
  active_game: string;
  ad_title: string;
  ad_subtitle: string;
  ad_image_url: string;
  admin_password?: string;
}

export interface Prize {
  id: number;
  name: string;
  image_url: string;
  probability: number;
}

function normalizePrize(prize: Prize): Prize {
  return {
    ...prize,
    id: Number(prize.id),
    probability: Number(prize.probability),
  };
}

function normalizePrizeList(prizes: Prize[]): Prize[] {
  return prizes.map(normalizePrize).sort((a, b) => a.id - b.id);
}

export type ContactConsentStatus = 'agreed' | 'declined';

export interface ContactConsent {
  phone_number: string;
  consent_status: ContactConsentStatus;
  agreed_at: string | null;
  declined_at: string | null;
  updated_at: string;
}

export type AlimtalkStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface EventLog {
  id?: number;
  phone_number: string;
  prize_name: string;
  prize_id?: number | null;
  coupon_code?: string | null;
  is_used?: boolean;
  used_at?: string | null;
  privacy_consent?: boolean;
  alimtalk_status?: AlimtalkStatus | null;
  alimtalk_sent_at?: string | null;
  alimtalk_error?: string | null;
  created_at: string;
}

const CONTACT_CONSENTS_KEY = 'kiosk_contact_consents';

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function findConsentRecord(
  consents: ContactConsent[],
  phoneNumber: string
): ContactConsent | undefined {
  const normalized = normalizePhoneNumber(phoneNumber);
  return consents.find((c) => normalizePhoneNumber(c.phone_number) === normalized);
}

// LocalStorage mock data initializers
const DEFAULT_SETTINGS: KioskSettings = {
  active_game: 'roulette',
  ad_title: '아시아드 볼링장 이벤트',
  ad_subtitle: '터치하고 대박 경품 받아가기',
  ad_image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80',
  admin_password: '0077',
};

const DEFAULT_PRIZES: Prize[] = [
  {
    id: 1,
    name: '무료 1게임',
    image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&auto=format&fit=crop&q=60',
    probability: 35,
  },
  {
    id: 2,
    name: '2000 point',
    image_url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&auto=format&fit=crop&q=60',
    probability: 35,
  },
  {
    id: 3,
    name: '음료 선택권',
    image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=60',
    probability: 15,
  },
  {
    id: 4,
    name: '스낵 선택권',
    image_url: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=400&auto=format&fit=crop&q=60',
    probability: 15,
  },
];

// Helper to check if we are in browser environment
const isBrowser = typeof window !== 'undefined';

function getLocalData<T>(key: string, defaultValue: T): T {
  if (!isBrowser) return defaultValue;
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
}

function setLocalData<T>(key: string, value: T): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22);
    if (isQuota) {
      throw new Error(
        '브라우저 저장 공간이 부족합니다. 이미지 용량을 줄이거나 외부 URL을 사용해 주세요.'
      );
    }
    throw err;
  }
}

async function hydrateImageUrl(imageUrl: string): Promise<string> {
  if (!isBrowser || !isLocalMediaRef(imageUrl)) {
    return imageUrl;
  }
  const stored = await localMediaStore.get(localMediaKeyFromRef(imageUrl));
  return stored ?? imageUrl;
}

async function externalizeImageUrl(storageKey: string, imageUrl: string): Promise<string> {
  if (!isBrowser || !isDataUrl(imageUrl)) {
    return imageUrl;
  }
  await localMediaStore.set(storageKey, imageUrl);
  return toLocalMediaRef(storageKey);
}

function storageObjectPath(storageKey: string): string {
  if (storageKey === 'settings-ad') return 'settings/ad-banner';
  if (storageKey.startsWith('prizes/')) return storageKey;
  if (storageKey.startsWith('prize-')) return `prizes/${storageKey}`;
  return storageKey;
}

/** Supabase Storage 업로드(설정 시) 또는 로컬 IndexedDB 저장 */
async function resolveImageForPersistence(
  storageKey: string,
  imageUrl: string
): Promise<string> {
  const needsUpload = isDataUrl(imageUrl) || isLocalMediaRef(imageUrl);

  if (isSupabaseConfigured && supabase && needsUpload) {
    return persistImageToServer(storageObjectPath(storageKey), imageUrl);
  }

  if (isDataUrl(imageUrl)) {
    return externalizeImageUrl(storageKey, imageUrl);
  }

  return imageUrl;
}

function assertPrizeImagesPersistedToServer(prizes: Prize[]): void {
  if (!isSupabaseConfigured) return;
  const bad = prizes.find(
    (p) => isDataUrl(p.image_url) || isLocalMediaRef(p.image_url)
  );
  if (bad) {
    throw new Error(
      `'${bad.name}' 경품 이미지를 서버에 올리지 못했습니다. 파일을 다시 업로드한 뒤 저장해 주세요.`
    );
  }
}

async function hydratePrizes(prizes: Prize[]): Promise<Prize[]> {
  return Promise.all(
    prizes.map(async (prize) => ({
      ...prize,
      image_url: await hydrateImageUrl(prize.image_url),
    }))
  );
}

async function externalizePrizesForStorage(prizes: Prize[]): Promise<Prize[]> {
  return Promise.all(
    prizes.map(async (prize) => ({
      ...prize,
      image_url: await resolveImageForPersistence(`prize-${prize.id}`, prize.image_url),
    }))
  );
}

/** Migrate legacy base64 entries still inside localStorage JSON. */
async function migrateEmbeddedPrizeImages(prizes: Prize[]): Promise<Prize[]> {
  let changed = false;
  const migrated = await Promise.all(
    prizes.map(async (prize) => {
      if (!isDataUrl(prize.image_url)) {
        return prize;
      }
      changed = true;
      return {
        ...prize,
        image_url: await externalizeImageUrl(`prize-${prize.id}`, prize.image_url),
      };
    })
  );
  if (changed) {
    setLocalData('kiosk_prizes', migrated);
  }
  return migrated;
}

async function hydrateSettings(settings: KioskSettings): Promise<KioskSettings> {
  return {
    ...settings,
    ad_image_url: await hydrateImageUrl(settings.ad_image_url),
  };
}

async function externalizeSettingsForStorage(settings: KioskSettings): Promise<KioskSettings> {
  const ad_image_url = await resolveImageForPersistence('settings-ad', settings.ad_image_url);
  return { ...settings, ad_image_url };
}

async function migrateEmbeddedSettingsImage(settings: KioskSettings): Promise<KioskSettings> {
  if (!isDataUrl(settings.ad_image_url)) {
    return settings;
  }
  const migrated = await externalizeSettingsForStorage(settings);
  setLocalData('kiosk_settings', migrated);
  return migrated;
}

async function getLocalPrizesHydrated(): Promise<Prize[]> {
  const stored = getLocalData<Prize[]>('kiosk_prizes', DEFAULT_PRIZES);
  if (
    isBrowser &&
    stored.some((p) => isLocalMediaRef(p.image_url) || isDataUrl(p.image_url))
  ) {
    localStorage.setItem(PRIZES_CUSTOM_FLAG, '1');
  }
  const migrated = await migrateEmbeddedPrizeImages(stored);
  const hydrated = await hydratePrizes(migrated);
  return normalizePrizeList(hydrated);
}

async function getLocalSettingsHydrated(): Promise<KioskSettings> {
  const stored = getLocalData<KioskSettings>('kiosk_settings', DEFAULT_SETTINGS);
  const migrated = await migrateEmbeddedSettingsImage(stored);
  return hydrateSettings(migrated);
}

const PRIZES_CUSTOM_FLAG = 'kiosk_prizes_custom';

// Database API Implementation
export const db = {
  // Settings API
  async getSettings(): Promise<KioskSettings> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 1)
          .single();
        if (error) throw error;
        const settings = await hydrateSettings(data as KioskSettings);
        setLocalData('kiosk_settings', settings);
        return settings;
      } catch (err) {
        console.error('Supabase getSettings failed, using fallback:', err);
      }
    }
    return getLocalSettingsHydrated();
  },

  async updateSettings(updates: Partial<KioskSettings>): Promise<KioskSettings> {
    const current = await this.getSettings();
    const merged = { ...current, ...updates };
    const persisted = await externalizeSettingsForStorage(merged);
    setLocalData('kiosk_settings', persisted);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('settings')
        .update({
          active_game: persisted.active_game,
          ad_title: persisted.ad_title,
          ad_subtitle: persisted.ad_subtitle,
          ad_image_url: persisted.ad_image_url,
          admin_password: persisted.admin_password,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      if (error) {
        console.error('Supabase updateSettings failed:', error);
        throw new Error('서버에 광고 설정을 저장하지 못했습니다.');
      }
    }

    return hydrateSettings(persisted);
  },

  // Prizes API
  async getPrizes(): Promise<Prize[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('prizes')
          .select('*')
          .order('id', { ascending: true });
        if (error) throw error;
        const list = normalizePrizeList(await hydratePrizes(data as Prize[]));
        setLocalData('kiosk_prizes', list);
        if (isBrowser) {
          localStorage.setItem(PRIZES_CUSTOM_FLAG, '1');
        }
        return list;
      } catch (err) {
        console.error('Supabase getPrizes failed, using fallback:', err);
      }
    }
    return getLocalPrizesHydrated();
  },

  async getPrizeById(id: number): Promise<Prize | null> {
    const prizes = await this.getPrizes();
    return prizes.find((p) => p.id === id) ?? null;
  },

  /** 경품 이미지만 즉시 Storage 업로드 (관리자에서 파일 선택 직후) */
  async uploadPrizeImage(prizeId: number, imageUrl: string): Promise<string> {
    const id = Number(prizeId);
    if (!id || Number.isNaN(id)) {
      throw new Error('경품 ID가 올바르지 않습니다.');
    }
    const url = await resolveImageForPersistence(`prizes/prize-${id}`, imageUrl);
    if (isDataUrl(url) || isLocalMediaRef(url)) {
      throw new Error('이미지가 서버 Storage에 올라가지 않았습니다. Supabase 설정을 확인하세요.');
    }
    if (isSupabaseConfigured && !isKioskStoragePublicUrl(url)) {
      throw new Error(
        '업로드된 주소가 Supabase Storage URL이 아닙니다. 파일을 다시 업로드하거나 .env.local을 확인하세요.'
      );
    }
    return url;
  },

  async savePrizeList(prizesList: Prize[]): Promise<Prize[]> {
    const persisted = normalizePrizeList(await externalizePrizesForStorage(prizesList));
    assertPrizeImagesPersistedToServer(persisted);
    setLocalData('kiosk_prizes', persisted);
    if (isBrowser) {
      localStorage.setItem(PRIZES_CUSTOM_FLAG, '1');
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('prizes').upsert(
        persisted.map((prize) => ({
          id: prize.id,
          name: prize.name,
          image_url: prize.image_url,
          probability: prize.probability,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'id' }
      );
      if (error) {
        console.error('Supabase savePrizeList failed:', error);
        throw new Error(`서버에 경품 설정을 저장하지 못했습니다: ${error.message}`);
      }
    }

    return persisted;
  },

  // Helper to migrate existing logs that don't have coupons
  async migrateExistingLogs(): Promise<void> {
    if (!isBrowser) return;

    // 1. Supabase migration for logs with no coupon_code
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: logs, error } = await supabase
          .from('event_logs')
          .select('*')
          .is('coupon_code', null);
        
        if (error) throw error;

        if (logs && logs.length > 0) {
          for (const log of logs) {
            const isPrize = !log.prize_name.includes('꽝') && !log.prize_name.includes('다음 기회에');
            if (isPrize) {
              const part1 = Math.floor(1000 + Math.random() * 9000);
              const part2 = Math.floor(1000 + Math.random() * 9000);
              const couponCode = `C-${part1}-${part2}`;
              
              await supabase
                .from('event_logs')
                .update({ coupon_code: couponCode })
                .eq('id', log.id);
            }
          }
        }
      } catch (err) {
        console.error('Supabase existing logs migration failed:', err);
      }
    }

    // 2. LocalStorage migration
    const logs = getLocalData<EventLog[]>('kiosk_event_logs', []);
    let modified = false;
    const updated = logs.map((log) => {
      const isPrize = !log.prize_name.includes('꽝') && !log.prize_name.includes('다음 기회에');
      if (isPrize && !log.coupon_code) {
        const part1 = Math.floor(1000 + Math.random() * 9000);
        const part2 = Math.floor(1000 + Math.random() * 9000);
        log.coupon_code = `C-${part1}-${part2}`;
        modified = true;
      }
      return log;
    });

    if (modified) {
      setLocalData('kiosk_event_logs', updated);
    }
  },

  // Contact consent API
  async migrateLegacyContactConsents(): Promise<void> {
    if (!isBrowser) return;

    const logs = getLocalData<EventLog[]>('kiosk_event_logs', []);
    const consents = getLocalData<ContactConsent[]>(CONTACT_CONSENTS_KEY, []);
    const knownPhones = new Set(consents.map((c) => normalizePhoneNumber(c.phone_number)));
    let modified = false;

    for (const log of logs) {
      const phone = normalizePhoneNumber(log.phone_number);
      if (!phone || knownPhones.has(phone)) continue;
      consents.push({
        phone_number: phone,
        consent_status: 'agreed',
        agreed_at: log.created_at,
        declined_at: null,
        updated_at: log.created_at,
      });
      knownPhones.add(phone);
      modified = true;
    }

    if (modified) {
      setLocalData(CONTACT_CONSENTS_KEY, consents);
    }
  },

  async getContactConsents(): Promise<ContactConsent[]> {
    await this.migrateLegacyContactConsents();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('contact_consents')
          .select('*')
          .order('updated_at', { ascending: false });
        if (error) throw error;
        return data as ContactConsent[];
      } catch (err) {
        console.error('Supabase getContactConsents failed, using fallback:', err);
      }
    }
    return getLocalData<ContactConsent[]>(CONTACT_CONSENTS_KEY, []);
  },

  async getContactConsentsMap(): Promise<Record<string, ContactConsentStatus>> {
    const consents = await this.getContactConsents();
    const map: Record<string, ContactConsentStatus> = {};
    for (const consent of consents) {
      map[normalizePhoneNumber(consent.phone_number)] = consent.consent_status;
    }
    return map;
  },

  async getContactConsent(phoneNumber: string): Promise<ContactConsent | null> {
    const phone = normalizePhoneNumber(phoneNumber);
    const consents = await this.getContactConsents();
    return findConsentRecord(consents, phone) ?? null;
  },

  async setContactConsent(
    phoneNumber: string,
    status: ContactConsentStatus
  ): Promise<ContactConsent> {
    const phone = normalizePhoneNumber(phoneNumber);
    const now = new Date().toISOString();
    const existing = await this.getContactConsent(phone);

    const record: ContactConsent = {
      phone_number: phone,
      consent_status: status,
      agreed_at: status === 'agreed' ? now : existing?.agreed_at ?? null,
      declined_at: status === 'declined' ? now : existing?.declined_at ?? null,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('contact_consents')
          .upsert(record)
          .select()
          .single();
        if (error) throw error;
        return data as ContactConsent;
      } catch (err) {
        console.error('Supabase setContactConsent failed, using fallback:', err);
      }
    }

    const consents = getLocalData<ContactConsent[]>(CONTACT_CONSENTS_KEY, []);
    const idx = consents.findIndex((c) => normalizePhoneNumber(c.phone_number) === phone);
    if (idx === -1) {
      consents.push(record);
    } else {
      consents[idx] = record;
    }
    setLocalData(CONTACT_CONSENTS_KEY, consents);
    return record;
  },

  // Event Logs API
  async getEventLogs(): Promise<EventLog[]> {
    // Proactively run migration for any old records missing coupon codes
    await this.migrateExistingLogs();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('event_logs')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Supabase getEventLogs failed, using fallback:', err);
      }
    }
    return getLocalData<EventLog[]>('kiosk_event_logs', []);
  },

  async addEventLog(
    phoneNumber: string,
    prize: Prize,
    options?: { privacyConsent?: boolean }
  ): Promise<EventLog> {
    const timestamp = new Date().toISOString();
    const phone = normalizePhoneNumber(phoneNumber);
    const privacyConsent = options?.privacyConsent ?? true;

    if (privacyConsent) {
      await this.setContactConsent(phone, 'agreed');
    }

    // Generate coupon code if the prize is valid (not try again/fail)
    const isPrize = !prize.name.includes('꽝') && !prize.name.includes('다음 기회에');
    let couponCode = null;
    if (isPrize) {
      const part1 = Math.floor(1000 + Math.random() * 9000);
      const part2 = Math.floor(1000 + Math.random() * 9000);
      couponCode = `C-${part1}-${part2}`;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('event_logs')
          .insert({
            phone_number: phone,
            prize_name: prize.name,
            prize_id: prize.id,
            coupon_code: couponCode,
            is_used: false,
            used_at: null,
            privacy_consent: privacyConsent,
            created_at: timestamp
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Supabase addEventLog failed, using fallback:', err);
      }
    }

    const logs = getLocalData<EventLog[]>('kiosk_event_logs', []);
    const newLog: EventLog = {
      id: logs.length + 1,
      phone_number: phone,
      prize_name: prize.name,
      prize_id: prize.id,
      coupon_code: couponCode,
      is_used: false,
      used_at: null,
      privacy_consent: privacyConsent,
      created_at: timestamp
    };
    logs.unshift(newLog); // Prepend so it's descending order
    setLocalData('kiosk_event_logs', logs);
    return newLog;
  },

  async checkParticipationToday(phoneNumber: string): Promise<boolean> {
    // Get start of today in local time zone
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfTodayIso = today.toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('event_logs')
          .select('id')
          .eq('phone_number', phoneNumber)
          .gte('created_at', startOfTodayIso);
        if (error) throw error;
        return data && data.length > 0;
      } catch (err) {
        console.error('Supabase checkParticipationToday failed, using fallback:', err);
      }
    }

    const logs = getLocalData<EventLog[]>('kiosk_event_logs', []);
    const userTodayLogs = logs.filter(
      (log) => log.phone_number === phoneNumber && log.created_at >= startOfTodayIso
    );
    return userTodayLogs.length > 0;
  },

  // Coupons API
  async checkCoupon(couponCode: string): Promise<EventLog | null> {
    if (isBrowser) {
      const code = couponCode.trim();
      
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('event_logs')
            .select('*')
            .eq('coupon_code', code)
            .maybeSingle();
          if (error) throw error;
          return data;
        } catch (err) {
          console.error('Supabase checkCoupon failed, using fallback:', err);
        }
      }
      
      const logs = getLocalData<EventLog[]>('kiosk_event_logs', []);
      const found = logs.find((l) => l.coupon_code === code);
      return found || null;
    }
    return null;
  },

  async useCoupon(couponCode: string): Promise<EventLog> {
    const code = couponCode.trim();
    const timestamp = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('event_logs')
          .update({ is_used: true, used_at: timestamp })
          .eq('coupon_code', code)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Supabase useCoupon failed, using fallback:', err);
      }
    }

    const logs = getLocalData<EventLog[]>('kiosk_event_logs', []);
    const idx = logs.findIndex((l) => l.coupon_code === code);
    if (idx === -1) {
      throw new Error('쿠폰을 찾을 수 없습니다.');
    }
    
    if (logs[idx].is_used) {
      throw new Error('이미 사용 완료된 쿠폰입니다.');
    }

    logs[idx].is_used = true;
    logs[idx].used_at = timestamp;
    setLocalData('kiosk_event_logs', logs);
    return logs[idx];
  },

  async updateEventLogAlimtalkStatus(
    logId: number,
    status: AlimtalkStatus,
    options?: { error?: string; sentAt?: string }
  ): Promise<void> {
    if (!isBrowser || !logId) return;

    const sentAt =
      status === 'sent' ? options?.sentAt ?? new Date().toISOString() : null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('event_logs')
          .update({
            alimtalk_status: status,
            alimtalk_sent_at: sentAt,
            alimtalk_error: options?.error ?? null,
          })
          .eq('id', logId);
        if (error) throw error;
        return;
      } catch (err) {
        console.error('Supabase updateEventLogAlimtalkStatus failed:', err);
      }
    }

    const logs = getLocalData<EventLog[]>('kiosk_event_logs', []);
    const idx = logs.findIndex((l) => l.id === logId);
    if (idx === -1) return;
    logs[idx] = {
      ...logs[idx],
      alimtalk_status: status,
      alimtalk_sent_at: sentAt,
      alimtalk_error: options?.error ?? null,
    };
    setLocalData('kiosk_event_logs', logs);
  },

  /** 4~5월 임의 연락처 참여 더미 데이터 (최초 1회 자동, 관리자에서 재생성 가능) */
  async seedAprilMayDummyData(options?: {
    year?: number;
    force?: boolean;
  }): Promise<DummySeedResult> {
    if (!isBrowser) {
      return { logsAdded: 0, consentsAdded: 0, consentsUpdated: 0 };
    }

    const year = options?.year ?? new Date().getFullYear();
    const flagKey = `${APR_MAY_DUMMY_SEED_FLAG_PREFIX}${year}`;

    if (!options?.force && localStorage.getItem(flagKey)) {
      return { logsAdded: 0, consentsAdded: 0, consentsUpdated: 0 };
    }

    const salt = options?.force ? Date.now() % 1_000_000 : 0;
    const { logs: seedLogs, consents: seedConsents } = buildAprilMayDummyParticipation(
      year,
      52,
      salt
    );
    const existingLogs = await this.getEventLogs();
    const existingCoupons = new Set(
      existingLogs.map((l) => l.coupon_code).filter((c): c is string => Boolean(c))
    );
    const logsToInsert = seedLogs.filter(
      (l) => l.coupon_code && !existingCoupons.has(l.coupon_code)
    );

    let logsAdded = 0;
    let consentsAdded = 0;
    let consentsUpdated = 0;

    let supabaseLogsOk = false;

    if (isSupabaseConfigured && supabase && logsToInsert.length > 0) {
      try {
        const rows = logsToInsert.map((log) => ({
          phone_number: normalizePhoneNumber(log.phone_number),
          prize_name: log.prize_name,
          prize_id: log.prize_id,
          coupon_code: log.coupon_code,
          is_used: log.is_used ?? false,
          used_at: log.used_at ?? null,
          privacy_consent: log.privacy_consent ?? true,
          created_at: log.created_at,
        }));
        const { error } = await supabase.from('event_logs').insert(rows);
        if (error) throw error;
        logsAdded = logsToInsert.length;
        supabaseLogsOk = true;
      } catch (err) {
        console.error('Supabase seedAprilMayDummyData (logs) failed:', err);
      }
    }

    if (!supabaseLogsOk && logsToInsert.length > 0) {
      const localLogs = getLocalData<EventLog[]>('kiosk_event_logs', []);
      let maxId = localLogs.reduce((max, log) => Math.max(max, log.id ?? 0), 0);
      for (const log of logsToInsert) {
        maxId += 1;
        localLogs.push({
          ...log,
          id: maxId,
          phone_number: normalizePhoneNumber(log.phone_number),
        });
      }
      localLogs.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setLocalData('kiosk_event_logs', localLogs);
      logsAdded = logsToInsert.length;
    }

    const existingConsents = await this.getContactConsents();
    const consentByPhone = new Map(
      existingConsents.map((c) => [normalizePhoneNumber(c.phone_number), c])
    );
    const localConsentAdds: ContactConsent[] = [];

    for (const seedConsent of seedConsents) {
      const phone = normalizePhoneNumber(seedConsent.phone_number);
      const existing = consentByPhone.get(phone);
      const record = { ...seedConsent, phone_number: phone };

      if (!existing) {
        let saved = false;
        if (isSupabaseConfigured && supabase) {
          try {
            const { error } = await supabase.from('contact_consents').upsert(record);
            if (error) throw error;
            saved = true;
          } catch (err) {
            console.error('Supabase seedAprilMayDummyData (consent) failed:', err);
          }
        }

        if (!saved) {
          localConsentAdds.push(record);
        }
        consentByPhone.set(phone, record);
        consentsAdded += 1;
      } else {
        consentsUpdated += 1;
      }
    }

    if (localConsentAdds.length > 0) {
      const localConsents = getLocalData<ContactConsent[]>(CONTACT_CONSENTS_KEY, []);
      setLocalData(CONTACT_CONSENTS_KEY, [...localConsents, ...localConsentAdds]);
    }

    localStorage.setItem(flagKey, String(Date.now()));

    return { logsAdded, consentsAdded, consentsUpdated };
  },
};
