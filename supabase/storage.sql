-- Supabase Storage: 키오스크 광고·경품 이미지
-- SQL Editor에서 schema 적용 후 이 파일도 실행하세요.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kiosk-media',
  'kiosk-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "kiosk_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "kiosk_media_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "kiosk_media_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "kiosk_media_anon_delete" ON storage.objects;

CREATE POLICY "kiosk_media_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'kiosk-media');

CREATE POLICY "kiosk_media_anon_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kiosk-media');

CREATE POLICY "kiosk_media_anon_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'kiosk-media');

CREATE POLICY "kiosk_media_anon_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'kiosk-media');
