import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = fs.readFileSync(path.join(root, 'supabase', 'seed-data.generated.sql'), 'utf8');
const [logRows, consentSection] = generated.split('\n\n-- consents\n');

const header = `-- =============================================================================
-- Redsun Kiosk — Supabase SQL Editor용 (스키마 + 기본 데이터 + 샘플 참여 로그)
-- =============================================================================
-- 사용법:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. 이 파일 전체를 붙여넣고 Run
--   3. 이미 테이블이 있고 데이터만 갱신하려면 PART 4 주석을 참고하세요.
--
-- 앱 기본값: src/lib/db.ts (설정·경품 4종)
-- 샘플 참여 52건: 2026년 4~5월 더미 (관리자 자동 시드와 동일)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1. 테이블 생성
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    active_game VARCHAR(50) NOT NULL DEFAULT 'roulette',
    ad_title TEXT NOT NULL DEFAULT '아시아드 볼링장 이벤트',
    ad_subtitle TEXT NOT NULL DEFAULT '터치하고 대박 경품 받아가기',
    ad_image_url TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80',
    admin_password VARCHAR(20) NOT NULL DEFAULT '0077',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT settings_one_row_only CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS public.prizes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image_url TEXT NOT NULL,
    probability DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.event_logs (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    prize_name VARCHAR(100) NOT NULL,
    prize_id INT REFERENCES public.prizes(id) ON DELETE SET NULL,
    coupon_code VARCHAR(50) UNIQUE,
    is_used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMPTZ DEFAULT NULL,
    privacy_consent BOOLEAN NOT NULL DEFAULT true,
    alimtalk_status VARCHAR(20) DEFAULT NULL,
    alimtalk_sent_at TIMESTAMPTZ DEFAULT NULL,
    alimtalk_error TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.contact_consents (
    phone_number VARCHAR(20) PRIMARY KEY,
    consent_status VARCHAR(20) NOT NULL DEFAULT 'agreed' CHECK (consent_status IN ('agreed', 'declined')),
    agreed_at TIMESTAMPTZ DEFAULT NULL,
    declined_at TIMESTAMPTZ DEFAULT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 기존 DB 마이그레이션 (컬럼만 없을 때 추가)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS id INTEGER DEFAULT 1;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS active_game VARCHAR(50) DEFAULT 'roulette';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ad_title TEXT DEFAULT '아시아드 볼링장 이벤트';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ad_subtitle TEXT DEFAULT '터치하고 대박 경품 받아가기';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ad_image_url TEXT DEFAULT 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS admin_password VARCHAR(20) DEFAULT '0077';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
UPDATE public.settings SET id = 1 WHERE id IS NULL;

ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS probability DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS is_used BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS privacy_consent BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS alimtalk_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS alimtalk_sent_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS alimtalk_error TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_logs_coupon_code_key ON public.event_logs (coupon_code);
CREATE INDEX IF NOT EXISTS idx_event_logs_phone_date ON public.event_logs (phone_number, created_at);
CREATE INDEX IF NOT EXISTS idx_event_logs_coupon_code ON public.event_logs (coupon_code);
CREATE INDEX IF NOT EXISTS idx_contact_consents_status ON public.contact_consents (consent_status);

-- -----------------------------------------------------------------------------
-- PART 2. RLS (Row Level Security)
-- -----------------------------------------------------------------------------

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to settings" ON public.settings;
DROP POLICY IF EXISTS "Allow public write access to settings" ON public.settings;
CREATE POLICY "Allow public read access to settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow public write access to settings" ON public.settings FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access to prizes" ON public.prizes;
DROP POLICY IF EXISTS "Allow public write access to prizes" ON public.prizes;
CREATE POLICY "Allow public read access to prizes" ON public.prizes FOR SELECT USING (true);
CREATE POLICY "Allow public write access to prizes" ON public.prizes FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access to event_logs" ON public.event_logs;
DROP POLICY IF EXISTS "Allow public insert access to event_logs" ON public.event_logs;
DROP POLICY IF EXISTS "Allow public update access to event_logs" ON public.event_logs;
CREATE POLICY "Allow public read access to event_logs" ON public.event_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to event_logs" ON public.event_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to event_logs" ON public.event_logs FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public read access to contact_consents" ON public.contact_consents;
DROP POLICY IF EXISTS "Allow public write access to contact_consents" ON public.contact_consents;
CREATE POLICY "Allow public read access to contact_consents" ON public.contact_consents FOR SELECT USING (true);
CREATE POLICY "Allow public write access to contact_consents" ON public.contact_consents FOR ALL USING (true);

-- -----------------------------------------------------------------------------
-- PART 3. 기본 설정·경품 (앱 DEFAULT — 덮어쓰기)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.settings LIMIT 1) THEN
    UPDATE public.settings SET
      id = 1,
      active_game = 'roulette',
      ad_title = '아시아드 볼링장 이벤트',
      ad_subtitle = '터치하고 대박 경품 받아가기',
      ad_image_url = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80',
      admin_password = '0077',
      updated_at = timezone('utc'::text, now());
  ELSE
    INSERT INTO public.settings (id, active_game, ad_title, ad_subtitle, ad_image_url, admin_password, updated_at)
    VALUES (
      1,
      'roulette',
      '아시아드 볼링장 이벤트',
      '터치하고 대박 경품 받아가기',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80',
      '0077',
      timezone('utc'::text, now())
    );
  END IF;
END $$;

INSERT INTO public.prizes (id, name, image_url, probability, updated_at) VALUES
  (1, '무료 1게임', 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&auto=format&fit=crop&q=60', 35.00, timezone('utc'::text, now())),
  (2, '2000 point', 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&auto=format&fit=crop&q=60', 35.00, timezone('utc'::text, now())),
  (3, '음료 선택권', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=60', 15.00, timezone('utc'::text, now())),
  (4, '스낵 선택권', 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=400&auto=format&fit=crop&q=60', 15.00, timezone('utc'::text, now()))
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url,
  probability = EXCLUDED.probability,
  updated_at = EXCLUDED.updated_at;

SELECT setval(pg_get_serial_sequence('public.prizes', 'id'), COALESCE((SELECT MAX(id) FROM public.prizes), 1));

-- -----------------------------------------------------------------------------
-- PART 4. 샘플 참여 로그·동의 (2026년 4~5월, 52건 / 28명)
-- 이미 같은 쿠폰 번호가 있으면 건너뜁니다. 처음부터 다시 넣으려면 아래 TRUNCATE 주석 해제
-- -----------------------------------------------------------------------------

-- TRUNCATE public.event_logs RESTART IDENTITY CASCADE;
-- TRUNCATE public.contact_consents;

INSERT INTO public.event_logs (
  phone_number, prize_name, prize_id, coupon_code, is_used, used_at, privacy_consent, created_at
) VALUES
${logRows.trim()}
ON CONFLICT (coupon_code) DO NOTHING;

INSERT INTO public.contact_consents (
  phone_number, consent_status, agreed_at, declined_at, updated_at
) VALUES
${consentSection.trim()}
ON CONFLICT (phone_number) DO UPDATE SET
  consent_status = EXCLUDED.consent_status,
  agreed_at = EXCLUDED.agreed_at,
  declined_at = EXCLUDED.declined_at,
  updated_at = EXCLUDED.updated_at;

`;

const out = path.join(root, 'supabase', 'supabase-sql-editor.sql');
fs.writeFileSync(out, header, 'utf8');
console.log('Wrote', out);
