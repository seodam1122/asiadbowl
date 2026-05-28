'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  db,
  normalizePhoneNumber,
  type CustomerPoints,
  type PointTransaction,
  type PointsStorageMode,
} from '@/lib/db';
import { pointsFromPrizeName } from '@/lib/points';
import { Coins, Minus, Plus, RefreshCw, Search } from 'lucide-react';

const TX_LABEL: Record<string, string> = {
  coupon_earn: '쿠폰 적립',
  admin_add: '관리자 지급',
  admin_subtract: '관리자 차감',
};

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

interface PointsManagerProps {
  onStatus?: (status: { type: 'success' | 'error'; message: string }) => void;
}

export default function PointsManager({ onStatus }: PointsManagerProps) {
  const mountedRef = useRef(true);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  const [accounts, setAccounts] = useState<CustomerPoints[]>([]);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageMode, setStorageMode] = useState<PointsStorageMode | null>(null);
  const [tablesMissing, setTablesMissing] = useState(false);

  const [searchDigits, setSearchDigits] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  const [adjustPhone, setAdjustPhone] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      const storageInfo = await db.getPointsStorageInfo();
      if (!mountedRef.current) return;
      setStorageMode(storageInfo.mode);
      setTablesMissing(storageInfo.supabaseConfigured && !storageInfo.tablesReady);

      const [list, txs] = await Promise.all([
        db.getCustomerPointsList(),
        db.getPointTransactions(),
      ]);
      if (!mountedRef.current) return;
      setAccounts(list);
      setTransactions(txs);
    } catch (err) {
      console.error(err);
      if (mountedRef.current) {
        onStatusRef.current?.({ type: 'error', message: '포인트 목록을 불러오지 못했습니다.' });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  const searchQuery = searchDigits.replace(/\D/g, '');
  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return accounts;
    return accounts.filter((a) => a.phone_number.replace(/\D/g, '').includes(searchQuery));
  }, [accounts, searchQuery]);

  const selectedAccount = useMemo(() => {
    if (!selectedPhone) return null;
    return accounts.find((a) => normalizePhoneNumber(a.phone_number) === selectedPhone) ?? null;
  }, [accounts, selectedPhone]);

  const selectedTransactions = useMemo(() => {
    if (!selectedPhone) return transactions.slice(0, 30);
    return transactions.filter(
      (t) => normalizePhoneNumber(t.phone_number) === selectedPhone
    );
  }, [transactions, selectedPhone]);

  const totalPoints = useMemo(
    () => accounts.reduce((sum, a) => sum + a.balance, 0),
    [accounts]
  );

  const handleAdjust = async (mode: 'add' | 'subtract') => {
    const phone = normalizePhoneNumber(adjustPhone);
    const amount = Number(adjustAmount);
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      onStatusRef.current?.({ type: 'error', message: '휴대폰 번호를 입력해 주세요.' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      onStatusRef.current?.({ type: 'error', message: '포인트는 1 이상 숫자로 입력해 주세요.' });
      return;
    }

    setAdjusting(true);
    try {
      const { account } = await db.adjustCustomerPoints(phone, amount, adjustReason, mode);
      if (!mountedRef.current) return;
      setSelectedPhone(normalizePhoneNumber(account.phone_number));
      setAdjustAmount('');
      setAdjustReason('');
      await refresh();
      if (!mountedRef.current) return;
      onStatusRef.current?.({
        type: 'success',
        message: `${account.phone_number} — ${mode === 'add' ? '지급' : '차감'} 완료 (잔액 ${account.balance.toLocaleString()}P)`,
      });
    } catch (err) {
      if (mountedRef.current) {
        onStatusRef.current?.({
          type: 'error',
          message: err instanceof Error ? err.message : '포인트 조정에 실패했습니다.',
        });
      }
    } finally {
      if (mountedRef.current) {
        setAdjusting(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {tablesMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-bold">Supabase 포인트 테이블이 없습니다.</p>
          <p className="mt-1 text-xs font-medium text-amber-800/90">
            지금은 이 브라우저의 로컬 저장소에만 포인트가 기록됩니다. Supabase SQL Editor에서{' '}
            <code className="rounded bg-amber-100 px-1">supabase/points.sql</code> 또는{' '}
            <code className="rounded bg-amber-100 px-1">supabase/supabase-sql-editor.sql</code>을
            실행한 뒤 새로고침하세요.
          </p>
        </div>
      )}
      {storageMode === 'local' && !tablesMissing && (
        <p className="text-xs font-medium text-zinc-500">
          Supabase 미연결 — 포인트는 이 기기의 로컬 저장소에만 저장됩니다.
        </p>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-zinc-850">포인트 관리</h2>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            연락처(휴대폰)별 포인트 잔액 · 쿠폰 사용 시 경품명에 point가 있으면 자동 적립됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="bg-zinc-50 border border-zinc-150/80 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
            등록 고객 수
          </span>
          <span className="text-2xl font-mono font-black text-zinc-800 mt-1 block">
            {accounts.length}명
          </span>
        </div>
        <div className="bg-zinc-50 border border-zinc-150/80 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
            총 보유 포인트
          </span>
          <span className="text-2xl font-mono font-black text-pink-600 mt-1 block">
            {totalPoints.toLocaleString()}P
          </span>
        </div>
        <div className="bg-zinc-50 border border-zinc-150/80 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
            자동 적립 예시
          </span>
          <span className="text-sm font-bold text-zinc-700 mt-2 block leading-snug">
            &quot;2000 point&quot; 경품 쿠폰 → +2,000P
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 space-y-4">
        <div className="flex items-center gap-2 text-indigo-800 font-bold text-sm">
          <Coins className="w-5 h-5" />
          포인트 수동 조정
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
              연락처
            </label>
            <input
              type="tel"
              value={adjustPhone}
              onChange={(e) => setAdjustPhone(formatPhoneInput(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm font-mono outline-none focus:border-pink-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
              포인트
            </label>
            <input
              type="number"
              min={1}
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="예: 500"
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm font-mono outline-none focus:border-pink-500/50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
              사유 (선택)
            </label>
            <input
              type="text"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="예: 매장 보상 지급"
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:border-pink-500/50"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={adjusting}
            onClick={() => handleAdjust('add')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            포인트 추가
          </button>
          <button
            type="button"
            disabled={adjusting}
            onClick={() => handleAdjust('subtract')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-50"
          >
            <Minus className="w-4 h-4" />
            포인트 차감
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        <input
          type="tel"
          value={searchDigits}
          onChange={(e) =>
            setSearchDigits(
              e.target.value
                .replace(/[^\d-]/g, '')
                .slice(0, 13)
            )
          }
          placeholder="연락처 검색 (숫자)"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-mono outline-none focus:border-pink-500/50"
        />
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <div className="flex h-[460px] flex-col overflow-hidden border border-zinc-200 rounded-2xl bg-white shadow-sm">
          <div className="overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">연락처</th>
                  <th className="py-3 px-4">잔액</th>
                  <th className="py-3 px-4">최종 변경</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-zinc-500 font-medium">
                      {loading ? '불러오는 중…' : '포인트 내역이 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => {
                    const phone = normalizePhoneNumber(acc.phone_number);
                    const active = selectedPhone === phone;
                    return (
                      <tr
                        key={phone}
                        onClick={() => setSelectedPhone(phone)}
                        className={`cursor-pointer transition-colors ${
                          active ? 'bg-pink-50/80' : 'hover:bg-zinc-50/50'
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-zinc-800">{phone}</td>
                        <td className="py-3 px-4 font-mono font-black text-pink-600">
                          {acc.balance.toLocaleString()}P
                        </td>
                        <td className="py-3 px-4 text-zinc-500">
                          {new Date(acc.updated_at).toLocaleString('ko-KR')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex h-[460px] flex-col overflow-hidden border border-zinc-200 rounded-2xl bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-4 py-3">
            <h3 className="text-sm font-black text-zinc-700">
              {selectedPhone ? `${selectedPhone} 거래 내역` : '최근 거래 내역 (전체)'}
            </h3>
            {selectedAccount && (
              <p className="mt-1 text-base font-black text-pink-600">
                현재 잔액: {selectedAccount.balance.toLocaleString()}P
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-scroll divide-y divide-zinc-100 pr-1">
            {selectedTransactions.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">거래 내역이 없습니다.</p>
            ) : (
              selectedTransactions.map((tx) => (
                <div key={tx.id ?? `${tx.created_at}-${tx.phone_number}-${tx.amount}`} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-zinc-800">
                        {TX_LABEL[tx.transaction_type] ?? tx.transaction_type}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{tx.reason}</p>
                      {tx.coupon_code && (
                        <p className="text-xs font-mono text-zinc-400 mt-1">쿠폰 {tx.coupon_code}</p>
                      )}
                      {tx.prize_name && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          경품: {tx.prize_name}
                          {pointsFromPrizeName(tx.prize_name) > 0 &&
                            ` (+${pointsFromPrizeName(tx.prize_name).toLocaleString()}P)`}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-sm font-mono font-black shrink-0 ${
                        tx.amount >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {tx.amount >= 0 ? '+' : ''}
                      {tx.amount.toLocaleString()}P
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-2">
                    {tx.phone_number} · 잔액 {tx.balance_after.toLocaleString()}P ·{' '}
                    {new Date(tx.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
