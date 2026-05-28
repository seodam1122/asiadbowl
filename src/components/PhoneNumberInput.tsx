'use client';

import React, { useState } from 'react';
import { db } from '@/lib/db';
import { Phone, Delete, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface PhoneNumberInputProps {
  onVerified: (phoneNumber: string) => void;
}

export default function PhoneNumberInput({ onVerified }: PhoneNumberInputProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format phone number string: e.g. 010-1234-5678
  const formatPhoneNumber = (digits: string) => {
    const clean = digits.replace(/\D/g, '').slice(0, 11);
    if (clean.length <= 3) return clean;
    if (clean.length <= 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7)}`;
  };

  const handleKeyPress = (key: string) => {
    setError(null);
    const rawDigits = phoneNumber.replace(/\D/g, '');

    if (key === 'backspace') {
      if (rawDigits.length > 0) {
        setPhoneNumber(formatPhoneNumber(rawDigits.slice(0, -1)));
      }
    } else if (key === 'clear') {
      setPhoneNumber('');
    } else {
      if (rawDigits.length < 11) {
        setPhoneNumber(formatPhoneNumber(rawDigits + key));
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const rawDigits = phoneNumber.replace(/\D/g, '');

    if (!agreed) {
      setError('이벤트 참여를 위해 개인정보 수집·이용에 동의해 주세요.');
      return;
    }

    if (rawDigits.length < 10) {
      setError('올바른 휴대폰 번호를 입력해 주세요 (최소 10자리).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if user already participated today
      const alreadyParticipated = await db.checkParticipationToday(phoneNumber);
      if (alreadyParticipated) {
        setError('오늘 이미 이벤트에 참여하셨습니다.\n내일 다시 도전해 주세요!');
        setLoading(false);
        return;
      }

      await db.setContactConsent(phoneNumber, 'agreed');
      onVerified(phoneNumber);
    } catch (err) {
      console.error(err);
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const digits = phoneNumber.replace(/\D/g, '');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        className="mx-auto flex w-full max-w-[min(100%,48rem)] flex-1 flex-col items-center justify-center gap-9 px-6 pb-[10vh] pt-2 -translate-y-5"
        style={{ zoom: 1.3 }}
      >
      {/* Title section */}
      <div className="w-full text-center">
        <div className="mb-5 inline-flex rounded-full border border-pink-500/20 bg-gradient-to-tr from-pink-500/10 to-indigo-500/10 p-6">
          <Phone className="h-14 w-14 text-pink-500" />
        </div>
        <h2 className="text-5xl font-black tracking-tight text-zinc-800">
          본인 인증
        </h2>
        <p className="mt-3 text-xl font-medium text-zinc-500">
          중복 참여 방지를 위해 휴대폰 번호를 입력해 주세요.
        </p>
      </div>

      {/* Input panel */}
      <div className="w-full">
        <div className="relative flex min-h-[126px] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-zinc-200 bg-zinc-100 px-8 py-5 text-center">
          <div className="flex w-full justify-center">
            <div className="w-[13ch] whitespace-nowrap text-left text-5xl font-mono font-black tracking-[0.06em] tabular-nums sm:text-6xl">
            {phoneNumber ? (
              <span className="text-zinc-800">{phoneNumber}</span>
            ) : (
              <span className="text-zinc-400">010-1234-5678</span>
            )}
            </div>
          </div>
          {loading && (
            <div className="absolute right-6">
              <Loader2 className="h-9 w-9 animate-spin text-pink-500" />
            </div>
          )}
        </div>

        {/* Error / Status Pop-up inside user UI */}
        {error && (
          <div className="mt-5 flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 animate-pulse">
            <AlertCircle className="mt-0.5 h-9 w-9 shrink-0 text-red-500" />
            <p className="text-base font-semibold leading-normal text-red-600 whitespace-pre-line">
              {error}
            </p>
          </div>
        )}
      </div>

      {/* Keypad and Action Buttons */}
      <div className="w-full space-y-6">
        {/* On screen keyboard grid */}
        <div className="grid grid-cols-3 gap-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="touch-press select-none rounded-3xl border border-zinc-200 bg-white py-7 text-4xl font-bold font-mono text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleKeyPress('clear')}
            className="touch-press select-none rounded-3xl bg-zinc-100 py-7 text-2xl font-black text-zinc-500 hover:bg-zinc-200/80"
          >
            전체삭제
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="touch-press select-none rounded-3xl border border-zinc-200 bg-white py-7 text-4xl font-bold font-mono text-zinc-800 hover:bg-zinc-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('backspace')}
            className="flex touch-press select-none items-center justify-center rounded-3xl bg-zinc-100 py-7 text-zinc-500 hover:bg-zinc-200/80"
          >
            <Delete className="h-10 w-10" />
          </button>
        </div>

        {/* Consent */}
        <div className="space-y-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-7">
          <p className="text-sm leading-relaxed font-medium text-zinc-600">
            <span className="font-bold text-zinc-800">[필수] </span>
            회사는 이벤트 참여자 본인확인, 1인 1일 1회 참여 제한을 위한 중복 참여 검증, 당첨 결과 확인 및
            쿠폰 지급 안내, 부정 이용 방지와 민원 대응을 목적으로 휴대폰 번호를 수집·이용합니다. 필수 항목 미동의 시 이벤트 참여가 제한될 수 있습니다.
          </p>
          <label className="flex cursor-pointer select-none items-center gap-4 touch-press">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setError(null);
              }}
              className="h-8 w-8 shrink-0 cursor-pointer rounded-md border-zinc-300 text-pink-500 focus:ring-pink-500/40"
            />
            <span className="text-xl font-bold leading-none text-zinc-800">
              개인정보 수집·이용에 동의합니다.
            </span>
          </label>
        </div>

        {/* Submit action */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={digits.length < 10 || !agreed || loading}
          className={`flex w-full items-center justify-center gap-3 rounded-3xl py-9 text-3xl font-black shadow-lg touch-press transition-all duration-300 ${
            digits.length >= 10 && agreed && !loading
              ? 'bg-gradient-to-r from-pink-500 to-indigo-600 text-white cursor-pointer active:shadow-indigo-500/20 active:brightness-110 shadow-indigo-500/10'
              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-300/30 shadow-none'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="h-9 w-9 animate-spin" />
              <span>확인 중...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-9 w-9" />
              <span>이벤트 참여하기</span>
            </>
          )}
        </button>
      </div>
      </div>
    </div>
  );
}
