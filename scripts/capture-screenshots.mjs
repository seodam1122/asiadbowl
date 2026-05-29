// 기능 매뉴얼용 화면 캡쳐 스크립트 (Playwright)
// 사용법: dev 서버(npm run dev, 포트 3010)가 켜진 상태에서
//   node scripts/capture-screenshots.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'docs', 'screenshots');
const BASE = process.env.KIOSK_BASE_URL || 'http://localhost:3010';
const ADMIN_PW = '0077';

// 키오스크 세로 비율(1080x1920 = 0.5625)에 맞춘 뷰포트
const KIOSK = { width: 810, height: 1440 };
const DESKTOP = { width: 1440, height: 900 };

mkdirSync(OUT_DIR, { recursive: true });

const shots = [];
async function shot(page, name) {
  const path = join(OUT_DIR, name);
  await page.screenshot({ path });
  shots.push(name);
  console.log('  saved', name);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const browser = await chromium.launch();

  // ---------- 키오스크 흐름 ----------
  const kioskCtx = await browser.newContext({
    viewport: KIOSK,
    deviceScaleFactor: 1.5,
  });
  const page = await kioskCtx.newPage();

  console.log('[1] 랜딩 화면');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await sleep(1200);
  await shot(page, '01-landing.png');

  console.log('[2] 본인인증 화면');
  await page.getByText('터치하여 시작하기').click({ force: true });
  await sleep(1000);
  // 전화번호 키패드 입력: 010-1234-5678
  for (const d of '01012345678'.split('')) {
    await page.getByRole('button', { name: d, exact: true }).first().click();
    await sleep(80);
  }
  // 개인정보 동의 체크
  await page.locator('input[type="checkbox"]').first().check().catch(() => {});
  await sleep(400);
  await shot(page, '02-auth.png');

  console.log('[3] 게임 선택 화면');
  await page.getByText('이벤트 참여하기').click({ force: true });
  await sleep(2000);
  await shot(page, '03-game-select.png');

  console.log('[4] 게임 진행 화면 (룰렛)');
  await page.getByText('행운의 룰렛').click({ force: true });
  await sleep(2200);
  await shot(page, '04-game-roulette.png');

  await kioskCtx.close();

  // ---------- 쿠폰 다운로드 페이지 ----------
  console.log('[5] 쿠폰 다운로드 페이지');
  const couponCtx = await browser.newContext({ viewport: KIOSK, deviceScaleFactor: 1.5 });
  const couponPage = await couponCtx.newPage();
  const demoCoupon = process.env.DEMO_COUPON || 'C-6041-6041';
  await couponPage.goto(`${BASE}/coupon?c=${encodeURIComponent(demoCoupon)}`, {
    waitUntil: 'networkidle',
  });
  await sleep(1500);
  await shot(couponPage, '05-coupon-download.png');
  await couponCtx.close();

  // ---------- 관리자 대시보드 ----------
  console.log('[6] 관리자 로그인');
  const adminCtx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1.5 });
  const admin = await adminCtx.newPage();
  await admin.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await sleep(800);
  await shot(admin, '06-admin-login.png');

  await admin.locator('input[type="password"]').first().fill(ADMIN_PW);
  await admin.keyboard.press('Enter');
  await sleep(1500);

  const tabs = [
    ['이벤트 참여 현황', '07-admin-logs.png'],
    ['쿠폰 관리 및 검증', '08-admin-coupons.png'],
    ['포인트 관리', '09-admin-points.png'],
    ['광고 관리', '10-admin-ads.png'],
    ['이벤트 및 경품 설정', '11-admin-prizes.png'],
    ['게임 개발', '12-admin-game-dev.png'],
  ];
  for (const [label, file] of tabs) {
    console.log('   탭:', label);
    await admin.getByText(label, { exact: true }).first().click({ force: true });
    await sleep(1300);
    await shot(admin, file);
  }
  await adminCtx.close();

  await browser.close();
  console.log('\n완료! 저장된 파일:', shots.length, '개 →', OUT_DIR);
}

run().catch((err) => {
  console.error('캡쳐 중 오류:', err);
  process.exit(1);
});
