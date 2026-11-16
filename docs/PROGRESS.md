# บันทึกความคืบหน้า (Handoff log)

> ไฟล์นี้คือ "สมุดส่งงาน" — ทุกครั้งที่ทำงานเสร็จหนึ่งรอบ ให้เพิ่มรายการใหม่ **ไว้บนสุด**
> เครื่องใหม่ / Claude session ใหม่: อ่านไฟล์นี้ + ROADMAP.md ก่อนเริ่มงาน

## สถานะปัจจุบัน
- **Deploy แล้ว (2026-11-16)** — https://easy-pos-beta.vercel.app = Phase 1 + Phase 2 + ยกเลิกบิล + ตั้งค่าร้าน + สแกนกล้อง +
  OTP/ลืมรหัสผ่าน/Google + ธีมขาว-ส้ม/มืด + เปลี่ยนรหัส/ลบบัญชี
- `main` = `dev` ณ ตอน deploy; ทำงานต่อบน `dev` แล้ว merge เข้า `main` เมื่อผู้ใช้สั่ง deploy
- DB บน Supabase migrate ถึง `0002`; env บน Vercel ครบ (DATABASE_URL, DATABASE_POOL_MAX, DB_DRIVER, AUTH_PROVIDER, AUTH_SECRET,
  SMTP_USER, SMTP_PASS, MAIL_FROM_NAME, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- ตรวจเว็บจริงหลัง deploy: health/login/register/wasm = 200, /th/hub ไม่ล็อกอิน → 307, ปุ่ม Google ขึ้น, API ปฏิเสธ hotmail ✅
  (ยังไม่ได้ทดสอบส่ง OTP บนเว็บจริง — ผู้ใช้ทดสอบเอง)
- งานถัดไป: ดู ROADMAP (ยกเลิกบิล/คืนสินค้า, ตั้งค่าร้าน/VAT, สแกนด้วยกล้อง ...)

---

## 2026-11-16 — อายุ session + รีเฟรชอัตโนมัติ + บังคับเวอร์ชันล่าสุด (branch dev)
**กติกา (ผู้ใช้สั่ง):**
- ล็อกอินอยู่ได้ **10 วัน** นับจากตอนล็อกอิน (ไม่ต่ออายุเอง) → `session.expiresIn = 10 วัน`, `disableSessionRefresh: true`
- **deploy ใหม่ทุกครั้ง → ทุกคนต้องล็อกอินใหม่**: `advanced.cookiePrefix = ep-<รหัส deploy>` (`buildId` ใน `server/env.ts`)
  → ชื่อ cookie เปลี่ยนทุก deploy, cookie เก่าใช้ไม่ได้; ร่วมกับ `deploymentId` แท็บเก่าจะ reload แล้วเด้งไปหน้า login
  - dev ใช้ `ep-dev` (ล็อกอินค้างข้ามการรีสตาร์ตได้)
- **ไม่ได้ใช้งาน 30 นาที / กลับมาหลังสลับแอปเกิน 30 นาที / หน้ามาจากแคช (bfcache) → รีเฟรชหน้าเอง**
  (`components/IdleRefresh.tsx` ใน root layout, เวลาใช้งานล่าสุดเก็บใน localStorage `ep_last_active` นับรวมทุกแท็บ)
  - ⚠️ ถ้ามีของค้างในตะกร้า POS แล้วทิ้งไว้เกิน 30 นาที ตะกร้าจะหาย (ตะกร้าอยู่ในหน่วยความจำ)
- ตรวจแล้ว (local): session ใหม่อายุ 10.00 วัน ✅, cookie `ep-dev.session_token` Max-Age 864000 ✅,
  จำลองไม่ใช้งาน 31 นาที → รีเฟรช ✅ / 5 นาที → ไม่รีเฟรช ✅, build ด้วย deployment id ทดสอบ ✅

---

## 2026-11-16 — เว็บขึ้น "This page couldn't load" เป็นระยะ (branch dev)
- ตรวจเว็บจริง: `/api/health?db=1` 25/25 ครั้งปกติ ไม่มีช้า → ไม่ได้ล่มตลอด เป็นครั้งคราว
- สาเหตุที่น่าจะเป็น: **version skew** — วันนี้ deploy หลายรอบ ขณะผู้ใช้เปิดแท็บค้าง; แท็บเก่าเรียก JS/Server Action ของเวอร์ชันที่ไม่มีแล้ว
  - แก้: `next.config.ts` → `deploymentId` = `VERCEL_DEPLOYMENT_ID` → แท็บเก่าจะ reload เต็มหน้าเองเมื่อ deploy ใหม่
- กัน connection ค้าง: postgres-js `idle_timeout: 20`, `max_lifetime: 600`, `connect_timeout: 10`
- `src/app/[locale]/error.tsx` + `global-error.tsx` + `components/ErrorScreen.tsx`: หน้า error ไทย/อังกฤษ ปุ่มลองใหม่/โหลดใหม่,
  แสดงรหัสอ้างอิง (digest) ไว้หาใน Vercel Logs, เจอ ChunkLoadError/Server Action ไม่ตรง → reload อัตโนมัติ 1 ครั้ง
- ถ้ายังเกิดหลัง deploy นี้: ดู Vercel → Project → Logs (กรอง Error) เทียบรหัสอ้างอิงบนหน้าจอ

---

## 2026-11-16 — บันทึกสินค้าหมุนนาน: วิเคราะห์ + ลด query (branch dev)
- วัดเว็บจริง: หน้าไม่แตะ DB ~0.23s, request ที่แตะ DB ~0.38s (อุ่น) / ~0.76s (instance ใหม่ + ต่อ DB ใหม่) → ช้าหลักๆ ตอน "เย็น"
- บั๊ก: `requireStoreAccess` ถูก cache แยกตาม argument permission → layout กับ page query ร้าน+สมาชิกซ้ำ 2 รอบ
  แก้: แยก `loadStoreAccess(locale, storeId)` ที่ cache ต่อ request แล้วเช็กสิทธิ์ข้างนอก → หน้าคลังสินค้า 6 → 4 query
- `/api/health?db=1` ping DB คืน `dbMs` — ใช้วัดความเร็ว และให้ตัว ping ภายนอก (เช่น cron-job.org ทุก 5 นาที) กันเครื่องเย็น/กัน Supabase pause
- `DEBUG_SQL=1` ใน .env.local → พิมพ์ทุก query ลง console (ใช้หาจุดช้า)
- วัดจากเครื่องนี้ (บ้าน → Tokyo): query ละ ~100ms, ต่อใหม่ ~600ms — dev local จึงช้ากว่าเว็บจริงมาก
- **Deploy แล้ว** — เว็บจริง `/api/health?db=1`: dbMs 5–6ms (อุ่น), 49ms (ต่อใหม่) → DB ไม่ใช่คอขวด
- แนะนำผู้ใช้ตั้ง cron-job.org ping `https://easy-pos-beta.vercel.app/api/health?db=1` ทุก 5 นาที — **ผู้ใช้ตั้งแล้ว (2026-11-16)** ดูผลที่ cron-job.org > History

---

## 2026-11-16 — เปลี่ยนรหัสผ่าน + ลบบัญชี (branch dev)
- หน้าจัดการบัญชี: ส่วน **รหัสผ่าน** — รหัสปัจจุบัน + รหัสใหม่ (`auth.api.changePassword`, อุปกรณ์อื่นหลุด เครื่องนี้อยู่ต่อ)
  - ปุ่ม "ลืมรหัสผ่าน? ส่ง OTP ไปที่อีเมล" → ใช้ `forgotPasswordAction` เดิม → `/reset`
  - บัญชี Google ที่ไม่มีรหัสผ่าน → แสดงปุ่ม "ตั้งรหัสผ่านด้วย OTP" แทน (`users.hasPassword`)
- **ลบบัญชี**: ป๊อปอัพ `<dialog>` เตือน + รายชื่อร้านที่เป็นเจ้าของที่จะถูกลบ + ต้องพิมพ์ "ลบบัญชี" (en: DELETE) ปุ่มถึงจะกดได้
  - server เช็กคำยืนยันซ้ำ → signOut → `users.deleteAccount` (transaction: ลบร้านที่เป็นเจ้าของ + ข้อมูลร้าน, ล้าง `store_invites.created_by`, ลบผู้ใช้)
- ทดสอบ: สร้างผู้ใช้ทดสอบตรงใน DB (ไม่ส่งอีเมลจริง) → รหัสปัจจุบันผิดขึ้น error ✅ → เปลี่ยนรหัสสำเร็จ ✅ →
  ป๊อปอัพลบ: พิมพ์ไม่ครบปุ่มกดไม่ได้ ✅ → ลบแล้วไปหน้า login "ลบบัญชีเรียบร้อยแล้ว" ✅ → DB ไม่มีผู้ใช้/ร้านทดสอบ ข้อมูลจริงอยู่ครบ ✅
- **หมายเหตุทดสอบ:** ตอนนี้ SMTP เปิดแล้ว การสมัครจะส่งอีเมลจริง — ทดสอบให้สร้างผู้ใช้ตรงใน DB ด้วย `hashPassword` จาก `better-auth/crypto`

---

## 2026-11-16 — ธีมสว่างขาว-ส้ม + โหมดมืด (branch dev)
- ค่าเริ่มต้น = **สว่าง ขาว-ส้ม** (`--brand #ea580c`), ธีมเขียวอมฟ้าเดิมย้ายเป็น **โหมดมืด** (`[data-theme="dark"]`)
- token ใหม่ `brand-ink` (#c2410c) สำหรับตัวอักษรสีส้มบนพื้นขาว (อ่านง่ายกว่า #ea580c) — ใช้ `text-brand-ink` แทน `text-brand`
- ปุ่มสลับ ☀/🌙 (`components/ThemeToggle.tsx`) อยู่ใน TopBar และหน้า login/สมัคร → cookie `theme` → layout ใส่ `data-theme` ฝั่ง server (ไม่กระพริบ)
- `dark:` ของ Tailwind ผูกกับ `data-theme` (`@custom-variant dark`) ไม่ใช่ตามระบบเครื่อง; theme-color ของมือถือเปลี่ยนตามธีม
- ตรวจแล้ว: หน้า login สว่าง ✅ → กดสลับเป็นมืดทันที ✅ → เปลี่ยนหน้ายังมืด (server render) ✅; build ✅

---

## 2026-11-16 — เอฟเฟกต์ชี้/กดปุ่ม (branch dev)
- `globals.css`: ทุกปุ่ม/ลิงก์ — กดแล้วยุบ (`scale`), ชี้แล้วสว่างขึ้น (เฉพาะเครื่องที่มีเมาส์), Tab แล้วมีวงแหวนสีแบรนด์
- utility ใหม่: `pressable` (การ์ดลอย + ขอบ/เงาสีแบรนด์ — ใช้กับเมนู, สินค้าใน POS, รายการร้าน),
  `row-hover` (แถวในรายการมีแถบสีซ้าย), `animate-pop` (ตัวเลขในตะกร้าเด้งเมื่อเปลี่ยน)
- ไอคอนในการ์ดเมนูขยาย/เอียงเล็กน้อยเมื่อชี้; เคารพ `prefers-reduced-motion`
- ใช้ property `scale`/`translate` แยก (ไม่ใช้ `transform`) เพื่อไม่ชนกับ class ของ Tailwind 4

---

## 2026-11-16 — ยืนยันอีเมล OTP + ลืมรหัสผ่าน + Google (branch dev)
**กติกาใหม่ (ผู้ใช้สั่ง):** ล็อกอิน/สมัครได้ 2 ทาง — ปุ่ม Google หรือ อีเมล **@gmail.com เท่านั้น** + รหัสผ่าน ที่ต้องยืนยัน OTP ทางอีเมล
- Better Auth `emailOTP` plugin: OTP 6 หลัก, อายุ 10 นาที, ผิดได้ 5 ครั้ง, เก็บแบบ hash; `requireEmailVerification`
- เช็ก @gmail ทั้งในฟอร์มและใน hook `/sign-up/email` (ยิง API ตรงก็ถูกปฏิเสธ `GMAIL_ONLY`)
- ใส่รหัสผ่านผิด → ปุ่ม "ลืมรหัสผ่าน? ส่งรหัสไปที่อีเมล" → `/reset` ใส่ OTP + รหัสใหม่ (ออกจากระบบทุกเครื่อง)
- บัญชีที่ยังไม่ยืนยัน (เช่นบัญชีที่สมัครก่อนหน้านี้) ล็อกอินด้วยรหัสถูก → ส่ง OTP แล้วไป `/verify`
- อีเมลที่กำลังยืนยันเก็บใน cookie httpOnly `ep_auth_email` (ไม่ใส่ใน URL)
- กันส่งรัว: ส่ง OTP ซ้ำได้หลัง 60 วินาที (เช็กจากตาราง verifications — ใช้ได้บน serverless) + rate limit ของ plugin
- ส่งอีเมล: `src/server/mail.ts` (nodemailer 10.3.1 → Gmail SMTP + App Password), ชื่อผู้ส่ง "EASY-POS (no-reply)",
  header `Auto-Submitted`; **dev ที่ไม่ได้ตั้ง SMTP จะพิมพ์อีเมล/OTP ลง console แทน**
- ปุ่ม Google แสดงเมื่อมี `GOOGLE_CLIENT_ID/SECRET`; บัญชี Google อีเมลเดียวกันจะรวมกับบัญชีเดิม (accountLinking)
- ตรวจแล้ว (local): API ปฏิเสธ hotmail ✅ → สมัคร gmail → /verify → OTP ผิดขึ้น error → OTP ถูกเข้า hub ✅ →
  ออก → รหัสผิด → ปุ่มลืมรหัสผ่าน → OTP reset → กดส่งซ้ำติด cooldown ✅ → ตั้งรหัสใหม่ → ล็อกอินด้วยรหัสใหม่ ✅; build ✅

- ทดสอบส่งอีเมลจริงผ่าน Gmail SMTP แล้ว — ผู้ใช้ได้รับ OTP และตั้งรหัสใหม่สำเร็จ ✅
- Google OAuth: Google Cloud project `EASY-POS`, client แบบ Web, redirect URI ทั้ง localhost และ easy-pos-beta.vercel.app
  - ยังอยู่โหมด **Testing** (ใช้ปุ่ม Google ได้เฉพาะ test users ที่เพิ่มในหน้า Audience, สูงสุด 100)
  - จะ publish ได้ต้องมีหน้า Privacy Policy + หน้าแรก ใน Branding (ยังไม่ได้ทำ)
  - ตรวจแล้ว: ปุ่มขึ้น, กดแล้วไป accounts.google.com ด้วย redirect_uri ถูกต้อง ✅ (ยังไม่ได้ล็อกอินจนจบ — ผู้ใช้ลองเอง)

**ต้องตั้งบน Vercel ก่อน deploy:** `SMTP_USER`, `SMTP_PASS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

---

## 2026-11-16 — สแกนบาร์โค้ดด้วยกล้อง (branch dev)
- `src/components/CameraScanner.tsx`: เปิดกล้องหลัง, อ่านทุก ~120ms, สั่น+บี๊บเมื่อเจอ, กันรหัสซ้ำ 1.5 วินาที
  - ใช้ `BarcodeDetector` ของเบราว์เซอร์ถ้ามี (Android Chrome) ไม่งั้นโหลด `barcode-detector/ponyfill` (zxing-wasm) — iPhone/Firefox/คอม
  - ไฟล์ WASM เสิร์ฟจาก `public/wasm/zxing_reader.wasm` (ไม่ใช้ CDN) — `postinstall` → `scripts/copy-wasm.mjs` คัดลอกให้ตรงเวอร์ชัน
  - `barcode-detector` ล็อกเวอร์ชัน **3.2.3** (3.2.4 เพิ่งออก 1 วัน — รอให้นิ่งก่อน)
- หน้าขาย: ปุ่มกล้องข้างช่องค้นหา สแกนต่อเนื่อง เพิ่มลงตะกร้า แสดงผลล่าสุด + ยอดรวม
- ฟอร์มสินค้า: ปุ่มกล้องข้างช่องบาร์โค้ด (เจอแล้วกรอกให้และปิดกล้อง)
- ตรวจแล้ว: ถอดรหัสภาพ EAN-13 / Code128 ด้วย WASM ที่เสิร์ฟเองได้ถูกต้อง, `/wasm/zxing_reader.wasm` 200, lint/build ✅
- **ยังไม่ได้ทดสอบกับกล้องจริง** (เบราว์เซอร์ทดสอบไม่มีกล้อง) — กล้องใช้ได้เฉพาะ https หรือ localhost

---

## 2026-11-16 — ยกเลิกบิล + ตั้งค่าร้าน (branch dev)
- Migration `0002_store_settings_void`: `stores.receipt_footer`, `stores.allow_negative_stock`, `sales.voided_at/voided_by/void_reason`
- `sales.void()` ใน transaction: ล็อกบิล → voided → คืนสต็อก (movement `refund`) — ยอดในภาพรวมนับเฉพาะ `completed`
- เมนูใหม่ **ประวัติบิล** (`store/[id]/sales`, เลือกวันที่) + หน้ารายละเอียดบิล (พิมพ์ซ้ำ, ยกเลิกต้องมีสิทธิ์ `pos.refund`)
- หน้า **ตั้งค่าร้าน**: ชื่อ, ทามโซน, VAT % + รวมในราคา, ค่าเริ่มต้นแจ้งเตือนใกล้หมด, ขายติดลบได้, ข้อความท้ายใบเสร็จ
  - สกุลเงินแก้ไม่ได้ (ยอดเก่าเก็บเป็นหน่วยย่อยของสกุลเดิม)
- `pos/Receipt.tsx` ใช้ร่วมกันทั้งหลังขายและหน้าบิล
- ตรวจแล้ว: ตั้ง VAT 7% + ขายติดลบ + footer → ขาย 2 ชิ้น (สต็อก 1) ด้วย QR → ใบเสร็จ VAT ฿14 จาก ฿214 ✅ →
  ยกเลิกบิล → สต็อก 1→-1→1, บิล completed = 0 ✅; lint/build ✅; ลบข้อมูลทดสอบแล้ว

---

## 2026-11-16 — Phase 2: คลังสินค้า + ระบบขาย + ภาพรวม (branch dev)
**ทำอะไรไปบ้าง**
- Repos ใหม่ `src/adapters/db/postgres/inventory.ts`: products, stock (move ใน transaction + FOR UPDATE), sales
  - `sales.create`: advisory lock ต่อร้าน → ล็อกสินค้า → ใช้ราคา/ต้นทุนจาก DB → เช็กสต็อก → เลขใบเสร็จ `YYMMDD-0001` ต่อวัน (ทามโซนร้าน) → ตัดสต็อก + movement
  - `dailyTotals`: ยอด/จำนวนบิล/ต้นทุนรายวันตาม business_date
- หน้า: คลังสินค้า (ค้นหา/หมวด/ใกล้หมด, เพิ่ม/แก้/ลบแบบซ่อน), รับเข้า/เบิกออก/ปรับยอด, ประวัติสต็อก,
  ระบบขาย (`pos/PosClient.tsx`: สแกนบาร์โค้ด+Enter, หมวด, ตะกร้า, ส่วนลดตามสิทธิ์, เงินสด/QR/บัตร/โอน, เงินทอน, ใบเสร็จพิมพ์ได้),
  ภาพรวม (วันนี้/กำไรขั้นต้น/เดือนนี้/กราฟ 7 วัน/บิลล่าสุด/ใกล้หมด)
- `src/server/form.ts` ตัวช่วยอ่าน FormData; `core/lib/format.ts` เพิ่ม parseMoney, minorToInput, fill, todayIn, addDays
- ตรวจแล้ว (local + Supabase): เพิ่มสินค้า (สต็อกเริ่มต้น 5) → รับเข้า +10 → POS สแกน 3 ครั้ง → เงินสด 100 ทอน 62.50 →
  สต็อกเหลือ 12 → ภาพรวมยอด 37.50 กำไร 13.50 ✅; มุมมองมือถือ ✅; lint/build ✅ แล้วลบข้อมูลทดสอบ

**ข้อสังเกต**
- บั๊กที่แก้แล้ว: สแกนรัวๆ อ่าน state เก่า → อ่านค่าจาก input ตรงๆ + `setCart` แบบ functional
- ขายเกินสต็อกไม่ได้ (สินค้าที่นับสต็อก) — ถ้าต้องการขายติดลบได้ ต้องเพิ่มตัวเลือกในตั้งค่าร้าน
- Supabase Nano เคย statement timeout ชั่วคราว 1 ครั้งตอนทดสอบ — ถ้าเจอบ่อยให้ดู Supabase > Observability

---

## 2026-11-16 — แก้เว็บหน่วง
- สาเหตุ: Vercel รันฟังก์ชันที่ **iad1 (สหรัฐฯ)** แต่ DB อยู่ **Tokyo** → ทุก query ข้ามแปซิฟิก ~150ms × 5-10 query ต่อการกด
- แก้: `vercel.json` → `"regions": ["hnd1"]` (Tokyo ข้าง DB) — **ถ้าย้าย DB ต้องย้าย region ตาม**
- Better Auth `cookieCache` 5 นาที (ไม่ query session ทุกหน้า); `saveAccountAction` refresh cookie หลังแก้โปรไฟล์
  - สิทธิ์ในร้าน (`requireStoreAccess`) ยังเช็กจาก DB ทุกครั้ง — ไม่ cache
- `PrimaryButton` เป็น client component ใช้ `useFormStatus`: หมุน + กดซ้ำไม่ได้ระหว่างส่ง
- `loading.tsx` ใน hub และ store → ขึ้นตัวหมุนทันทีเมื่อกดเมนู

---

## 2026-11-16 — Deploy Vercel
- Vercel project `easy-pos` → https://easy-pos-beta.vercel.app (push `main` = deploy อัตโนมัติ)
- Env บน Vercel: `DATABASE_URL` (pooler), `DATABASE_POOL_MAX=2`, `DB_DRIVER`, `AUTH_PROVIDER`, `AUTH_SECRET` (คนละค่ากับในเครื่อง)
- ไม่ต้องตั้ง `APP_URL` บน Vercel — `src/server/env.ts` ใช้ `VERCEL_PROJECT_PRODUCTION_URL` + `VERCEL_URL` (preview) เป็น trustedOrigins
  - ถ้าผูกโดเมนของตัวเอง: ตั้ง `APP_URL=https://โดเมน`
- ตรวจแล้ว: `/api/health` 200, `/th/login` 200, `/th/hub` (ไม่ล็อกอิน) → 307 ไป login (อ่าน session จาก Supabase ได้)

---

## 2026-11-16 — ต่อ Supabase
- Project `easy-pos` อยู่ region **Tokyo** (ap-northeast-1); ใช้ Transaction pooler
  `postgres.<ref>@aws-1-ap-northeast-1.pooler.supabase.com:6543` (เป็น **aws-1** ไม่ใช่ aws-0)
- ลิงก์ Direct `db.<ref>.supabase.co:5432` เป็น IPv6 อย่างเดียว — เครื่องนี้และ Vercel ต่อไม่ได้ ห้ามใช้
- รัน migration 0000 + **0001_enable_rls** (เปิด RLS ทุกตาราง ไม่มี policy) — กันไม่ให้ Supabase Data API
  (anon key) อ่าน/เขียนตารางได้ เพราะแอปต่อด้วย role postgres ซึ่งข้าม RLS อยู่แล้ว
  - **ตารางใหม่ทุกตารางต้องเพิ่ม `ENABLE ROW LEVEL SECURITY` ใน migration ด้วย**
- ทดสอบกับ Supabase: สมัคร → สร้างร้าน → หน้า พนักงาน → สร้างรหัสเชิญ ✅ แล้วลบข้อมูลทดสอบออก (DB ว่าง)

---

## 2026-11-16 — Phase 1: Auth + ร้านค้า + รหัสเชิญ
**ทำอะไรไปบ้าง**
- ติดตั้ง Better Auth 1.7 (`src/server/auth.ts`) ใช้ตาราง `users` เดิม + เพิ่ม `sessions`, `accounts`, `verifications`; id เป็น uuid
- `src/server/session.ts`: `getSessionUser`, `requireUser`, `requireStoreAccess` (เช็กสมาชิก + สิทธิ์ฝั่ง server)
- Repositories จริง: `users`, `stores` (createWithOwner ใน transaction, redeemInvite ใน transaction + FOR UPDATE)
- หน้า login/register/logout จริง (server actions), แสดง error ตาม `?error=`; ปุ่ม Google แสดงเมื่อมี env
- hub: สร้างร้าน, ร้านของฉัน, เข้าร่วมร้าน (รหัสเชิญ), บัญชี (ชื่อ/ภาษา/ทามโซน)
- ร้าน: เมนูกรองตามสิทธิ์, หน้า **พนักงาน** (`store/[storeId]/staff`) สร้างรหัสเชิญ + เอาสมาชิกออก
- Migration แรก `drizzle/0000_init.sql`; env ใหม่ `DATABASE_POOL_MAX`
- ตรวจแล้ว: lint ✅ build ✅ และทดสอบในเบราว์เซอร์กับ PGlite: สมัคร 2 บัญชี → สร้างร้าน → สร้างรหัสเชิญ (cashier) →
  บัญชีที่ 2 เข้าร่วม (รหัสผิดขึ้น error, พิมพ์ตัวเล็ก/มีขีดก็ได้) → เห็นเฉพาะเมนู cashier → เข้า /staff, /reports ตรงๆ ถูกเด้งกลับ →
  ร้านที่ไม่มีอยู่ได้ 404 → บันทึกบัญชีเปลี่ยนภาษา/ทามโซนได้ → รหัสผ่านผิดขึ้น error → ออกจากระบบได้

**ข้อสังเกต / สิ่งที่ต้องรู้**
- หน้าใช้ session ต้องเรียก `headers()` ก่อน (ทำใน `getSessionUser` แล้ว) ไม่งั้น build จะพยายาม prerender แล้วต่อ DB
- PGlite ต้องใช้ `DATABASE_POOL_MAX=1` (ไม่งั้น error `bind message supplies 2 parameters...`) — Postgres จริงไม่มีปัญหานี้
- ยังไม่มี: ยืนยันอีเมล, ลืมรหัสผ่าน, ลบบัญชี (ต้องมีบริการส่งอีเมล — Phase 3)
- `.env.local` ในเครื่องนี้ชี้ไป PGlite — ห้าม commit

---

## 2026-11-16 — เริ่มโปรเจกต์ EASY-POS
**ทำอะไรไปบ้าง**
- วิเคราะห์ SmartStock เดิม (FastAPI + Postgres + HTML ไฟล์เดียว) → สรุปไว้ที่ `docs/LEGACY-SMARTSTOCK.md`
  - ไม่ได้นำโค้ด/ข้อมูลเดิมขึ้น repo เพราะมีรหัสลับและข้อมูลจริง
- ตัดสินใจ stack: Next.js 16 + TypeScript + Tailwind 4 + Drizzle + Postgres (Supabase) + Vercel
  - ไม่เลือก Firebase เพราะ POS ต้องทำรายงาน/transaction ตัดสต็อก ซึ่ง SQL เหมาะกว่า
  - ใช้ i18n แบบ dictionary ของ Next เอง (ไม่ใช้ next-intl) เพื่อลด dependency
- วางสถาปัตยกรรม ports & adapters (`src/core` ไม่ผูก framework) → ดู `docs/ARCHITECTURE.md`
- สร้างหน้า: `/[locale]/login`, `/register`, `/hub` (สร้างร้าน, ร้านของฉัน, เข้าร่วมร้าน, จัดการบัญชี, ออกจากระบบ),
  `/hub/create-store|stores|join|account`, `/store/[storeId]` (12 เมนู), `/store/[storeId]/[module]` (placeholder)
- สร้าง Drizzle schema: users, stores, store_members, store_invites, products, stock_movements,
  customers, sales, sale_items, expenses, audit_logs
- ตรวจแล้ว: `npm run build` ผ่าน, `npm run lint` ผ่าน, เปิดดูในเบราว์เซอร์ได้ทั้ง th/en

**ข้อสังเกต / สิ่งที่ต้องรู้**
- Next.js 16: `middleware.ts` เปลี่ยนชื่อเป็น `src/proxy.ts`; `params` ของ page เป็น Promise ต้อง `await`
- ปุ่มล็อกอิน/สมัคร/สร้างร้าน ตอนนี้แค่ redirect ไปหน้าถัดไป (เพื่อดู UI) — ค้นหา `TODO(phase 1)` เพื่อดูจุดที่ต้องต่อของจริง
- ร้าน `demo` เป็นข้อมูลปลอมใน `hub/stores/page.tsx`
- `drizzle-kit` บน Windows ติดตั้งด้วย `--ignore-scripts` ได้ ถ้า esbuild postinstall error
