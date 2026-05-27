-- =============================================================================
-- 연락처(휴대폰) 기반 포인트 — Supabase SQL Editor에서 실행
-- =============================================================================

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

-- 동일 쿠폰 중복 적립 방지 (쿠폰 적립 건만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_coupon_earn_unique
    ON public.point_transactions (coupon_code)
    WHERE transaction_type = 'coupon_earn' AND coupon_code IS NOT NULL;

ALTER TABLE public.customer_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read customer_points" ON public.customer_points;
DROP POLICY IF EXISTS "Allow public write customer_points" ON public.customer_points;
CREATE POLICY "Allow public read customer_points" ON public.customer_points FOR SELECT USING (true);
CREATE POLICY "Allow public write customer_points" ON public.customer_points FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read point_transactions" ON public.point_transactions;
DROP POLICY IF EXISTS "Allow public write point_transactions" ON public.point_transactions;
CREATE POLICY "Allow public read point_transactions" ON public.point_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public write point_transactions" ON public.point_transactions FOR ALL USING (true);
