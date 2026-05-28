'use client';

import React, { useState, useEffect, useRef } from 'react';
import KioskContainer from '@/components/KioskContainer';
import KioskPortraitImage from '@/components/KioskPortraitImage';
import PhoneNumberInput from '@/components/PhoneNumberInput';
import RouletteGame from '@/components/RouletteGame';
import ScratchCardGame from '@/components/ScratchCardGame';
import SpotDifferenceGame from '@/components/SpotDifferenceGame';
import HiddenObjectGame from '@/components/HiddenObjectGame';
import { db, KioskSettings, Prize } from '@/lib/db';
import { requestCouponAlimtalk } from '@/lib/send-coupon-alimtalk-client';
import { Sparkles, RefreshCw, Gift, Trophy, ArrowRight, Volume2, ChevronLeft } from 'lucide-react';
import { generateCouponQrDataUrl } from '@/lib/coupon-qr';
import confetti from 'canvas-confetti';

type FlowStep = 'landing' | 'auth' | 'select_game' | 'game' | 'result';

const RESULT_AUTO_RESET_SECONDS = 60;

export default function UserKioskPage() {
  const [step, setStep] = useState<FlowStep>('landing');
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [generatedCoupon, setGeneratedCoupon] = useState<string | null>(null);
  const [alimtalkNotice, setAlimtalkNotice] = useState<string | null>(null);
  const [couponQrDataUrl, setCouponQrDataUrl] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string>('roulette');
  const [gameSession, setGameSession] = useState(0);
  const [spotDiffSceneIndex, setSpotDiffSceneIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Timer for auto-resetting the kiosk result screen
  const [resetTimer, setResetTimer] = useState(RESULT_AUTO_RESET_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const configSettings = await db.getSettings();
        const configPrizes = await db.getPrizes();
        setSettings(configSettings);
        setPrizes(configPrizes);
      } catch (err) {
        console.error('Failed to load kiosk configurations:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  // Refresh prizes when a game starts so admin image changes apply immediately
  useEffect(() => {
    if (step !== 'game') return;
    let cancelled = false;
    db.getPrizes().then((freshPrizes) => {
      if (!cancelled) {
        setPrizes(freshPrizes);
        setGameSession((n) => n + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [step, selectedGame]);

  // Handle auto-reset timer on result step
  useEffect(() => {
    if (step === 'result') {
      setResetTimer(RESULT_AUTO_RESET_SECONDS);
      timerRef.current = setInterval(() => {
        setResetTimer((prev) => {
          if (prev <= 1) {
            handleResetKiosk();
            return RESULT_AUTO_RESET_SECONDS;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [step]);

  const isWinningPrize = (prize: Prize | null) =>
    Boolean(
      prize && !prize.name.includes('꽝') && !prize.name.includes('다음 기회에')
    );

  // 당첨 시 쿠폰 이미지 다운로드용 QR 생성
  useEffect(() => {
    if (step !== 'result' || !generatedCoupon || !isWinningPrize(wonPrize)) {
      setCouponQrDataUrl(null);
      return;
    }

    let cancelled = false;
    generateCouponQrDataUrl(generatedCoupon)
      .then((dataUrl) => {
        if (!cancelled) setCouponQrDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error('Failed to generate coupon QR:', err);
        if (!cancelled) setCouponQrDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [step, generatedCoupon, wonPrize]);

  const handleStart = () => {
    setStep('auth');
  };

  const handleVerified = (phone: string) => {
    setPhoneNumber(phone);
    setStep('select_game');
  };

  const handleGameFinished = async (prize: Prize) => {
    // Use the prize object from the game draw (avoid stale/mismatched DB lookup by id)
    setWonPrize(prize);
    setStep('result');

    // Trigger celebratory confetti for winning prizes
    if (prize && !prize.name.includes('꽝') && !prize.name.includes('다음 기회에')) {
      // Fire confetti from left
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { x: 0.1, y: 0.8 },
      });
      // Fire confetti from right
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { x: 0.9, y: 0.8 },
      });
    }

    setAlimtalkNotice(null);

    // Save logs to database
    try {
      const log = await db.addEventLog(phoneNumber, prize, { privacyConsent: true });
      if (log && log.coupon_code) {
        setGeneratedCoupon(log.coupon_code);

        const alimtalk = await requestCouponAlimtalk({
          logId: log.id,
          phoneNumber,
          prizeName: prize.name,
          couponCode: log.coupon_code,
          prizeImageUrl: prize.image_url,
        });

        if (log.id) {
          await db.updateEventLogAlimtalkStatus(log.id, alimtalk.status, {
            error: alimtalk.error,
          });
        }

        if (alimtalk.ok) {
          setAlimtalkNotice('입력하신 번호로 카카오 알림톡을 발송했습니다.');
        } else if (alimtalk.status === 'skipped') {
          setAlimtalkNotice(null);
        } else {
          setAlimtalkNotice(
            '아래 QR코드로 쿠폰을 다운로드한 뒤 \n직원에게 보여주세요.'
          );
        }
      } else {
        setGeneratedCoupon(null);
      }
    } catch (err) {
      console.error('Failed to save event log:', err);
      setGeneratedCoupon(null);
    }
  };

  const handleResetKiosk = () => {
    setStep('landing');
    setPhoneNumber('');
    setWonPrize(null);
    setGeneratedCoupon(null);
    setAlimtalkNotice(null);
    setCouponQrDataUrl(null);
    // Reload configurations in case admin changed active game or ads
    db.getSettings().then((s) => setSettings(s));
    db.getPrizes().then((p) => setPrizes(p));
  };

  if (loading) {
    return (
      <KioskContainer>
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-t-pink-500 border-r-transparent border-zinc-800 animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-t-indigo-500 border-l-transparent border-zinc-900 animate-spin animate-duration-1000" />
          </div>
          <p className="text-sm font-semibold tracking-wider text-zinc-400 font-mono">
            LOADING KIOSK...
          </p>
        </div>
      </KioskContainer>
    );
  }

  // Fallback default settings
  const adTitle = settings?.ad_title || '특별한 혜택, 지금 바로 참여하세요!';
  const adSubtitle = settings?.ad_subtitle || '터치하고 대박 경품 받아가기';
  const adImageUrl = settings?.ad_image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80';

  return (
    <KioskContainer>
      {/* 1. Landing Screen */}
      {step === 'landing' && (
        <div className="relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden bg-zinc-950 select-none">
          {/* Full Screen Ad Background Image */}
          <KioskPortraitImage src={adImageUrl} alt="Promotion banner" />

          {/* Ad text block and button overlayed on top */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col px-6 pb-8 pt-16">
            {/* Glassmorphic floating ad card — 아래로 살짝 */}
            <div className="mt-10 space-y-5 rounded-3xl border border-white/10 bg-black/40 p-10 text-center shadow-[0_10px_35px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <h1 className="text-5xl font-black leading-tight tracking-tight text-white sm:text-6xl">
                {adTitle}
              </h1>
              <p className="text-2xl font-semibold leading-relaxed whitespace-pre-line text-zinc-50 sm:text-3xl">
                {adSubtitle}
              </p>
            </div>

            {/* Glowing Touch to Start Button */}
            <div className="mt-auto mb-24 w-full">
              <button
                type="button"
                onClick={handleStart}
                className="shine-effect touch-press animate-pulse-glow flex w-full items-center justify-center gap-6 rounded-[2rem] border-2 border-pink-300/30 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 py-12 text-5xl font-extrabold text-white shadow-[0_0_50px_rgba(236,72,153,0.5)]"
              >
                <span>터치하여 시작하기</span>
                <ArrowRight className="h-16 w-16 shrink-0 animate-pulse" />
              </button>
              <p
                className="mt-6 text-center text-3xl font-black leading-tight tracking-tight text-zinc-900 sm:text-4xl"
                style={{
                  WebkitTextStroke: '1px rgba(254, 243, 199, 0.95)',
                  paintOrder: 'stroke fill',
                }}
              >
                * 본 이벤트는 1인 1일 1회만 참여 가능합니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Authentication Screen */}
      {step === 'auth' && (
        <div className="flex min-h-0 flex-1 flex-col bg-white select-none">
          {/* Header navigation */}
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
            <button
              type="button"
              onClick={handleResetKiosk}
              className="touch-press flex items-center gap-3 text-2xl font-black text-zinc-600 transition-colors hover:text-zinc-900"
            >
              <ChevronLeft className="h-10 w-10 text-zinc-500" />
              <span>처음으로</span>
            </button>
          </div>

          <PhoneNumberInput onVerified={handleVerified} />
        </div>
      )}

      {/* 2.5 Game Selection Screen */}
      {step === 'select_game' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white select-none animate-fade-in">
          <div
            className="mx-auto flex w-full max-w-[min(100%,48rem)] flex-1 flex-col items-center justify-center gap-12 px-6 py-6 -translate-y-4"
            style={{ zoom: 1.3 }}
          >
            <div className="w-full text-center">
              <span className="inline-block rounded-full border border-pink-500/20 bg-pink-500/10 px-6 py-2 text-base font-semibold text-pink-600">
                GAME SELECT
              </span>
              <h2 className="mt-4 text-6xl font-black tracking-tight text-zinc-800">
                게임 선택하기
              </h2>
              <p className="mt-3 text-2xl font-medium text-zinc-500">
                도전하고 싶은 미니 게임을 하나 선택해 주세요!
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-6">
              {[
                { id: 'roulette', emoji: '🎡', name: '행운의 룰렛', desc: '돌려서 100% 당첨' },
                { id: 'scratch', emoji: '🎫', name: '스크래치 복권', desc: '슥슥 긁어서 확인' },
                { id: 'spot_diff', emoji: '🔍', name: '틀린그림찾기', desc: '서로 다른 3곳 찾기' },
                { id: 'hidden_obj', emoji: '🎨', name: '숨은그림찾기', desc: '그림 속 물건 찾기' },
              ].map((game) => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => {
                    setSelectedGame(game.id);
                    if (game.id === 'spot_diff') {
                      // choose 1 of 10 scenes during user action (lint-safe)
                      setSpotDiffSceneIndex(Math.floor(Math.random() * 10));
                    }
                    setStep('game');
                  }}
                  className="touch-press flex flex-col items-center justify-center gap-6 rounded-3xl border border-zinc-200 bg-white px-5 py-14 text-center shadow-[0_4px_15px_rgba(0,0,0,0.06)] transition-all duration-300 hover:border-pink-500/30 hover:bg-zinc-50"
                >
                  <span
                    className="animate-float text-8xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)]"
                    style={{
                      animationDelay:
                        game.id === 'roulette'
                          ? '0s'
                          : game.id === 'scratch'
                            ? '0.5s'
                            : game.id === 'spot_diff'
                              ? '1s'
                              : '1.5s',
                    }}
                  >
                    {game.emoji}
                  </span>
                  <span className="text-3xl font-black tracking-tight text-zinc-800">{game.name}</span>
                  <span className="px-1 text-lg font-medium leading-relaxed text-zinc-500">{game.desc}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleResetKiosk}
              className="w-full touch-press rounded-2xl border border-zinc-200 bg-white py-7 text-2xl font-bold text-zinc-500 shadow-sm transition-colors hover:text-zinc-800"
            >
              처음으로 돌아가기
            </button>
          </div>
        </div>
      )}

      {/* 3. Game Screen */}
      {step === 'game' && (
        <div className="flex min-h-0 flex-1 w-full flex-col bg-white select-none">

          {selectedGame === 'roulette' && (
            <RouletteGame key={gameSession} prizes={prizes} onFinished={handleGameFinished} />
          )}
          
          {selectedGame === 'scratch' && (
            <ScratchCardGame key={gameSession} prizes={prizes} onFinished={handleGameFinished} />
          )}

          {selectedGame === 'spot_diff' && (
            <SpotDifferenceGame
              key={gameSession}
              prizes={prizes}
              onFinished={handleGameFinished}
              sceneIndex={spotDiffSceneIndex}
            />
          )}

          {selectedGame === 'hidden_obj' && (
            <HiddenObjectGame key={gameSession} prizes={prizes} onFinished={handleGameFinished} />
          )}
        </div>
      )}

      {/* 4. Result Modal Cover overlay */}
      {step === 'result' && wonPrize && (
        <div className="absolute inset-0 z-50 flex animate-fade-in flex-col overflow-y-auto bg-white select-none">
          <div className="mx-auto flex w-full max-w-[min(100%,52rem)] flex-1 flex-col items-center justify-center gap-12 px-6 py-6 -translate-y-2">
            {/* Top banner */}
            <div className="w-full text-center">
              <div className="mb-8 inline-flex animate-bounce rounded-full border border-pink-500/20 bg-gradient-to-tr from-pink-500/10 to-indigo-500/10 p-8">
                <Gift className="h-20 w-20 text-pink-500" />
              </div>

              <h2 className="text-7xl font-black tracking-tight text-zinc-800">
                {!wonPrize.name.includes('꽝') && !wonPrize.name.includes('다음 기회에')
                  ? '축하합니다!'
                  : '아쉽게도...'}
              </h2>
              <p className="mt-4 text-2xl font-medium text-zinc-500">
                {!wonPrize.name.includes('꽝') && !wonPrize.name.includes('다음 기회에')
                  ? '경품 당첨 결과를 확인하세요!'
                  : '다음 기회에 도전해주세요!'}
              </p>
            </div>

            {/* Prize Box */}
            <div className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-16 text-center shadow-lg">
              <div className="pointer-events-none absolute -inset-10 bg-radial-gradient(ellipse_at_center,#fbcfe8,transparent_60%) opacity-20" />

              <div className="mb-10 h-72 w-72 animate-float overflow-hidden rounded-2xl border-[6px] border-indigo-100 bg-white p-2 shadow-md">
                <img
                  src={wonPrize.image_url}
                  alt={wonPrize.name}
                  className="h-full w-full rounded-xl object-cover"
                />
              </div>

              <div className="z-10 space-y-3">
                <span className="text-xl font-mono font-bold uppercase tracking-widest text-indigo-600">
                  {!wonPrize.name.includes('꽝') && !wonPrize.name.includes('다음 기회에')
                    ? 'WINNING PRIZE'
                    : 'TRY AGAIN'}
                </span>
                <h3 className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-6xl font-extrabold leading-tight text-transparent">
                  {wonPrize.name}
                </h3>
                {generatedCoupon && (
                  <div className="mt-8 inline-flex animate-pulse flex-col items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/10 px-10 py-6">
                    <span className="text-lg font-bold uppercase tracking-widest text-pink-600">쿠폰 번호</span>
                    <span className="mt-2 font-mono text-4xl font-black tracking-wider text-pink-700">
                      {generatedCoupon}
                    </span>
                  </div>
                )}
                {alimtalkNotice && (
                  <p className="mx-auto mt-6 max-w-xl whitespace-pre-line text-2xl font-semibold leading-relaxed text-indigo-600">
                    {alimtalkNotice}
                  </p>
                )}
              </div>
            </div>

            {/* Coupon download QR — 이미지 크기(w-44) 유지 */}
            {isWinningPrize(wonPrize) && generatedCoupon && (
              <div className="w-full px-2">
                <div className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <p className="mb-1 text-2xl font-bold text-zinc-700">휴대폰으로 QR 스캔</p>
                  <p className="mb-3 text-center text-xl leading-relaxed text-zinc-500">
                    스캔하면 쿠폰 번호가 적힌 이미지를 저장할 수 있습니다
                  </p>
                  {couponQrDataUrl ? (
                    <img
                      src={couponQrDataUrl}
                      alt="쿠폰 이미지 다운로드 QR"
                      className="h-44 w-44 rounded-xl border border-zinc-100"
                    />
                  ) : (
                    <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-zinc-100 text-sm font-medium text-zinc-400 animate-pulse">
                      QR 생성 중…
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action section and self-reset timer */}
            <div className="w-full space-y-6 pb-4">
              <button
                type="button"
                onClick={handleResetKiosk}
                className="touch-press w-full rounded-2xl bg-gradient-to-r from-pink-500 to-indigo-600 py-10 text-4xl font-extrabold text-white shadow-lg transition-colors"
              >
                확인 (처음으로)
              </button>

              <div className="flex items-center justify-center gap-2.5 font-mono text-2xl text-zinc-500">
                <RefreshCw className="h-7 w-7 animate-spin" style={{ animationDuration: '8s' }} />
                <span>{resetTimer}초 후에 자동으로 메인 화면으로 돌아갑니다.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </KioskContainer>
  );
}


