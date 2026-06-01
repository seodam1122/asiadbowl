-- =============================================================================
-- Redsun Kiosk ??Supabase SQL Editor??(?ㅽ궎留?+ 湲곕낯 ?곗씠??
-- ?대?吏 ?낅줈?쒖슜 Storage??supabase/storage.sql ???ㅽ뻾?섏꽭??
-- =============================================================================
-- ?ъ슜踰?
--   1. Supabase Dashboard ??SQL Editor ??New query
--   2. ???뚯씪 ?꾩껜瑜?遺숈뿬?ｊ퀬 Run
--
-- ??湲곕낯媛? src/lib/db.ts (?ㅼ젙쨌寃쏀뭹)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1. ?뚯씠釉??앹꽦
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    active_game VARCHAR(50) NOT NULL DEFAULT 'roulette',
    ad_title TEXT NOT NULL DEFAULT '?꾩떆?꾨뱶 蹂쇰쭅???대깽??,
    ad_subtitle TEXT NOT NULL DEFAULT '?곗튂?섍퀬 ?諛?寃쏀뭹 諛쏆븘媛湲?,
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

-- 湲곗〈 DB 留덉씠洹몃젅?댁뀡 (而щ읆留??놁쓣 ??異붽?)
-- settings: ?덉쟾??留뚮뱺 ?뚯씠釉붿뿉 id ?깆씠 ?놁쓣 ???덉쓬
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS id INTEGER DEFAULT 1;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS active_game VARCHAR(50) DEFAULT 'roulette';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ad_title TEXT DEFAULT '?꾩떆?꾨뱶 蹂쇰쭅???대깽??;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ad_subtitle TEXT DEFAULT '?곗튂?섍퀬 ?諛?寃쏀뭹 諛쏆븘媛湲?;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ad_image_url TEXT DEFAULT 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS admin_password VARCHAR(20) DEFAULT '0077';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
UPDATE public.settings SET id = 1 WHERE id IS NULL;

-- prizes: ?꾨씫 而щ읆 蹂닿컯
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

-- ?ъ씤???곕씫泥섎퀎 ?붿븸쨌嫄곕옒 ?댁뿭)
CREATE TABLE IF NOT EXISTS public.customer_points (
    phone_number VARCHAR(20) PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.point_transactions (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    transaction_type VARCHAR(30) NOT NULL CHECK (
        transaction_type IN ('coupon_earn', 'admin_add', 'admin_subtract')
    ),
    reason TEXT NOT NULL DEFAULT '',
    coupon_code VARCHAR(50) DEFAULT NULL,
    event_log_id INTEGER DEFAULT NULL,
    prize_name VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_phone_created
    ON public.point_transactions (phone_number, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_coupon_earn_unique
    ON public.point_transactions (coupon_code)
    WHERE transaction_type = 'coupon_earn' AND coupon_code IS NOT NULL;

-- -----------------------------------------------------------------------------
-- PART 2. RLS (Row Level Security)
-- -----------------------------------------------------------------------------

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Allow public read customer_points" ON public.customer_points;
DROP POLICY IF EXISTS "Allow public write customer_points" ON public.customer_points;
CREATE POLICY "Allow public read customer_points" ON public.customer_points FOR SELECT USING (true);
CREATE POLICY "Allow public write customer_points" ON public.customer_points FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read point_transactions" ON public.point_transactions;
DROP POLICY IF EXISTS "Allow public write point_transactions" ON public.point_transactions;
CREATE POLICY "Allow public read point_transactions" ON public.point_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public write point_transactions" ON public.point_transactions FOR ALL USING (true);

-- -----------------------------------------------------------------------------
-- PART 3. 湲곕낯 ?ㅼ젙쨌寃쏀뭹 (??DEFAULT ????뼱?곌린)
-- settings???⑥씪 ?됰쭔 ?ъ슜 (湲곗〈 ?됱씠 ?덉쑝硫?UPDATE, ?놁쑝硫?INSERT)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.settings LIMIT 1) THEN
    UPDATE public.settings SET
      id = 1,
      active_game = 'roulette',
      ad_title = '?꾩떆?꾨뱶 蹂쇰쭅???대깽??,
      ad_subtitle = '?곗튂?섍퀬 ?諛?寃쏀뭹 諛쏆븘媛湲?,
      ad_image_url = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80',
      admin_password = '0077',
      updated_at = timezone('utc'::text, now());
  ELSE
    INSERT INTO public.settings (id, active_game, ad_title, ad_subtitle, ad_image_url, admin_password, updated_at)
    VALUES (
      1,
      'roulette',
      '?꾩떆?꾨뱶 蹂쇰쭅???대깽??,
      '?곗튂?섍퀬 ?諛?寃쏀뭹 諛쏆븘媛湲?,
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80',
      '0077',
      timezone('utc'::text, now())
    );
  END IF;
END $$;

INSERT INTO public.prizes (id, name, image_url, probability, updated_at) VALUES
  (1, '臾대즺 1寃뚯엫', 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&auto=format&fit=crop&q=60', 35.00, timezone('utc'::text, now())),
  (2, '2000 point', 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&auto=format&fit=crop&q=60', 35.00, timezone('utc'::text, now())),
  (3, '?뚮즺 ?좏깮沅?, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=60', 15.00, timezone('utc'::text, now())),
  (4, '?ㅻ궢 ?좏깮沅?, 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=400&auto=format&fit=crop&q=60', 15.00, timezone('utc'::text, now()))
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url,
  probability = EXCLUDED.probability,
  updated_at = EXCLUDED.updated_at;

SELECT setval(pg_get_serial_sequence('public.prizes', 'id'), COALESCE((SELECT MAX(id) FROM public.prizes), 1));
