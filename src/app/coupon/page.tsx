'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { generateAndDownloadCouponImage } from '@/lib/coupon-image';
import type { CouponImageInput } from '@/lib/coupon-image';

type Status = 'loading' | 'done' | 'error';

function CouponDownloadContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('c')?.trim() ?? '';

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('쿠폰 이미지를 준비하고 있습니다…');
  const [couponData, setCouponData] = useState<CouponImageInput | null>(null);

  const runDownload = useCallback(async (couponCode: string) => {
    setStatus('loading');
    setMessage('쿠폰 이미지를 준비하고 있습니다…');

    const res = await fetch(`/api/coupon/info?code=${encodeURIComponent(couponCode)}`);
    const payload = (await res.json()) as CouponImageInput & { error?: string };
    if (!res.ok) {
      throw new Error(payload.error || '쿠폰 정보를 불러올 수 없습니다.');
    }

    const input: CouponImageInput = {
      couponCode: payload.couponCode,
      prizeName: payload.prizeName,
      prizeImageUrl: payload.prizeImageUrl,
      eventTitle: payload.eventTitle,
      createdAt: payload.createdAt,
    };
    setCouponData(input);
    await generateAndDownloadCouponImage(input);
    setStatus('done');
    setMessage('쿠폰 이미지가 저장되었습니다. 갤러리 또는 다운로드 폴더를 확인해 주세요.');
  }, []);

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setMessage('쿠폰 번호가 없습니다. QR 코드를 다시 스캔해 주세요.');
      return;
    }
    runDownload(code).catch((err) => {
      console.error(err);
      setStatus('error');
      setMessage(err instanceof Error ? err.message : '쿠폰 이미지 저장에 실패했습니다.');
    });
  }, [code, runDownload]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-indigo-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-3xl shadow-lg p-8 space-y-5">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-pink-500 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-zinc-700">{message}</p>
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-zinc-800">{message}</p>
            {couponData && (
              <p className="text-xs text-zinc-500 font-mono">{couponData.couponCode}</p>
            )}
            <button
              type="button"
              onClick={() => runDownload(code)}
              className="w-full py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              다시 저장하기
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-sm font-semibold text-red-600 whitespace-pre-line">{message}</p>
            {code && (
              <button
                type="button"
                onClick={() => runDownload(code)}
                className="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold text-sm"
              >
                다시 시도
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CouponDownloadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
        </div>
      }
    >
      <CouponDownloadContent />
    </Suspense>
  );
}
