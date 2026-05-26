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
    <div className="flex-1 flex flex-col justify-between p-6">
      {/* Title section */}
      <div className="text-center pt-8">
        <div className="inline-flex p-3.5 bg-gradient-to-tr from-pink-500/10 to-indigo-500/10 rounded-full border border-pink-500/20 mb-4 animate-bounce">
          <Phone className="w-8 h-8 text-pink-500" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-zinc-800">
          본인 인증
        </h2>
        <p className="text-sm text-zinc-500 mt-2 font-medium">
          중복 참여 방지를 위해 휴대폰 번호를 입력해 주세요.
        </p>
      </div>

      {/* Input panel */}
      <div className="my-6">
        <div className="w-full py-4 px-6 rounded-2xl bg-zinc-100 border border-zinc-200 text-center relative overflow-hidden flex items-center justify-center min-h-[72px]">
          {phoneNumber ? (
            <span className="text-3xl font-mono font-black tracking-widest text-zinc-800">
              {phoneNumber}
            </span>
          ) : (
            <span className="text-xl text-zinc-400 font-medium">010-0000-0000</span>
          )}
          {loading && (
            <div className="absolute right-4">
              <Loader2 className="w-5 h-5 animate-spin text-pink-500" />
            </div>
          )}
        </div>

        {/* Error / Status Pop-up inside user UI */}
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex gap-3 items-start animate-pulse">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-red-600 leading-normal whitespace-pre-line">
              {error}
            </p>
          </div>
        )}
      </div>

      {/* Keypad and Action Buttons */}
      <div className="w-full space-y-4 pb-4">
        {/* On screen keyboard grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="py-4 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-xl font-bold font-mono text-zinc-800 touch-press transition-colors shadow-sm select-none"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleKeyPress('clear')}
            className="py-4 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-xs font-bold text-zinc-500 touch-press select-none"
          >
            전체삭제
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="py-4 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-xl font-bold font-mono text-zinc-800 touch-press select-none"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('backspace')}
            className="py-4 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 flex items-center justify-center text-zinc-500 touch-press select-none"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Consent */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
          <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
            <span className="font-bold text-zinc-800">[필수] </span>
            이벤트 참여·중복 방지·당첨 안내(카카오 알림톡)를 위해 휴대폰 번호를 수집·이용합니다. (보유 기간: 이벤트 종료 후 1년)
          </p>
          <label className="flex items-start gap-3 cursor-pointer select-none touch-press">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setError(null);
              }}
              className="mt-0.5 w-5 h-5 shrink-0 rounded border-zinc-300 text-pink-500 focus:ring-pink-500/40 cursor-pointer"
            />
            <span className="text-xs font-bold text-zinc-800 leading-snug">
              개인정보 수집·이용에 동의합니다.
            </span>
          </label>
        </div>

        {/* Submit action */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={digits.length < 10 || !agreed || loading}
          className={`w-full py-4.5 rounded-2xl font-bold text-lg shadow-lg touch-press transition-all duration-300 flex items-center justify-center gap-2 ${
            digits.length >= 10 && agreed && !loading
              ? 'bg-gradient-to-r from-pink-500 to-indigo-600 text-white cursor-pointer active:shadow-indigo-500/20 active:brightness-110 shadow-indigo-500/10'
              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-300/30 shadow-none'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>확인 중...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>이벤트 참여하기</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
