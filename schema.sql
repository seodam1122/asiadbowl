-- ==========================================
-- Supabase Schema for Portrait Kiosk Event Web App
-- ==========================================
-- Supabase SQL Editor에 붙여넣을 전체 스크립트(스키마+INSERT)는
-- supabase/supabase-sql-editor.sql 파일을 사용하세요.
-- ==========================================

-- 1. Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    active_game VARCHAR(50) NOT NULL DEFAULT 'roulette', -- 'roulette', 'scratch', 'spot_diff', 'hidden_obj'
    ad_title TEXT NOT NULL DEFAULT '특별한 혜택, 지금 바로 참여하세요!',
    ad_subtitle TEXT NOT NULL DEFAULT '터치하고 대박 경품 받아가기',
    ad_image_url TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80',
    admin_password VARCHAR(20) NOT NULL DEFAULT '0077',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT one_row_only CHECK (id = 1) -- Ensures only a single settings record exists
);

-- Enable RLS for settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow public write access to settings" ON public.settings FOR ALL USING (true); -- Kiosk client side updates permitted

-- Insert default single record
INSERT INTO public.settings (id, active_game, ad_title, ad_subtitle, ad_image_url, admin_password)
VALUES (1, 'roulette', '특별한 혜택, 지금 바로 참여하세요!', '터치하고 대박 경품 받아가기', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80', '0077')
ON CONFLICT (id) DO UPDATE SET
    active_game = EXCLUDED.active_game,
    ad_title = EXCLUDED.ad_title,
    ad_subtitle = EXCLUDED.ad_subtitle,
    ad_image_url = EXCLUDED.ad_image_url;

-- 2. Create prizes table
CREATE TABLE IF NOT EXISTS public.prizes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image_url TEXT NOT NULL,
    probability DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- e.g. 10.00 for 10%
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for prizes
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to prizes" ON public.prizes FOR SELECT USING (true);
CREATE POLICY "Allow public write access to prizes" ON public.prizes FOR ALL USING (true);

-- Insert default prizes (must sum up to 100%)
INSERT INTO public.prizes (name, image_url, probability) VALUES
('스타벅스 아메리카노', 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&auto=format&fit=crop&q=60', 10.00),
('신세계 상품권 1만원', 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&auto=format&fit=crop&q=60', 5.00),
('비타500', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=60', 50.00),
('다음 기회에 (꽝)', 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=400&auto=format&fit=crop&q=60', 35.00);

-- 3. Create event_logs table
CREATE TABLE IF NOT EXISTS public.event_logs (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    prize_name VARCHAR(100) NOT NULL,
    prize_id INT REFERENCES public.prizes(id) ON DELETE SET NULL,
    coupon_code VARCHAR(50) UNIQUE,
    is_used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for event_logs
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to event_logs" ON public.event_logs FOR SELECT USING (true);
CREATE POLICY "Allow public write access to event_logs" ON public.event_logs FOR INSERT WITH CHECK (true);
-- Allow public updates to event_logs for coupon validation
CREATE POLICY "Allow public update access to event_logs" ON public.event_logs FOR UPDATE USING (true);
-- NOTE: DELETE 정책 없음 — 삭제는 서버 API(/api/admin/delete-logs)에서 service_role 키로만 수행

-- Index for phone number search optimization
CREATE INDEX IF NOT EXISTS idx_event_logs_phone_date ON public.event_logs (phone_number, created_at);

-- Migration block: Add columns to event_logs if they do not exist (for existing databases)
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50) UNIQUE;
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS is_used BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for coupon code lookup optimization
CREATE INDEX IF NOT EXISTS idx_event_logs_coupon_code ON public.event_logs (coupon_code);

-- Migration: consent snapshot on each participation
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS privacy_consent BOOLEAN NOT NULL DEFAULT true;

-- Migration: Kakao Alimtalk send status
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS alimtalk_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS alimtalk_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.event_logs ADD COLUMN IF NOT EXISTS alimtalk_error TEXT DEFAULT NULL;

-- 4. Contact consent registry (per phone number — current status)
CREATE TABLE IF NOT EXISTS public.contact_consents (
    phone_number VARCHAR(20) PRIMARY KEY,
    consent_status VARCHAR(20) NOT NULL DEFAULT 'agreed' CHECK (consent_status IN ('agreed', 'declined')),
    agreed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    declined_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.contact_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to contact_consents" ON public.contact_consents FOR SELECT USING (true);
CREATE POLICY "Allow public write access to contact_consents" ON public.contact_consents FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_contact_consents_status ON public.contact_consents (consent_status);
