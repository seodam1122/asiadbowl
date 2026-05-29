# 🎡 키오스크 이벤트 웹 애플리케이션 (Redsun)

세로형(Portrait) 키오스크에서 방문객이 **휴대폰 인증 → 미니게임 참여 → 경품 당첨 → 쿠폰/포인트 발급**까지 진행하는 현장 이벤트용 웹 애플리케이션입니다. 당첨 시 카카오 알림톡으로 쿠폰이 발송되며, 관리자 대시보드에서 설정·경품·참여로그·쿠폰·포인트를 통합 관리합니다.

> 실제 운영처: 아시아드 볼링장 이벤트 키오스크

---

## 📌 한눈에 보기

| 항목 | 내용 |
|------|------|
| 프로젝트 유형 | 현장 키오스크 이벤트 + 관리자 대시보드 |
| 핵심 역할 | 기획 · 프론트엔드 · 백엔드(BaaS/서버리스) 전체 구현 |
| 프레임워크 | Next.js 16 (App Router), React 19, TypeScript |
| 스타일링 | Tailwind CSS v4 |
| 백엔드 | Supabase (PostgreSQL + Storage), Next.js API Routes |
| 외부 연동 | SOLAPI(카카오 알림톡), QR 코드 |
| 배포 | Vercel |

---

## 🏗️ 시스템 아키텍처

![아키텍처 다이어그램](./architecture-diagram.png)

### 데이터 흐름 요약
1. **클라이언트(키오스크/관리자/쿠폰 페이지)** 는 `lib/db.ts`(데이터 접근 계층)를 통해 데이터를 읽고 씁니다.
2. `db.ts`는 **Supabase 연결 시 PostgreSQL/Storage**를, **미연결 시 localStorage**를 사용하는 하이브리드 구조입니다.
3. **비밀 키가 필요한 작업**(알림톡 발송, 쿠폰 검증)만 **Next.js API Routes(서버 전용 런타임)** 로 분리했습니다.
4. API Routes가 **SOLAPI**·**Supabase**와 통신하고, 전체 서비스는 **Vercel**에 배포됩니다.

---

## 🎯 해결한 문제 (Problem → Solution)

### 1. 현장 네트워크 불안정 → 하이브리드 저장소
키오스크는 행사장 와이파이 등 불안정한 환경에서 동작합니다.
- **해결**: `db.ts`에서 Supabase 미연결/오류 시 자동으로 `localStorage` 폴백. 환경변수만으로 데모 모드 ↔ 운영 모드 전환이 가능해, 서버 설정 없이도 전 기능이 동작합니다.

### 2. 비밀 키 노출 위험 → 서버리스 API 분리
SOLAPI Secret, Supabase Service Role Key는 클라이언트에 노출되면 안 됩니다.
- **해결**: 알림톡 발송/쿠폰 검증은 `runtime = 'nodejs'` API Route에서만 실행. 키오스크 요청은 선택적으로 `x-kiosk-secret` 헤더로 보호.

### 3. 다양한 디바이스 → 일관된 세로형 비율
- **해결**: 1080×1920 기준 디자인을 `KioskContainer`에서 `ResizeObserver`로 스케일링(레터박스). 어느 화면에서도 같은 비율 유지.

### 4. 당첨 안내 자동화 → 알림톡 + QR 폴백
- **해결**: 당첨 시 알림톡 자동 발송. 미설정/실패 시 화면 QR로 쿠폰 다운로드 페이지를 안내하는 폴백 UX 제공.

---

## ✨ 주요 기능

### 키오스크 (사용자)
- 전면 광고 배너 → 휴대폰 본인인증(1인 1일 1회 제한) → 미니게임 → 결과
- 미니게임 4종: 🎡 룰렛 · 🎫 스크래치 복권 · 🔍 틀린그림찾기(10종 테마) · 🎨 숨은그림찾기
- 당첨 시 Confetti 효과 + 쿠폰 번호 + QR 코드 제공

### 관리자 대시보드 (`/admin`)
- 참여 로그/통계, 활성 게임·광고·배너 설정
- 경품/확률 관리(합계 100% 검증), 이미지 업로드
- 쿠폰 조회·사용 처리, **연락처별 포인트 관리**(자동 적립 + 수동 조정)

### 백엔드/API
- `/api/alimtalk/send-coupon` — 카카오 알림톡 발송(SOLAPI), 실패 시 SMS 대체
- `/api/coupon/info` — 쿠폰 유효성·경품 정보 조회

---

## 🗄️ 데이터 모델 (Supabase / PostgreSQL)

| 테이블 | 설명 |
|--------|------|
| `settings` | 키오스크 설정(활성 게임, 광고 문구·이미지, 관리자 비밀번호) — 단일 행 |
| `prizes` | 경품(이름, 이미지, 확률) |
| `event_logs` | 참여·당첨 로그(전화번호, 경품, 쿠폰코드, 사용여부, 알림톡 상태) |
| `contact_consents` | 전화번호별 개인정보 동의 상태 |
| `customer_points` | 연락처별 포인트 잔액 |
| `point_transactions` | 포인트 거래 내역(적립/지급/차감) |

모든 테이블 RLS 활성화. 이미지 파일은 Supabase Storage(`kiosk-media`, public 버킷)에 저장.

---

## 🧩 기술적 선택과 이유

- **Next.js App Router 단일 코드베이스**: 키오스크 UI, 관리자, 쿠폰 페이지, 서버리스 API를 한 저장소에서 관리해 운영/배포를 단순화.
- **Supabase(BaaS)**: 별도 백엔드 서버 운영 부담 없이 PostgreSQL + Storage + RLS를 빠르게 활용.
- **하이브리드 DB 계층**: 동일한 `db.ts` 인터페이스로 운영/오프라인을 추상화 → 컴포넌트는 저장소 종류를 몰라도 됨.
- **서버리스 API 최소 분리**: 보안이 필요한 작업만 서버로 보내 공격 표면을 최소화.

---

## 📂 폴더 구조 (요약)

```text
src/
├── app/
│   ├── page.tsx              # 키오스크 메인 플로우
│   ├── admin/page.tsx        # 관리자 대시보드
│   ├── coupon/page.tsx       # 쿠폰 다운로드
│   └── api/                  # 서버리스 API (alimtalk, coupon)
├── components/               # 게임·입력·관리자 UI
└── lib/
    ├── db.ts                 # 하이브리드 데이터 접근 계층(핵심)
    ├── supabase.ts           # Supabase 클라이언트
    ├── alimtalk.ts           # SOLAPI 연동
    └── points.ts             # 포인트 로직
supabase/                     # SQL 스크립트(스키마/시드/스토리지)
docs/                         # 문서 · 아키텍처 다이어그램
```

---

## 🚀 실행 방법

```bash
npm install
cp .env.example .env.local   # Supabase / SOLAPI 값 입력 (미입력 시 localStorage 데모 모드)
npm run dev                  # http://localhost:3010
```

- 키오스크: `http://localhost:3010`
- 관리자: `http://localhost:3010/admin` (기본 비밀번호 `0077`)
- Supabase 사용 시: `schema.sql` → `supabase/storage.sql` → `supabase/points.sql` 실행
