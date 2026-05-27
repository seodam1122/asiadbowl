-- =============================================================================
-- 오늘(한국시간 KST) 0시 이후 입력된 참여·동의 데이터 삭제
-- =============================================================================
-- 대상: event_logs, contact_consents
-- 제외: settings, prizes (키오스크 설정·경품 마스터)
-- Storage(이미지)는 Supabase Dashboard → Storage에서 별도 삭제
--
-- 해석 안내
--   · "오늘부터 쌓인 데이터" → 아래 그대로 실행 (오늘 00:00 KST 이상)
--   · "내일 0시 이후만" (오늘은 남김) → DELETE 조건을 today_end_kst 로 변경
--   · "오늘 이전만" (과거 테스트만 삭제) → created_at < today_start_kst
--
-- 사용: SQL Editor → 붙여넣기 → 1) 미리보기 SELECT → 2) DELETE → COMMIT
-- =============================================================================

BEGIN;

-- 한국시간 오늘 00:00 (timestamptz)
WITH bounds AS (
  SELECT
    (date_trunc('day', (now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul') AS today_start_kst,
    ((date_trunc('day', (now() AT TIME ZONE 'Asia/Seoul')) + interval '1 day') AT TIME ZONE 'Asia/Seoul') AS today_end_kst
)
SELECT
  b.today_start_kst AS "삭제 기준(이 시각 이상)",
  (SELECT count(*) FROM public.event_logs e, bounds b WHERE e.created_at >= b.today_start_kst) AS "삭제 예정 event_logs",
  (SELECT count(*) FROM public.contact_consents c, bounds b
   WHERE c.updated_at >= b.today_start_kst
      OR c.agreed_at >= b.today_start_kst
      OR c.declined_at >= b.today_start_kst) AS "삭제 예정 contact_consents"
FROM bounds b;

-- ----- 삭제 (확인 후 주석 해제) -----

-- 1) 참여 로그 (쿠폰·당첨 기록)
DELETE FROM public.event_logs e
USING (
  SELECT (date_trunc('day', (now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul') AS today_start_kst
) b
WHERE e.created_at >= b.today_start_kst;

-- 2) 연락처 동의 (오늘 갱신·동의/거부한 번호)
DELETE FROM public.contact_consents c
USING (
  SELECT (date_trunc('day', (now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul') AS today_start_kst
) b
WHERE c.updated_at >= b.today_start_kst
   OR c.agreed_at >= b.today_start_kst
   OR c.declined_at >= b.today_start_kst;

-- 3) (선택) 오늘 로그에만 있던 번호의 동의만 남기고 싶다면, 위 2번 대신:
-- DELETE FROM public.contact_consents c
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.event_logs e
--   WHERE e.phone_number = c.phone_number
--     AND e.created_at < (date_trunc('day', (now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul')
-- );

COMMIT;

-- =============================================================================
-- 고정 날짜로 삭제할 때 (예: 2026-05-26 KST 이후만)
-- =============================================================================
-- BEGIN;
-- DELETE FROM public.event_logs
-- WHERE created_at >= timestamptz '2026-05-26 00:00:00+09';
-- DELETE FROM public.contact_consents
-- WHERE updated_at >= timestamptz '2026-05-26 00:00:00+09'
--    OR agreed_at >= timestamptz '2026-05-26 00:00:00+09'
--    OR declined_at >= timestamptz '2026-05-26 00:00:00+09';
-- COMMIT;
