'use client';

import React, { useState, useEffect, useRef } from 'react';
import KioskContainer from '@/components/KioskContainer';
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
            '알림톡 발송에 실패했습니다. 아래 쿠폰 번호를 직원에게 보여 주세요.'
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
        <div className="flex-1 flex flex-col justify-between relative overflow-hidden select-none bg-zinc-950">
          {/* Full Screen Ad Background Image */}
          <div className="absolute inset-0 w-full h-full z-0 bg-zinc-950">
            <img
              src={adImageUrl}
              alt="Promotion banner"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Ad text block and button overlayed on top */}
          <div className="relative z-10 flex-1 flex flex-col justify-between px-6 pb-12 pt-12">
            {/* Glassmorphic floating ad card */}
            <div className="bg-black/35 backdrop-blur-md border border-white/10 rounded-3xl p-6 text-center space-y-3 shadow-[0_10px_35px_rgba(0,0,0,0.3)]">
              <h1 className="text-2xl font-black tracking-tight text-white leading-tight">
                {adTitle}
              </h1>
              <p className="text-sm text-zinc-100 font-semibold whitespace-pre-line leading-relaxed">
                {adSubtitle}
              </p>
            </div>

            {/* Glowing Touch to Start Button */}
            <div className="w-full">
              <button
                type="button"
                onClick={handleStart}
                className="w-full py-5.5 rounded-3xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white font-extrabold text-xl shadow-[0_0_30px_rgba(236,72,153,0.35)] animate-pulse-glow shine-effect touch-press flex items-center justify-center gap-3 border border-pink-400/20"
              >
                <span>터치하여 시작하기</span>
                <ArrowRight className="w-6 h-6 animate-pulse" />
              </button>
              <p 
                className="text-[10px] text-zinc-300 text-center mt-3 tracking-wide"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
              >
                * 본 이벤트는 1인 1일 1회만 참여 가능합니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Authentication Screen */}
      {step === 'auth' && (
        <div className="flex-1 flex flex-col bg-white select-none">
          {/* Header navigation */}
          <div className="px-6 py-4 flex items-center border-b border-zinc-200 bg-white justify-between shrink-0">
            <button
              onClick={handleResetKiosk}
              className="text-sm text-zinc-600 font-bold hover:text-zinc-900 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-5 h-5 text-zinc-500" />
              <span>처음으로</span>
            </button>
          </div>

          <PhoneNumberInput onVerified={handleVerified} />
        </div>
      )}

      {/* 2.5 Game Selection Screen */}
      {step === 'select_game' && (
        <div className="flex-1 flex flex-col justify-between p-6 bg-white select-none animate-fade-in">
          <div className="text-center pt-6">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-600">
              GAME SELECT
            </span>
            <h2 className="text-2xl font-black tracking-tight text-zinc-800 mt-2">
              게임 선택하기
            </h2>
            <p className="text-xs text-zinc-500 mt-1.5 font-medium">
              도전하고 싶은 미니 게임을 하나 선택해 주세요!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 my-auto">
            {[
              { id: 'roulette', emoji: '🎡', name: '행운의 룰렛', desc: '돌려서 100% 당첨' },
              { id: 'scratch', emoji: '🎫', name: '스크래치 복권', desc: '슥슥 긁어서 확인' },
              { id: 'spot_diff', emoji: '🔍', name: '틀린그림찾기', desc: '서로 다른 3곳 찾기' },
              { id: 'hidden_obj', emoji: '🎨', name: '숨은그림찾기', desc: '그림 속 물건 찾기' }
            ].map((game) => (
              <button
                key={game.id}
                type="button"
                onClick={() => {
                  setSelectedGame(game.id);
                  setStep('game');
                }}
                className="py-9 px-4 rounded-3xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-pink-500/30 text-center transition-all duration-300 touch-press flex flex-col items-center justify-center gap-3 shadow-[0_4px_15px_rgba(0,0,0,0.05)]"
              >
                <span className="text-4xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)] animate-float" style={{ animationDelay: `${game.id === 'roulette' ? '0s' : game.id === 'scratch' ? '0.5s' : game.id === 'spot_diff' ? '1s' : '1.5s'}` }}>
                  {game.emoji}
                </span>
                <span className="font-black text-base text-zinc-800 tracking-tight">{game.name}</span>
                <span className="text-[10px] text-zinc-500 font-medium leading-relaxed px-1">{game.desc}</span>
              </button>
            ))}
          </div>

          <div className="pb-4">
            <button
              onClick={handleResetKiosk}
              className="w-full py-4 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-800 font-bold text-xs touch-press transition-colors shadow-sm"
            >
              처음으로 돌아가기
            </button>
          </div>
        </div>
      )}

      {/* 3. Game Screen */}
      {step === 'game' && (
        <div className="flex-1 flex flex-col bg-white select-none">


          {selectedGame === 'roulette' && (
            <RouletteGame key={gameSession} prizes={prizes} onFinished={handleGameFinished} />
          )}
          
          {selectedGame === 'scratch' && (
            <ScratchCardGame key={gameSession} prizes={prizes} onFinished={handleGameFinished} />
          )}

          {selectedGame === 'spot_diff' && (
            <SpotDifferenceGame key={gameSession} prizes={prizes} onFinished={handleGameFinished} />
          )}

          {selectedGame === 'hidden_obj' && (
            <HiddenObjectGame key={gameSession} prizes={prizes} onFinished={handleGameFinished} />
          )}
        </div>
      )}

      {/* 4. Result Modal Cover overlay */}
      {step === 'result' && wonPrize && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col justify-between p-6 select-none animate-fade-in">
          {/* Top banner */}
          <div className="text-center pt-10">
            <div className="inline-flex p-4 bg-gradient-to-tr from-pink-500/10 to-indigo-500/10 rounded-full border border-pink-500/20 mb-6 animate-bounce">
              <Gift className="w-10 h-10 text-pink-500" />
            </div>
            
            <h2 className="text-3xl font-black tracking-tight text-zinc-800">
              {!wonPrize.name.includes('꽝') && !wonPrize.name.includes('다음 기회에')
                ? '축하합니다!'
                : '아쉽게도...'}
            </h2>
            <p className="text-zinc-500 text-sm mt-2 font-medium">
              {!wonPrize.name.includes('꽝') && !wonPrize.name.includes('다음 기회에')
                ? '경품 당첨 결과를 확인하세요!'
                : '다음 기회에 도전해주세요!'}
            </p>
          </div>

          {/* Prize Box */}
          <div className="my-4 bg-zinc-50/80 border border-zinc-200/80 rounded-3xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-lg">
            {/* Glow backing */}
            <div className="absolute -inset-10 bg-radial-gradient(ellipse_at_center,#fbcfe8,transparent_60%) pointer-events-none opacity-20" />
            
            {/* Prize Image */}
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-indigo-100 p-1 mb-5 bg-white shadow-md animate-float">
              <img
                src={wonPrize.image_url}
                alt={wonPrize.name}
                className="w-full h-full object-cover rounded-full"
              />
            </div>

            <div className="space-y-1 z-10">
              <span className="text-xs font-mono tracking-widest text-indigo-600 font-bold uppercase">
                {!wonPrize.name.includes('꽝') && !wonPrize.name.includes('다음 기회에')
                  ? 'WINNING PRIZE'
                  : 'TRY AGAIN'}
              </span>
              <h3 className="text-2xl font-extrabold text-transparent bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text">
                {wonPrize.name}
              </h3>
              {generatedCoupon && (
                <div className="mt-4 px-5 py-2.5 bg-pink-500/10 border border-pink-500/20 rounded-2xl inline-flex flex-col items-center justify-center animate-pulse">
                  <span className="text-[10px] font-bold text-pink-600 uppercase tracking-widest">쿠폰 번호</span>
                  <span className="text-lg font-mono font-black text-pink-700 tracking-wider mt-0.5">{generatedCoupon}</span>
                </div>
              )}
              {alimtalkNotice && (
                <p className="mt-3 text-xs font-semibold text-indigo-600 leading-relaxed max-w-xs mx-auto">
                  {alimtalkNotice}
                </p>
              )}
            </div>
          </div>

          {/* Coupon download QR */}
          {isWinningPrize(wonPrize) && generatedCoupon && (
            <div className="px-2 pb-2">
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col items-center shadow-sm">
                <p className="text-xs font-bold text-zinc-700 mb-1">
                  휴대폰으로 QR 스캔
                </p>
                <p className="text-[10px] text-zinc-500 mb-3 text-center leading-relaxed">
                  스캔하면 쿠폰 번호가 적힌 이미지를 저장할 수 있습니다
                </p>
                {couponQrDataUrl ? (
                  <img
                    src={couponQrDataUrl}
                    alt="쿠폰 이미지 다운로드 QR"
                    className="w-44 h-44 rounded-xl border border-zinc-100"
                  />
                ) : (
                  <div className="w-44 h-44 rounded-xl bg-zinc-100 animate-pulse flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                    QR 생성 중…
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action section and self-reset timer */}
          <div className="space-y-4 pb-6">
            <button
              type="button"
              onClick={handleResetKiosk}
              className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-pink-500 to-indigo-600 text-white font-extrabold text-lg shadow-lg touch-press transition-colors"
            >
              확인 (처음으로)
            </button>
            
            {/* Timer visual count */}
            <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-xs font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
              <span>{resetTimer}초 후에 자동으로 메인 화면으로 돌아갑니다.</span>
            </div>
          </div>
        </div>
      )}
    </KioskContainer>
  );
}


