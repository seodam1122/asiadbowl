-- =============================================================================
-- Redsun Kiosk — Supabase SQL Editor용 (스키마 + 기본 데이터 + 샘플 참여 로그)
-- 이미지 업로드용 Storage는 supabase/storage.sql 도 실행하세요.
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
-- settings: 예전에 만든 테이블에 id 등이 없을 수 있음
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS id INTEGER DEFAULT 1;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS active_game VARCHAR(50) DEFAULT 'roulette';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ad_title TEXT DEFAULT '아시아드 볼링장 이벤트';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ad_subtitle TEXT DEFAULT '터치하고 대박 경품 받아가기';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ad_image_url TEXT DEFAULT 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS admin_password VARCHAR(20) DEFAULT '0077';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
UPDATE public.settings SET id = 1 WHERE id IS NULL;

-- prizes: 누락 컬럼 보강
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
-- settings는 단일 행만 사용 (기존 행이 있으면 UPDATE, 없으면 INSERT)
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
-- Auto-generated by scripts/generate-seed-sql.mjs

  ('010-1113-1804', '2000 point', 2, 'C-5697-4271', false, NULL, true, '2026-05-31T03:08:56.040Z'),
  ('010-1127-1902', '스낵 선택권', 4, 'C-5459-3837', true, '2026-05-29T21:02:51.000Z', true, '2026-05-29T20:05:51.000Z'),
  ('010-1113-1804', '2000 point', 2, 'C-5221-3403', false, NULL, true, '2026-05-28T13:02:45.960Z'),
  ('010-1114-1811', '음료 선택권', 3, 'C-5714-4302', true, '2026-05-26T22:55:26.400Z', true, '2026-05-26T21:43:26.400Z'),
  ('010-1100-1713', '무료 1게임', 1, 'C-5476-3868', false, NULL, true, '2026-05-25T14:40:21.360Z'),
  ('010-1114-1811', '음료 선택권', 3, 'C-5238-3434', false, NULL, true, '2026-05-24T07:37:16.320Z'),
  ('010-1100-1713', '무료 1게임', 1, 'C-5000-3000', true, '2026-05-23T01:04:11.280Z', true, '2026-05-23T00:34:11.280Z'),
  ('010-1115-1818', '스낵 선택권', 4, 'C-5731-4333', false, NULL, true, '2026-05-22T16:17:56.760Z'),
  ('010-1101-1720', '2000 point', 2, 'C-5493-3899', false, NULL, true, '2026-05-21T09:14:51.720Z'),
  ('010-1115-1818', '스낵 선택권', 4, 'C-5255-3465', true, '2026-05-20T02:56:46.680Z', true, '2026-05-20T02:11:46.680Z'),
  ('010-1101-1720', '2000 point', 2, 'C-5017-3031', false, NULL, true, '2026-05-18T19:08:41.640Z'),
  ('010-1116-1825', '무료 1게임', 1, 'C-5748-4364', false, NULL, true, '2026-05-18T10:52:27.120Z'),
  ('010-1102-1727', '음료 선택권', 3, 'C-5510-3930', true, '2026-05-17T04:49:22.080Z', true, '2026-05-17T03:49:22.080Z'),
  ('010-1116-1825', '무료 1게임', 1, 'C-5272-3496', false, NULL, true, '2026-05-15T20:46:17.039Z'),
  ('010-1102-1727', '음료 선택권', 3, 'C-5034-3062', false, NULL, true, '2026-05-14T13:43:12.000Z'),
  ('010-1117-1832', '2000 point', 2, 'C-5765-4395', true, '2026-05-14T06:41:57.480Z', true, '2026-05-14T05:26:57.480Z'),
  ('010-1103-1734', '스낵 선택권', 4, 'C-5527-3961', false, NULL, true, '2026-05-12T22:23:52.440Z'),
  ('010-1117-1832', '2000 point', 2, 'C-5289-3527', false, NULL, true, '2026-05-11T15:20:47.400Z'),
  ('010-1103-1734', '스낵 선택권', 4, 'C-5051-3093', true, '2026-05-10T08:50:42.360Z', true, '2026-05-10T08:17:42.360Z'),
  ('010-1118-1839', '음료 선택권', 3, 'C-5782-4426', false, NULL, true, '2026-05-10T00:01:27.840Z'),
  ('010-1104-1741', '무료 1게임', 1, 'C-5544-3992', false, NULL, true, '2026-05-08T16:58:22.800Z'),
  ('010-1118-1839', '음료 선택권', 3, 'C-5306-3558', true, '2026-05-07T10:43:17.760Z', true, '2026-05-07T09:55:17.760Z'),
  ('010-1104-1741', '무료 1게임', 1, 'C-5068-3124', false, NULL, true, '2026-05-06T02:52:12.720Z'),
  ('010-1119-1846', '스낵 선택권', 4, 'C-5799-4457', false, NULL, true, '2026-05-05T18:35:58.200Z'),
  ('010-1105-1748', '2000 point', 2, 'C-5561-4023', true, '2026-05-04T12:35:53.160Z', true, '2026-05-04T11:32:53.160Z'),
  ('010-1119-1846', '스낵 선택권', 4, 'C-5323-3589', false, NULL, true, '2026-05-03T04:29:48.119Z'),
  ('010-1105-1748', '2000 point', 2, 'C-5085-3155', false, NULL, true, '2026-05-01T21:26:43.080Z'),
  ('010-1120-1853', '무료 1게임', 1, 'C-5816-4488', true, '2026-05-01T14:28:28.560Z', true, '2026-05-01T13:10:28.560Z'),
  ('010-1106-1755', '음료 선택권', 3, 'C-5578-4054', false, NULL, true, '2026-04-30T06:07:23.520Z'),
  ('010-1120-1853', '무료 1게임', 1, 'C-5340-3620', false, NULL, true, '2026-04-28T23:04:18.480Z'),
  ('010-1106-1755', '음료 선택권', 3, 'C-5102-3186', true, '2026-04-27T16:37:13.440Z', true, '2026-04-27T16:01:13.440Z'),
  ('010-1121-1860', '2000 point', 2, 'C-5833-4519', false, NULL, true, '2026-04-27T07:44:58.920Z'),
  ('010-1107-1762', '스낵 선택권', 4, 'C-5595-4085', false, NULL, true, '2026-04-26T00:41:53.880Z'),
  ('010-1121-1860', '2000 point', 2, 'C-5357-3651', true, '2026-04-24T18:29:48.840Z', true, '2026-04-24T17:38:48.840Z'),
  ('010-1107-1762', '스낵 선택권', 4, 'C-5119-3217', false, NULL, true, '2026-04-23T10:35:43.800Z'),
  ('010-1122-1867', '음료 선택권', 3, 'C-5850-4550', false, NULL, true, '2026-04-23T02:19:29.280Z'),
  ('010-1108-1769', '무료 1게임', 1, 'C-5612-4116', true, '2026-04-21T20:22:24.240Z', true, '2026-04-21T19:16:24.240Z'),
  ('010-1122-1867', '음료 선택권', 3, 'C-5374-3682', false, NULL, true, '2026-04-20T12:13:19.200Z'),
  ('010-1108-1769', '무료 1게임', 1, 'C-5136-3248', false, NULL, true, '2026-04-19T05:10:14.160Z'),
  ('010-1123-1874', '스낵 선택권', 4, 'C-5867-4581', true, '2026-04-18T22:14:59.640Z', true, '2026-04-18T20:53:59.640Z'),
  ('010-1109-1776', '2000 point', 2, 'C-5629-4147', false, NULL, true, '2026-04-17T13:50:54.600Z'),
  ('010-1123-1874', '스낵 선택권', 4, 'C-5391-3713', false, NULL, true, '2026-04-16T06:47:49.560Z'),
  ('010-1109-1776', '2000 point', 2, 'C-5153-3279', true, '2026-04-15T00:23:44.520Z', true, '2026-04-14T23:44:44.520Z'),
  ('010-1110-1783', '음료 선택권', 3, 'C-5646-4178', false, NULL, true, '2026-04-13T08:25:24.960Z'),
  ('010-1124-1881', '무료 1게임', 1, 'C-5408-3744', true, '2026-04-12T02:16:19.920Z', true, '2026-04-12T01:22:19.920Z'),
  ('010-1110-1783', '음료 선택권', 3, 'C-5170-3310', false, NULL, true, '2026-04-10T18:19:14.880Z'),
  ('010-1111-1790', '스낵 선택권', 4, 'C-5663-4209', true, '2026-04-09T04:08:55.320Z', true, '2026-04-09T02:59:55.320Z'),
  ('010-1125-1888', '2000 point', 2, 'C-5425-3775', false, NULL, true, '2026-04-07T19:56:50.280Z'),
  ('010-1111-1790', '스낵 선택권', 4, 'C-5187-3341', false, NULL, true, '2026-04-06T12:53:45.240Z'),
  ('010-1112-1797', '무료 1게임', 1, 'C-5680-4240', false, NULL, true, '2026-04-04T21:34:25.680Z'),
  ('010-1126-1895', '음료 선택권', 3, 'C-5442-3806', false, NULL, true, '2026-04-03T14:31:20.640Z'),
  ('010-1112-1797', '무료 1게임', 1, 'C-5204-3372', true, '2026-04-02T08:10:15.600Z', true, '2026-04-02T07:28:15.600Z')
ON CONFLICT (coupon_code) DO NOTHING;

INSERT INTO public.contact_consents (
  phone_number, consent_status, agreed_at, declined_at, updated_at
) VALUES
('010-1100-1713', 'agreed', '2026-05-23T00:34:11.280Z', NULL, '2026-05-23T00:34:11.280Z'),
  ('010-1101-1720', 'agreed', '2026-05-18T19:08:41.640Z', NULL, '2026-05-18T19:08:41.640Z'),
  ('010-1102-1727', 'declined', NULL, '2026-05-17T13:43:12.000Z', '2026-05-17T13:43:12.000Z'),
  ('010-1103-1734', 'agreed', '2026-05-10T08:17:42.360Z', NULL, '2026-05-10T08:17:42.360Z'),
  ('010-1104-1741', 'agreed', '2026-05-06T02:52:12.720Z', NULL, '2026-05-06T02:52:12.720Z'),
  ('010-1105-1748', 'agreed', '2026-05-01T21:26:43.080Z', NULL, '2026-05-01T21:26:43.080Z'),
  ('010-1106-1755', 'agreed', '2026-04-27T16:01:13.440Z', NULL, '2026-04-27T16:01:13.440Z'),
  ('010-1107-1762', 'agreed', '2026-04-23T10:35:43.800Z', NULL, '2026-04-23T10:35:43.800Z'),
  ('010-1108-1769', 'agreed', '2026-04-19T05:10:14.160Z', NULL, '2026-04-19T05:10:14.160Z'),
  ('010-1109-1776', 'declined', NULL, '2026-04-17T23:44:44.520Z', '2026-04-17T23:44:44.520Z'),
  ('010-1110-1783', 'agreed', '2026-04-10T18:19:14.880Z', NULL, '2026-04-10T18:19:14.880Z'),
  ('010-1111-1790', 'agreed', '2026-04-06T12:53:45.240Z', NULL, '2026-04-06T12:53:45.240Z'),
  ('010-1112-1797', 'agreed', '2026-04-02T07:28:15.600Z', NULL, '2026-04-02T07:28:15.600Z'),
  ('010-1113-1804', 'agreed', '2026-05-28T13:02:45.960Z', NULL, '2026-05-28T13:02:45.960Z'),
  ('010-1114-1811', 'agreed', '2026-05-24T07:37:16.320Z', NULL, '2026-05-24T07:37:16.320Z'),
  ('010-1115-1818', 'agreed', '2026-05-20T02:11:46.680Z', NULL, '2026-05-20T02:11:46.680Z'),
  ('010-1116-1825', 'agreed', '2026-05-15T20:46:17.039Z', NULL, '2026-05-15T20:46:17.039Z'),
  ('010-1117-1832', 'agreed', '2026-05-11T15:20:47.400Z', NULL, '2026-05-11T15:20:47.400Z'),
  ('010-1118-1839', 'agreed', '2026-05-07T09:55:17.760Z', NULL, '2026-05-07T09:55:17.760Z'),
  ('010-1119-1846', 'agreed', '2026-05-03T04:29:48.119Z', NULL, '2026-05-03T04:29:48.119Z'),
  ('010-1120-1853', 'declined', NULL, '2026-05-01T23:04:18.480Z', '2026-05-01T23:04:18.480Z'),
  ('010-1121-1860', 'agreed', '2026-04-24T17:38:48.840Z', NULL, '2026-04-24T17:38:48.840Z'),
  ('010-1122-1867', 'agreed', '2026-04-20T12:13:19.200Z', NULL, '2026-04-20T12:13:19.200Z'),
  ('010-1123-1874', 'agreed', '2026-04-16T06:47:49.560Z', NULL, '2026-04-16T06:47:49.560Z'),
  ('010-1124-1881', 'agreed', '2026-04-12T01:22:19.920Z', NULL, '2026-04-12T01:22:19.920Z'),
  ('010-1125-1888', 'agreed', '2026-04-07T19:56:50.280Z', NULL, '2026-04-07T19:56:50.280Z'),
  ('010-1126-1895', 'agreed', '2026-04-03T14:31:20.640Z', NULL, '2026-04-03T14:31:20.640Z'),
  ('010-1127-1902', 'agreed', '2026-05-29T20:05:51.000Z', NULL, '2026-05-29T20:05:51.000Z')
ON CONFLICT (phone_number) DO UPDATE SET
  consent_status = EXCLUDED.consent_status,
  agreed_at = EXCLUDED.agreed_at,
  declined_at = EXCLUDED.declined_at,
  updated_at = EXCLUDED.updated_at;

