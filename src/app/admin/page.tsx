'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  db,
  KioskSettings,
  Prize,
  EventLog,
  ContactConsentStatus,
  normalizePhoneNumber,
} from '@/lib/db';
import { fileToCompressedDataUrl } from '@/lib/image-utils';
import {
  isEmbeddedImageData,
  isKioskStoragePublicUrl,
  stripUrlCacheBust,
} from '@/lib/kiosk-storage-url';
import { getSupabaseConnectionHint, isSupabaseConfigured } from '@/lib/supabase';
import { 
  Lock, KeyRound, ShieldAlert, Users, Image as ImageIcon, 
  Settings as SettingsIcon, Download, Save, CheckCircle2, 
  AlertTriangle, Play, HelpCircle, LogOut, Ticket, Search, Check, XCircle,
  ChevronLeft, ChevronRight, RotateCcw, Calendar
} from 'lucide-react';

type TabType = 'logs' | 'coupons' | 'ads' | 'prizes';

const LOGS_PAGE_SIZE = 10;

type LogDateRange = { start: string; end: string };

const getLogDateKey = (createdAt: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(createdAt));

const formatTodayKey = (): string => getLogDateKey(new Date().toISOString());

const getKstWeekday = (dateKey: string): number => {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(new Date(`${dateKey}T12:00:00+09:00`));
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
};

const addDaysToDateKey = (dateKey: string, days: number): string => {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  date.setDate(date.getDate() + days);
  return getLogDateKey(date.toISOString());
};

const normalizeLogDateRange = (start: string, end: string): LogDateRange =>
  start <= end ? { start, end } : { start: end, end: start };

const getThisWeekRange = (): LogDateRange => {
  const today = formatTodayKey();
  const weekStart = addDaysToDateKey(today, -getKstWeekday(today));
  return { start: weekStart, end: today };
};

const getThisMonthRange = (): LogDateRange => {
  const today = formatTodayKey();
  const [year, month] = today.split('-');
  return { start: `${year}-${month}-01`, end: today };
};

const formatLogRangeLabel = (range: LogDateRange): string =>
  range.start === range.end ? `${range.start} 참여` : `${range.start} ~ ${range.end}`;

const formatAlimtalkStatus = (status?: string | null): string => {
  switch (status) {
    case 'sent':
      return '발송완료';
    case 'failed':
      return '발송실패';
    case 'pending':
      return '대기';
    case 'skipped':
      return '미설정';
    default:
      return '-';
  }
};

// Helper function to format 8-digit numbers to XXXX-XXXX style
const formatCouponNumbers = (numbers: string): string => {
  if (!numbers) return '';
  if (numbers.length <= 4) {
    return numbers;
  }
  return `${numbers.slice(0, 4)}-${numbers.slice(4, 8)}`;
};

export default function AdminPage() {
  // Authentication State
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [consentMap, setConsentMap] = useState<Record<string, ContactConsentStatus>>({});
  const [consentUpdatingPhone, setConsentUpdatingPhone] = useState<string | null>(null);
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  
  // Forms state
  const [adTitle, setAdTitle] = useState('');
  const [adSubtitle, setAdSubtitle] = useState('');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [prizeEdits, setPrizeEdits] = useState<Prize[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prizeFileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingPrizeIndex, setDraggingPrizeIndex] = useState<number | null>(null);
  const [activePrizeUploadIndex, setActivePrizeUploadIndex] = useState<number | null>(null);
  
  // UI States
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [loading, setLoading] = useState(true);

  // Coupons Tab State - stores ONLY 8-digit number string
  const [couponSearchInput, setCouponSearchInput] = useState('');
  const [searchedCouponLog, setSearchedCouponLog] = useState<EventLog | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // Event logs filter & pagination
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [logAppliedRange, setLogAppliedRange] = useState<LogDateRange | null>(null);
  const [logPhoneQuery, setLogPhoneQuery] = useState('');
  const [logAppliedPhoneDigits, setLogAppliedPhoneDigits] = useState('');
  const [logPhoneSearchError, setLogPhoneSearchError] = useState<string | null>(null);
  const [logPage, setLogPage] = useState(1);

  const filteredLogs = useMemo(() => {
    let result = logs;

    if (logAppliedRange) {
      const { start, end } = logAppliedRange;
      result = result.filter((log) => {
        const key = getLogDateKey(log.created_at);
        return key >= start && key <= end;
      });
    }

    if (logAppliedPhoneDigits) {
      result = result.filter((log) => {
        const digits = normalizePhoneNumber(log.phone_number).replace(/\D/g, '');
        return digits.includes(logAppliedPhoneDigits);
      });
    }

    return result;
  }, [logs, logAppliedRange, logAppliedPhoneDigits]);

  const logFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (logAppliedRange) parts.push(formatLogRangeLabel(logAppliedRange));
    if (logAppliedPhoneDigits) {
      const d = logAppliedPhoneDigits;
      const phoneLabel =
        d.length <= 3
          ? d
          : d.length <= 7
            ? `${d.slice(0, 3)}-${d.slice(3)}`
            : `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
      parts.push(`연락처 ${phoneLabel}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [logAppliedRange, logAppliedPhoneDigits]);

  const logTotalPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PAGE_SIZE));
  const safeLogPage = Math.min(logPage, logTotalPages);

  const paginatedLogs = useMemo(() => {
    const start = (safeLogPage - 1) * LOGS_PAGE_SIZE;
    return filteredLogs.slice(start, start + LOGS_PAGE_SIZE);
  }, [filteredLogs, safeLogPage]);

  const applyLogRange = (start: string, end: string) => {
    const range = normalizeLogDateRange(start, end);
    setLogDateFrom(range.start);
    setLogDateTo(range.end);
  };

  useEffect(() => {
    if (logDateFrom && logDateTo) {
      setLogAppliedRange(normalizeLogDateRange(logDateFrom, logDateTo));
      setLogPage(1);
    } else {
      setLogAppliedRange(null);
    }
  }, [logDateFrom, logDateTo]);

  const handleLogPhoneSearch = () => {
    const digits = logPhoneQuery.replace(/\D/g, '');
    if (digits.length < 4) {
      setLogPhoneSearchError('연락처는 숫자 4자리 이상 입력해 주세요.');
      return;
    }
    setLogPhoneSearchError(null);
    setLogAppliedPhoneDigits(digits);
    setLogPage(1);
  };

  const handleLogPhoneQueryChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 3 && digits.length <= 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else if (digits.length > 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    setLogPhoneQuery(formatted);
    if (logPhoneSearchError) setLogPhoneSearchError(null);
  };

  const handleLogReset = () => {
    setLogDateFrom('');
    setLogDateTo('');
    setLogAppliedRange(null);
    setLogPhoneQuery('');
    setLogAppliedPhoneDigits('');
    setLogPhoneSearchError(null);
    setLogPage(1);
  };

  const handleCouponChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Extract numbers only and limit to max 8 digits
    const cleaned = val.replace(/\D/g, '').slice(0, 8);
    setCouponSearchInput(cleaned);
  };

  const handleSearchCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (couponSearchInput.length < 8) {
      setCouponError('쿠폰 번호 숫자 8자리를 모두 입력해 주세요.');
      return;
    }
    
    // Construct the standard format C-XXXX-XXXX for query
    const fullCouponCode = `C-${couponSearchInput.slice(0, 4)}-${couponSearchInput.slice(4, 8)}`;
    
    setCouponLoading(true);
    setCouponError(null);
    setCouponSuccess(null);
    setSearchedCouponLog(null);
    
    try {
      const log = await db.checkCoupon(fullCouponCode);
      if (log) {
        setSearchedCouponLog(log);
      } else {
        setCouponError('존재하지 않거나 유효하지 않은 쿠폰 번호입니다. 다시 확인해 주세요.');
      }
    } catch (err) {
      console.error(err);
      setCouponError('쿠폰 조회 중 네트워크 오류가 발생했습니다.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleUseCoupon = async () => {
    if (!searchedCouponLog || !searchedCouponLog.coupon_code) return;
    
    setCouponLoading(true);
    setCouponError(null);
    setCouponSuccess(null);
    
    try {
      const updatedLog = await db.useCoupon(searchedCouponLog.coupon_code);
      setSearchedCouponLog(updatedLog);
      setCouponSuccess(`쿠폰 사용 처리가 완료되었습니다.\n(상품: ${updatedLog.prize_name} / 연락처: ${updatedLog.phone_number})`);
      
      // Refresh overall event logs in background to update table
      Promise.all([db.getEventLogs(), db.getContactConsentsMap()]).then(([fetchedLogs, fetchedConsents]) => {
        setLogs(fetchedLogs);
        setConsentMap(fetchedConsents);
      });
    } catch (err: any) {
      console.error(err);
      setCouponError(err.message || '쿠폰 사용 처리 중 오류가 발생했습니다.');
    } finally {
      setCouponLoading(false);
    }
  };

  // Load configuration on mount/auth
  useEffect(() => {
    async function loadData() {
      try {
        const year = new Date().getFullYear();
        const seedResult = await db.seedAprilMayDummyData({ year });
        const [fetchedLogs, fetchedSettings, fetchedPrizes, fetchedConsents] = await Promise.all([
          db.getEventLogs(),
          db.getSettings(),
          db.getPrizes(),
          db.getContactConsentsMap(),
        ]);
        
        setLogs(fetchedLogs);
        setConsentMap(fetchedConsents);
        setSettings(fetchedSettings);
        setPrizes(fetchedPrizes);
        
        if (seedResult.logsAdded > 0) {
          applyLogRange(`${year}-04-01`, `${year}-05-31`);
        }

        // Populate form fields
        setAdTitle(fetchedSettings.ad_title);
        setAdSubtitle(fetchedSettings.ad_subtitle);
        setAdImageUrl(fetchedSettings.ad_image_url);
        setPrizeEdits(JSON.parse(JSON.stringify(fetchedPrizes))); // deep clone
      } catch (err) {
        console.error('Failed to load admin data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  // Handle Passcode login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '0077') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('비밀번호가 일치하지 않습니다. 다시 입력해주세요.');
      setPassword('');
    }
  };

  const getConsentStatus = (phone: string): ContactConsentStatus | 'unknown' =>
    consentMap[normalizePhoneNumber(phone)] ?? 'unknown';

  const refreshConsentMap = async () => {
    const map = await db.getContactConsentsMap();
    setConsentMap(map);
  };

  const handleConsentChange = async (phone: string, status: ContactConsentStatus) => {
    const label = status === 'declined' ? '수신거부(미동의)' : '동의';
    if (!window.confirm(`${phone} 연락처를 ${label} 상태로 변경할까요?`)) {
      return;
    }

    setConsentUpdatingPhone(phone);
    try {
      await db.setContactConsent(phone, status);
      await refreshConsentMap();
      setSaveStatus({
        type: 'success',
        message: `${phone} 연락처가 ${status === 'declined' ? '미동의' : '동의'} 상태로 변경되었습니다.`,
      });
    } catch (err) {
      console.error(err);
      setSaveStatus({
        type: 'error',
        message: '동의 상태 변경 중 오류가 발생했습니다.',
      });
    } finally {
      setConsentUpdatingPhone(null);
    }
  };

  // CSV Export Utility (exports current filter result)
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    // Header row
    const headers = [
      '순번',
      '연락처',
      '수집·이용 동의',
      '당첨 경품',
      '쿠폰 번호',
      '알림톡',
      '사용 여부',
      '사용 일시',
      '참여 일시',
    ];
    
    // Rows mapping
    const rows = filteredLogs.map((log, index) => {
      const consent = getConsentStatus(log.phone_number);
      const consentLabel =
        consent === 'agreed' ? '동의' : consent === 'declined' ? '미동의' : '미등록';
      return [
        filteredLogs.length - index,
        log.phone_number,
        consentLabel,
        log.prize_name,
        log.coupon_code || 'N/A',
        formatAlimtalkStatus(log.alimtalk_status),
        log.is_used ? '사용완료' : '미사용',
        log.used_at ? new Date(log.used_at).toLocaleString('ko-KR') : 'N/A',
        new Date(log.created_at).toLocaleString('ko-KR'),
      ];
    });

    // Construct CSV with Excel UTF-8 BOM representation (\uFEFF)
    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateSuffix = logAppliedRange
      ? logAppliedRange.start === logAppliedRange.end
        ? logAppliedRange.start
        : `${logAppliedRange.start}_${logAppliedRange.end}`
      : new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `kiosk_event_logs_${dateSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save Ads Settings
  const handleSaveAds = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus({ type: null, message: '' });
    try {
      const updated = await db.updateSettings({
        ad_title: adTitle,
        ad_subtitle: adSubtitle,
        ad_image_url: adImageUrl
      });
      setSettings(updated);
      setAdImageUrl(updated.ad_image_url);
      setSaveStatus({
        type: 'success',
        message: '광고 설정이 서버에 저장되었습니다. 키오스크에서도 동일 이미지가 표시됩니다.',
      });
    } catch (err) {
      console.error(err);
      setSaveStatus({ type: 'error', message: '광고 설정 저장 중 오류가 발생했습니다.' });
    }
  };

  const processImageFile = async (file: File) => {
    if (file.size > 2.5 * 1024 * 1024) {
      const errorMsg = `이미지 파일 크기는 최대 2.5MB까지만 허용됩니다.\n(선택하신 파일 크기: ${(file.size / (1024 * 1024)).toFixed(2)}MB)`;
      alert(errorMsg);
      setSaveStatus({ type: 'error', message: errorMsg });
      return;
    }

    setSaveStatus({ type: null, message: '' });
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 1280, 0.82);
      const serverUrl = await db.uploadAdImage(dataUrl);
      setAdImageUrl(serverUrl);
      setSaveStatus({
        type: 'success',
        message:
          '광고 배너가 Supabase Storage에 업로드되었습니다. 저장 버튼으로 제목·부제목을 함께 저장하세요.',
      });
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : '광고 이미지 서버 업로드에 실패했습니다.';
      setSaveStatus({ type: 'error', message });
      alert(message);
    }
  };

  const processPrizeImageFile = async (file: File, prizeIndex: number) => {
    const prize = prizeEdits[prizeIndex];
    if (!prize) return;
    const prizeLabel = prize.name || `경품 ${prizeIndex + 1}`;

    if (file.size > 2.5 * 1024 * 1024) {
      const errorMsg = `이미지 파일 크기는 최대 2.5MB까지만 허용됩니다.\n(선택하신 파일 크기: ${(file.size / (1024 * 1024)).toFixed(2)}MB)`;
      alert(errorMsg);
      setSaveStatus({ type: 'error', message: errorMsg });
      return;
    }

    setSaveStatus({ type: null, message: '' });
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 512, 0.82);
      const serverUrl = await db.uploadPrizeImage(prize.id, dataUrl);
      handlePrizeImageChange(prizeIndex, serverUrl);
      setSaveStatus({
        type: 'success',
        message: `'${prizeLabel}' 이미지가 서버에 업로드되었습니다. 하단 저장 버튼으로 이름·확률을 함께 저장하세요.`,
      });
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : '경품 이미지 서버 업로드에 실패했습니다.';
      setSaveStatus({ type: 'error', message });
      alert(message);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.');
        return;
      }
      void processImageFile(file);
    }
  };

  const openPrizeFilePicker = (prizeIndex: number) => {
    setActivePrizeUploadIndex(prizeIndex);
    prizeFileInputRef.current?.click();
  };

  const handlePrizeImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activePrizeUploadIndex !== null) {
      void processPrizeImageFile(file, activePrizeUploadIndex);
    }
    e.target.value = '';
  };

  const handlePrizeDragOver = (e: React.DragEvent<HTMLDivElement>, prizeIndex: number) => {
    e.preventDefault();
    setDraggingPrizeIndex(prizeIndex);
  };

  const handlePrizeDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggingPrizeIndex(null);
  };

  const handlePrizeDrop = (e: React.DragEvent<HTMLDivElement>, prizeIndex: number) => {
    e.preventDefault();
    setDraggingPrizeIndex(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.');
        return;
      }
      void processPrizeImageFile(file, prizeIndex);
    }
  };

  // Calculate sum of prize probabilities
  const totalProbability = prizeEdits.reduce((acc, curr) => acc + Number(curr.probability || 0), 0);

  // Save Game & Prizes
  const handleSavePrizes = async () => {
    setSaveStatus({ type: null, message: '' });
    
    // Odds sum check (must equal 100%)
    if (Math.abs(totalProbability - 100) > 0.01) {
      setSaveStatus({ 
        type: 'error', 
        message: `경품 당첨 확률의 총합은 반드시 100%이어야 합니다. (현재: ${totalProbability}%)` 
      });
      return;
    }

    try {
      const updatedPrizes = await db.savePrizeList(prizeEdits);
      setPrizes(updatedPrizes);
      setPrizeEdits(JSON.parse(JSON.stringify(updatedPrizes)));

      setSaveStatus({
        type: 'success',
        message: '경품 설정이 서버에 저장되었습니다. 키오스크·QR 쿠폰에서도 동일 이미지가 사용됩니다.',
      });
    } catch (err) {
      console.error(err);
      setSaveStatus({
        type: 'error',
        message: err instanceof Error ? err.message : '설정 저장 중 에러가 발생했습니다.',
      });
    }
  };

  const handlePrizeProbabilityChange = (index: number, value: string) => {
    const numeric = parseFloat(value);
    const updated = [...prizeEdits];
    updated[index].probability = isNaN(numeric) ? 0 : numeric;
    setPrizeEdits(updated);
  };

  const handlePrizeNameChange = (index: number, value: string) => {
    const updated = [...prizeEdits];
    updated[index].name = value;
    setPrizeEdits(updated);
  };

  const handlePrizeImageChange = (index: number, value: string) => {
    const updated = [...prizeEdits];
    updated[index].image_url = value;
    setPrizeEdits(updated);
  };

  // 1. Locked Entry Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-800 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Neon light glow backings */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-pink-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md p-8 rounded-3xl bg-white border border-zinc-200/85 shadow-xl relative z-10 text-center animate-fade-in">
          <div className="inline-flex p-4 bg-zinc-50 border border-zinc-150 rounded-2xl mb-4 shadow-sm">
            <Lock className="w-8 h-8 text-pink-500" />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-zinc-800">아시아드 키오스크</h1>
          <p className="text-sm text-zinc-500 mt-2 font-medium">
            관리자 대시보드 보안 진입을 위해<br />비밀번호를 입력해 주세요.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="password"
                maxLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
                placeholder="비밀번호 4자리"
                className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 rounded-2xl text-center text-lg font-mono tracking-widest text-zinc-800 outline-none transition-all"
                required
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex gap-2 items-center text-left">
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-xs text-red-600 font-semibold">{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-pink-500/10 cursor-pointer"
            >
              인증 및 대시보드 진입
            </button>
          </form>
          
          <div className="mt-6">
            <a 
              href="/" 
              className="text-xs text-zinc-450 hover:text-zinc-650 font-bold transition-colors underline decoration-dotted"
            >
              사용자 화면으로 가기
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 2. Full Admin Dashboard Screen (Authenticated)
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 flex flex-col font-sans">
      {/* Header bar */}
      <header className="bg-white/90 border-b border-zinc-200 sticky top-0 z-30 backdrop-blur-md shadow-sm">
        <div className="max-w-[1600px] w-full mx-auto py-4 px-4 sm:px-6 md:px-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-pink-50 border border-pink-100 rounded-lg text-pink-500 shadow-sm">
              <SettingsIcon className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-sm sm:text-lg font-black tracking-wider uppercase text-zinc-850">아시아드 관리자</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 rounded-lg transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
              <span className="hidden sm:inline">키오스크 구동</span>
            </a>

            <button
              onClick={() => setIsAuthenticated(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200/60 text-xs font-bold text-red-650 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main dashboard grid */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 md:p-10 flex flex-row gap-4 sm:gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="w-16 sm:w-56 md:w-64 shrink-0 flex flex-col gap-2">
          <button
            onClick={() => { setActiveTab('logs'); setSaveStatus({ type: null, message: '' }); }}
            className={`w-full py-3.5 px-3 sm:py-4.5 sm:px-5 rounded-2xl flex items-center justify-center sm:justify-start gap-3.5 font-bold transition-all border ${
              activeTab === 'logs'
                ? 'bg-white border-zinc-200 text-pink-600 shadow-[0_4px_15px_rgba(0,0,0,0.02)]'
                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/40'
            }`}
          >
            <Users className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">이벤트 참여 현황</span>
          </button>

          <button
            onClick={() => { setActiveTab('coupons'); setSaveStatus({ type: null, message: '' }); }}
            className={`w-full py-3.5 px-3 sm:py-4.5 sm:px-5 rounded-2xl flex items-center justify-center sm:justify-start gap-3.5 font-bold transition-all border ${
              activeTab === 'coupons'
                ? 'bg-white border-zinc-200 text-pink-600 shadow-[0_4px_15px_rgba(0,0,0,0.02)]'
                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/40'
            }`}
          >
            <Ticket className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">쿠폰 관리 및 검증</span>
          </button>

          <button
            onClick={() => { setActiveTab('ads'); setSaveStatus({ type: null, message: '' }); }}
            className={`w-full py-3.5 px-3 sm:py-4.5 sm:px-5 rounded-2xl flex items-center justify-center sm:justify-start gap-3.5 font-bold transition-all border ${
              activeTab === 'ads'
                ? 'bg-white border-zinc-200 text-pink-600 shadow-[0_4px_15px_rgba(0,0,0,0.02)]'
                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/40'
            }`}
          >
            <ImageIcon className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">광고 관리</span>
          </button>

          <button
            onClick={() => { setActiveTab('prizes'); setSaveStatus({ type: null, message: '' }); }}
            className={`w-full py-3.5 px-3 sm:py-4.5 sm:px-5 rounded-2xl flex items-center justify-center sm:justify-start gap-3.5 font-bold transition-all border ${
              activeTab === 'prizes'
                ? 'bg-gradient-to-r from-pink-500/10 to-indigo-500/10 border-pink-500/30 text-pink-600 shadow-md shadow-pink-500/5'
                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/40'
            }`}
          >
            <SettingsIcon className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">이벤트 및 경품 설정</span>
          </button>
        </aside>

        {/* Tab Contents Frame */}
        <section className="flex-1 min-w-0">
          
          {/* Toast Messages banner */}
          {saveStatus.type && (
            <div className={`mb-6 p-4 rounded-2xl flex gap-3 items-center border animate-fade-in ${
              saveStatus.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {saveStatus.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0" />
              )}
              <p className="text-xs font-bold whitespace-pre-line">{saveStatus.message}</p>
            </div>
          )}

          {/* TAB 1: Event logs list */}
          {activeTab === 'logs' && (
            <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-black text-zinc-850">이벤트 참여 고객 목록</h2>
                  <p className="text-xs text-zinc-500 mt-1 font-medium">이벤트에 참여한 사용자들의 실시간 기록 내역입니다.</p>
                </div>

                <button
                  onClick={handleExportCSV}
                  disabled={filteredLogs.length === 0}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all border ${
                    filteredLogs.length > 0
                      ? 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700 cursor-pointer'
                      : 'bg-zinc-100 border-zinc-200/50 text-zinc-400 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV 다운로드</span>
                </button>
              </div>

              {/* Date range filter */}
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">시작일</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                      <input
                        type="date"
                        value={logDateFrom}
                        onChange={(e) => setLogDateFrom(e.target.value)}
                        aria-label="검색 시작일"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 rounded-xl text-xs text-zinc-800 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">종료일</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                      <input
                        type="date"
                        value={logDateTo}
                        onChange={(e) => setLogDateTo(e.target.value)}
                        aria-label="검색 종료일"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 rounded-xl text-xs text-zinc-800 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400 font-medium">
                  시작일과 종료일을 모두 선택하면 자동으로 조회됩니다. 하루만 보려면 두 날짜를 같게 설정하세요.
                </p>

                <div className="space-y-1 pt-1 border-t border-zinc-100">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                    연락처 조회
                  </label>
                  <form
                    className="flex flex-col sm:flex-row gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleLogPhoneSearch();
                    }}
                  >
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={logPhoneQuery}
                        onChange={(e) => handleLogPhoneQueryChange(e.target.value)}
                        placeholder="010-0000-0000 (일부 번호만 입력 가능)"
                        aria-label="연락처 검색"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 rounded-xl text-xs text-zinc-800 font-mono outline-none transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-all shrink-0"
                    >
                      조회
                    </button>
                    {logAppliedPhoneDigits && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogPhoneQuery('');
                          setLogAppliedPhoneDigits('');
                          setLogPhoneSearchError(null);
                          setLogPage(1);
                        }}
                        className="px-4 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-all shrink-0"
                      >
                        연락처 해제
                      </button>
                    )}
                  </form>
                  {logPhoneSearchError && (
                    <p className="text-[10px] text-red-500 font-semibold">{logPhoneSearchError}</p>
                  )}
                  <p className="text-[10px] text-zinc-400 font-medium">
                    숫자 4자리 이상 입력 후 조회하면 해당 번호가 포함된 참여 내역만 표시됩니다. 기간 필터와 함께 사용할 수 있습니다.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const today = formatTodayKey();
                      applyLogRange(today, today);
                    }}
                    className="px-4 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-all"
                  >
                    오늘
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const range = getThisWeekRange();
                      applyLogRange(range.start, range.end);
                    }}
                    className="px-4 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-all"
                  >
                    이번주
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const range = getThisMonthRange();
                      applyLogRange(range.start, range.end);
                    }}
                    className="px-4 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-all"
                  >
                    이번달
                  </button>
                  <button
                    type="button"
                    onClick={handleLogReset}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>초기화</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 font-medium">
                <span>
                  총 {filteredLogs.length.toLocaleString('ko-KR')}건
                  {logFilterLabel ? ` · ${logFilterLabel}` : ''}
                  {' · '}
                  {safeLogPage}/{logTotalPages} 페이지
                </span>
                <span>
                  {logAppliedRange && logAppliedPhoneDigits
                    ? '기간·연락처 필터 적용 중'
                    : logAppliedRange
                      ? '기간 필터 적용 중'
                      : logAppliedPhoneDigits
                        ? '연락처 필터 적용 중'
                        : '전체 기간'}
                </span>
              </div>

              {/* Statistics Overview Card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-zinc-50 border border-zinc-150/80 p-4 rounded-2xl shadow-sm">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                    {logAppliedRange ? '검색 결과' : '총 참여 횟수'}
                  </span>
                  <span className="text-2xl font-mono font-black text-transparent bg-gradient-to-r from-pink-600 to-indigo-600 bg-clip-text mt-1 block">
                    {filteredLogs.length}건
                  </span>
                </div>
                <div className="bg-zinc-50 border border-zinc-150/80 p-4 rounded-2xl shadow-sm">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">오늘 참여자</span>
                  <span className="text-2xl font-mono font-black text-emerald-600 mt-1 block">
                    {logs.filter((l) => getLogDateKey(l.created_at) === formatTodayKey()).length}명
                  </span>
                </div>
                <div className="hidden sm:block bg-zinc-50 border border-zinc-150/80 p-4 rounded-2xl shadow-sm">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">당첨 경품 종류</span>
                  <span className="text-2xl font-mono font-black text-indigo-600 mt-1 block">
                    {Array.from(new Set(filteredLogs.filter(l => !l.prize_name.includes('꽝') && !l.prize_name.includes('다음')).map(l => l.prize_name))).length}종
                  </span>
                </div>
              </div>

              {/* Table rendering */}
              <div className="overflow-x-auto border border-zinc-200 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                      <th className="py-3 px-4">순번</th>
                      <th className="py-3 px-4">연락처 (휴대폰 번호)</th>
                      <th className="py-3 px-4">수집·이용 동의</th>
                      <th className="py-3 px-4">당첨 경품</th>
                      <th className="py-3 px-4">쿠폰 번호</th>
                      <th className="py-3 px-4">알림톡</th>
                      <th className="py-3 px-4">사용 여부</th>
                      <th className="py-3 px-4">참여 일시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs font-mono text-zinc-650">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-zinc-500 font-sans font-medium">
                          {logAppliedRange || logAppliedPhoneDigits
                            ? '조건에 맞는 참여 기록이 없습니다.'
                            : '참여 로그 데이터가 존재하지 않습니다.'}
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log, idx) => {
                        const rowNumber = filteredLogs.length - ((safeLogPage - 1) * LOGS_PAGE_SIZE + idx);
                        const consentStatus = getConsentStatus(log.phone_number);
                        const isUpdatingConsent = consentUpdatingPhone === log.phone_number;
                        return (
                        <tr key={log.id ?? `${log.created_at}-${log.phone_number}-${idx}`} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="py-3 px-4 text-zinc-400">{rowNumber}</td>
                          <td className="py-3 px-4 text-zinc-800 font-bold text-sm">{log.phone_number}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  consentStatus === 'agreed'
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                                    : consentStatus === 'declined'
                                      ? 'bg-red-50 text-red-600 border border-red-200/50'
                                      : 'bg-zinc-100 text-zinc-500 border border-zinc-200/60'
                                }`}
                              >
                                {consentStatus === 'agreed'
                                  ? '동의'
                                  : consentStatus === 'declined'
                                    ? '미동의'
                                    : '미등록'}
                              </span>
                              {consentStatus === 'agreed' && (
                                <button
                                  type="button"
                                  disabled={isUpdatingConsent}
                                  onClick={() => handleConsentChange(log.phone_number, 'declined')}
                                  className="text-[10px] font-bold text-red-600 hover:text-red-700 underline decoration-dotted disabled:opacity-50"
                                >
                                  {isUpdatingConsent ? '처리 중...' : '수신거부 처리'}
                                </button>
                              )}
                              {consentStatus === 'declined' && (
                                <button
                                  type="button"
                                  disabled={isUpdatingConsent}
                                  onClick={() => handleConsentChange(log.phone_number, 'agreed')}
                                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline decoration-dotted disabled:opacity-50"
                                >
                                  {isUpdatingConsent ? '처리 중...' : '동의로 복구'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.prize_name.includes('꽝') || log.prize_name.includes('다음')
                                ? 'bg-zinc-100 text-zinc-500 border border-zinc-200/60'
                                : 'bg-pink-50 text-pink-600 border border-pink-200/40'
                            }`}>
                              {log.prize_name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-zinc-700 font-mono text-sm">
                            {log.coupon_code || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                log.alimtalk_status === 'sent'
                                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-200/50'
                                  : log.alimtalk_status === 'failed'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200/50'
                                    : 'bg-zinc-100 text-zinc-500 border border-zinc-200/60'
                              }`}
                              title={log.alimtalk_error || undefined}
                            >
                              {formatAlimtalkStatus(log.alimtalk_status)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {log.coupon_code ? (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                log.is_used 
                                  ? 'bg-red-50 text-red-650 border border-red-200/50' 
                                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200/50 animate-pulse'
                              }`}>
                                {log.is_used ? '사용완료' : '미사용'}
                              </span>
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-zinc-500 text-[11px]">
                            {new Date(log.created_at).toLocaleString('ko-KR')}
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                <p className="px-4 py-2 text-[10px] text-zinc-400 border-t border-zinc-100">
                  페이지당 {LOGS_PAGE_SIZE}건씩 표시됩니다.
                </p>
              </div>

              {filteredLogs.length > 0 && (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    disabled={safeLogPage <= 1}
                    className={`flex items-center gap-1 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                      safeLogPage > 1
                        ? 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700 cursor-pointer'
                        : 'bg-zinc-100 border-zinc-200/50 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>이전</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogPage((p) => Math.min(logTotalPages, p + 1))}
                    disabled={safeLogPage >= logTotalPages}
                    className={`flex items-center gap-1 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                      safeLogPage < logTotalPages
                        ? 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700 cursor-pointer'
                        : 'bg-zinc-100 border-zinc-200/50 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    <span>다음</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 1.5: Coupons Tab */}
          {activeTab === 'coupons' && (
            <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-zinc-800">쿠폰 조회 및 사용 처리</h2>
                  <p className="text-sm text-zinc-500 mt-1.5 font-medium font-sans">
                    고객이 제시한 쿠폰 번호를 확인하여 사용 상태를 점검하고, 사용 완료 처리합니다.
                  </p>
                </div>
              </div>

              {/* Search Form */}
              <form onSubmit={handleSearchCoupon} className="flex gap-3">
                <div className="relative flex-1 flex items-center bg-white border border-zinc-200 focus-within:border-pink-500/50 focus-within:ring-1 focus-within:ring-pink-500/50 rounded-2xl pl-5 pr-5 py-4 transition-all">
                  <Ticket className="w-6 h-6 text-zinc-400 shrink-0 mr-3" />
                  <span className="text-lg text-zinc-500 font-mono font-bold tracking-wider select-none shrink-0 mr-1.5">C-</span>
                  <input
                    type="text"
                    placeholder="xxxx - xxxx"
                    value={formatCouponNumbers(couponSearchInput)}
                    onChange={handleCouponChange}
                    className="w-full bg-transparent text-lg text-zinc-800 outline-none font-mono tracking-wider p-0"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={couponLoading}
                  className="px-8 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all text-base cursor-pointer shadow-sm min-h-[3.25rem]"
                >
                  {couponLoading ? (
                    <span className="w-5 h-5 border-2 border-t-transparent border-zinc-400 rounded-full animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>조회</span>
                </button>
              </form>

              {/* Error/Success Banners */}
              {couponError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3 items-center text-red-600 animate-fade-in">
                  <XCircle className="w-5 h-5 shrink-0 text-red-500" />
                  <p className="text-sm font-bold">{couponError}</p>
                </div>
              )}
              {couponSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3 items-center text-emerald-700 animate-fade-in">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                  <p className="text-sm font-bold">{couponSuccess}</p>
                </div>
              )}

              {/* Coupon Info Detail Box */}
              {searchedCouponLog && (
                <div className="bg-zinc-50 border border-zinc-200/80 p-6 md:p-8 rounded-3xl space-y-6 animate-fade-in shadow-sm">
                  <h3 className="text-lg font-black text-zinc-700 uppercase tracking-wider border-b border-zinc-200/80 pb-3">
                    쿠폰 상세 정보
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <span className="text-sm text-zinc-500 font-bold uppercase tracking-wider block">쿠폰 코드</span>
                      <span className="text-2xl font-mono font-black text-zinc-800 block mt-2">
                        {searchedCouponLog.coupon_code}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-zinc-500 font-bold uppercase tracking-wider block">사용 상태</span>
                      <div className="mt-2">
                        {searchedCouponLog.is_used ? (
                          <span className="px-3 py-1.5 rounded-lg text-sm font-bold bg-red-50 text-red-600 border border-red-200/50">
                            사용완료
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-lg text-sm font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/50 animate-pulse">
                            미사용 (사용 가능)
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-zinc-500 font-bold uppercase tracking-wider block">당첨 경품</span>
                      <span className="text-base font-bold text-zinc-800 block mt-2">{searchedCouponLog.prize_name}</span>
                    </div>
                    <div>
                      <span className="text-sm text-zinc-500 font-bold uppercase tracking-wider block">연락처</span>
                      <span className="text-base font-bold text-zinc-800 block mt-2 font-mono">
                        {searchedCouponLog.phone_number}
                      </span>
                    </div>
                    {searchedCouponLog.is_used && searchedCouponLog.used_at && (
                      <div className="sm:col-span-2">
                        <span className="text-sm text-zinc-500 font-bold uppercase tracking-wider block">쿠폰 사용 일시</span>
                        <span className="text-base font-bold text-red-600 block mt-2 font-mono">
                          {new Date(searchedCouponLog.used_at).toLocaleString('ko-KR')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-5 border-t border-zinc-200/80 flex justify-end">
                    {searchedCouponLog.is_used ? (
                      <div className="text-sm font-bold text-red-600 bg-red-50 border border-red-100/60 px-5 py-3 rounded-xl">
                        ※ 이미 사용이 완료되어 재사용할 수 없는 쿠폰 번호입니다.
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleUseCoupon}
                        disabled={couponLoading}
                        className="px-6 py-3.5 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-bold text-base rounded-xl shadow-md shadow-pink-500/10 cursor-pointer flex items-center gap-2 transition-all disabled:opacity-60"
                      >
                        <Check className="w-5 h-5" />
                        <span>이 쿠폰 사용 완료 처리하기</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Ad banner configurations */}
          {activeTab === 'ads' && (
            <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div>
                <h2 className="text-xl font-black text-zinc-850">광고 콘텐츠 관리</h2>
                <p className="text-xs text-zinc-500 mt-1 font-medium">키오스크 첫 화면(랜딩 페이지)에 표시될 광고와 카피 문구를 설정합니다.</p>
                <p
                  className={`text-[10px] mt-2 font-semibold ${
                    isSupabaseConfigured ? 'text-emerald-600' : 'text-amber-700'
                  }`}
                >
                  {getSupabaseConnectionHint()}
                </p>
              </div>

              <form onSubmit={handleSaveAds} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">광고 메인 타이틀</label>
                  <input
                    type="text"
                    value={adTitle}
                    onChange={(e) => setAdTitle(e.target.value)}
                    placeholder="예: 특별한 혜택, 지금 바로 참여하세요!"
                    className="w-full px-4 py-3 bg-white border border-zinc-200 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 rounded-xl text-xs text-zinc-800 outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">광고 서브 타이틀 (줄바꿈 가능)</label>
                  <textarea
                    rows={3}
                    value={adSubtitle}
                    onChange={(e) => setAdSubtitle(e.target.value)}
                    placeholder="예: 터치하고 대박 경품 받아가기"
                    className="w-full px-4 py-3 bg-white border border-zinc-200 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 rounded-xl text-xs text-zinc-800 outline-none transition-all resize-none"
                    required
                  />
                </div>

                <div className="space-y-3.5">
                  <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider block">배너 이미지 설정</label>
                  
                  {/* File Upload Selector */}
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="w-full flex-grow">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all group ${
                          isDragging 
                            ? 'border-pink-500 bg-pink-50/50 shadow-[0_0_15px_rgba(236,72,153,0.1)] font-semibold' 
                            : 'border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100/50 hover:border-pink-500/30'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none select-none">
                          {adImageUrl && isKioskStoragePublicUrl(adImageUrl) ? (
                            <>
                              <span className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 mb-2.5 shadow-sm">
                                <CheckCircle2 className="w-5 h-5" />
                              </span>
                              <p className="text-[11px] text-emerald-600 font-bold">서버에 업로드됨</p>
                              <p className="text-[9px] text-zinc-500 mt-1">저장 버튼으로 제목·부제목을 함께 저장하세요</p>
                            </>
                          ) : (
                            <>
                              <span className="p-2 bg-white group-hover:bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-400 group-hover:text-pink-500 transition-colors mb-2.5 shadow-sm">
                                <ImageIcon className="w-5 h-5" />
                              </span>
                              <p className="text-[11px] text-zinc-650 font-bold">
                                {isDragging ? '여기에 이미지를 놓으세요!' : '이미지 직접 업로드 또는 여기로 드래그'}
                              </p>
                              <p className="text-[9px] text-zinc-400 mt-1">PNG, JPG, JPEG (최대 2.5MB)</p>
                            </>
                          )}
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Manual URL input fallback */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">또는 이미지 직접 URL 입력</span>
                    {isEmbeddedImageData(adImageUrl) ? (
                      <p className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-semibold">
                        브라우저 임시 이미지입니다. 위에서 파일을 업로드하면 Supabase Storage URL이 생성됩니다.
                      </p>
                    ) : isKioskStoragePublicUrl(adImageUrl) ? (
                      <div className="space-y-1">
                        <p className="text-[9px] text-emerald-600 font-bold">Supabase Storage URL (서버 저장됨)</p>
                        <p className="w-full px-4 py-3 bg-zinc-100 border border-zinc-200 rounded-xl text-[10px] text-zinc-700 font-mono break-all leading-relaxed">
                          {stripUrlCacheBust(adImageUrl)}
                        </p>
                      </div>
                    ) : (
                      <input
                        type="url"
                        value={adImageUrl}
                        onChange={(e) => setAdImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full px-4 py-3 bg-white border border-zinc-200 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 rounded-xl text-xs text-zinc-800 outline-none transition-all"
                        required
                      />
                    )}
                  </div>
                </div>

                {/* Image preview helper */}
                {adImageUrl && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">랜딩 화면 프리뷰</span>
                    <div className="aspect-[16/10] max-w-sm rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 relative">
                      <img 
                        src={adImageUrl} 
                        alt="Ad preview" 
                        className="w-full h-full object-cover brightness-95"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80';
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-pink-500/10 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>광고 설정 저장</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: Event selection and odds settings */}
          {activeTab === 'prizes' && (
            <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div>
                <h2 className="text-xl font-black text-zinc-850">이벤트 및 경품 설정</h2>
                <p className="text-xs text-zinc-500 mt-1 font-medium">각 경품별 명칭, 이미지, 당첨 확률을 설정합니다.</p>
                <p
                  className={`text-[10px] mt-2 font-semibold ${
                    isSupabaseConfigured ? 'text-emerald-600' : 'text-amber-700'
                  }`}
                >
                  {getSupabaseConnectionHint()}
                </p>
              </div>

              {/* Real-time probability validation warning bar */}
              <div className={`p-4 rounded-xl flex items-center justify-between border text-xs font-bold ${
                Math.abs(totalProbability - 100) < 0.01
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : 'bg-amber-50 border-amber-100 text-amber-700 animate-pulse'
              }`}>
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  <span>당첨 확률 총합 지표: (반드시 100%여야 저장 가능)</span>
                </div>
                <span className="font-mono text-sm">{totalProbability}%</span>
              </div>

              {/* Prizes Odds Edit List */}
              <div className="space-y-4">
                <label className="text-xs text-zinc-550 font-bold uppercase tracking-wider block">경품 목록 및 당첨 확률 설정</label>
                
                <input
                  ref={prizeFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePrizeImageFileChange}
                  className="hidden"
                />

                <div className="space-y-3.5">
                  {prizeEdits.map((prize, idx) => (
                    <div key={prize.id} className="p-4 bg-zinc-50/50 border border-zinc-200/60 rounded-2xl flex flex-col gap-4 shadow-sm">
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        {/* Left side: Index & icon preview */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="w-6 h-6 rounded-full bg-zinc-200 text-xs font-mono font-bold flex items-center justify-center text-zinc-500">
                            {idx + 1}
                          </span>
                          <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-200 bg-white shrink-0">
                            <img
                              src={prize.image_url}
                              alt={prize.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        </div>

                        {/* Name input */}
                        <div className="flex-1 w-full space-y-1">
                          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">경품 이름</span>
                          <input
                            type="text"
                            value={prize.name}
                            onChange={(e) => handlePrizeNameChange(idx, e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 outline-none focus:border-pink-500/40 transition-colors"
                            required
                          />
                        </div>

                        {/* Probability percentage input */}
                        <div className="w-full md:w-32 space-y-1 shrink-0">
                          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">당첨 확률 (%)</span>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={prize.probability}
                              onChange={(e) => handlePrizeProbabilityChange(idx, e.target.value)}
                              className="w-full pl-3 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 font-mono outline-none focus:border-pink-500/40 transition-colors"
                              required
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">%</span>
                          </div>
                        </div>
                      </div>

                      {/* Prize image upload (same pattern as banner) */}
                      <div className="w-full space-y-2">
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">경품 이미지</span>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openPrizeFilePicker(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openPrizeFilePicker(idx);
                            }
                          }}
                          onDragOver={(e) => handlePrizeDragOver(e, idx)}
                          onDragLeave={handlePrizeDragLeave}
                          onDrop={(e) => handlePrizeDrop(e, idx)}
                          className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer transition-all group ${
                            draggingPrizeIndex === idx
                              ? 'border-pink-500 bg-pink-50/50 shadow-[0_0_15px_rgba(236,72,153,0.1)]'
                              : 'border-zinc-200 bg-white hover:bg-zinc-50/80 hover:border-pink-500/30'
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center py-4 pointer-events-none select-none">
                            {prize.image_url && isKioskStoragePublicUrl(prize.image_url) ? (
                              <>
                                <span className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 mb-2 shadow-sm">
                                  <CheckCircle2 className="w-4 h-4" />
                                </span>
                                <p className="text-[11px] text-emerald-600 font-bold">서버에 업로드됨</p>
                                <p className="text-[9px] text-zinc-500 mt-1">저장 버튼으로 이름·확률을 함께 저장하세요</p>
                              </>
                            ) : (
                              <>
                                <span className="p-2 bg-zinc-50 group-hover:bg-white border border-zinc-200 rounded-xl text-zinc-400 group-hover:text-pink-500 transition-colors mb-2 shadow-sm">
                                  <ImageIcon className="w-4 h-4" />
                                </span>
                                <p className="text-[11px] text-zinc-600 font-bold">
                                  {draggingPrizeIndex === idx ? '여기에 이미지를 놓으세요!' : '이미지 업로드 또는 드래그'}
                                </p>
                                <p className="text-[9px] text-zinc-400 mt-1">PNG, JPG, JPEG (최대 2.5MB)</p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">또는 이미지 URL 입력</span>
                          {isEmbeddedImageData(prize.image_url) ? (
                            <p className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-semibold">
                              브라우저 임시 이미지입니다. 파일을 다시 업로드하면 Supabase Storage URL이 생성됩니다.
                            </p>
                          ) : isKioskStoragePublicUrl(prize.image_url) ? (
                            <div className="space-y-1">
                              <p className="text-[9px] text-emerald-600 font-bold">Supabase Storage URL (서버 저장됨)</p>
                              <p className="w-full px-3 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-[10px] text-zinc-700 font-mono break-all leading-relaxed">
                                {stripUrlCacheBust(prize.image_url)}
                              </p>
                            </div>
                          ) : (
                            <input
                              type="url"
                              value={prize.image_url}
                              onChange={(e) => handlePrizeImageChange(idx, e.target.value)}
                              placeholder="https://... 또는 이미지 파일 업로드"
                              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 outline-none focus:border-pink-500/40 transition-colors"
                              required
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSavePrizes}
                  disabled={Math.abs(totalProbability - 100) > 0.01}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs shadow-sm transition-all ${
                    Math.abs(totalProbability - 100) < 0.01
                      ? 'bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white cursor-pointer shadow-pink-500/10'
                      : 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200 shadow-none'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>이벤트 및 경품 저장</span>
                </button>
              </div>
            </div>
          )}

        </section>
      </main>
    </div>
  );
}
