# บันทึกความคืบหน้า (Handoff log)

> ไฟล์นี้คือ "สมุดส่งงาน" — ทุกครั้งที่ทำงานเสร็จหนึ่งรอบ ให้เพิ่มรายการใหม่ **ไว้บนสุด**
> เครื่องใหม่ / Claude session ใหม่: อ่านไฟล์นี้ + ROADMAP.md ก่อนเริ่มงาน

## สถานะปัจจุบัน
- **ทำต่อ:** branch `dev` (= `main` + เอกสาร) ไม่มีงานค้างที่ยังไม่ commit; ขั้นตั้งเครื่องใหม่ดู README หัวข้อ "เริ่มใช้งานบนเครื่องใหม่"
- **งานถัดไปที่น่าทำ (จาก ROADMAP):** ส่งออก Excel, พิมพ์บาร์โค้ดสินค้า, คืนสินค้าบางรายการ, รายงานกำไร/สินค้าขายดี,
  หน้า Privacy Policy แล้ว publish Google OAuth, ทดสอบเครื่องพิมพ์/เครื่องสแกนจริงกับผู้ใช้
- **ผู้ใช้ยังต้องทำเอง:** นำเข้า stock_export.xlsx ในร้านจริง (ราคาทุนในไฟล์ส่วนใหญ่เป็น 0), ตั้งค่าลังรายสินค้า
- **Deploy ล่าสุด (2026-11-17, 60c2756)** — ปรับ 5 ข้อ (เอา BLE ออก, บาร์โค้ดบนสุด+แก้ไทย, cookie คงที่, ค้นหาทันที, ติดตั้งแอป PWA) + นำเข้า Excel + หมวดย่อย + ขายปลีก/ยกลัง
- Deploy ก่อนหน้า (6f90d61) — รูปสินค้า + env SUPABASE_URL/SUPABASE_SECRET_KEY
- Deploy ก่อนหน้า (c0771a1) — แก้ตัวจับการสแกน + เชื่อมเครื่องสแกนผ่าน Bluetooth
- Deploy ก่อนหน้า (d846d85) — เพิ่ม: deploymentId (กัน version skew), หน้า error, session 60 วันแบบต่ออายุ +
  ล็อกอินใหม่ทุก deploy, รีเฟรชเมื่อไม่ใช้ 30 นาที, เชื่อมเครื่องพิมพ์สลิป/เครื่องสแกน, สแกนได้ทุกภาษาคีย์บอร์ด
  - ตรวจเว็บจริง: health db/login/wasm 200, hub 307, หน้าเว็บมี `data-dpl-id` ✅
- Deploy ก่อนหน้า — https://easy-pos-beta.vercel.app = Phase 1 + Phase 2 + ยกเลิกบิล + ตั้งค่าร้าน + สแกนกล้อง +
  OTP/ลืมรหัสผ่าน/Google + ธีมขาว-ส้ม/มืด + เปลี่ยนรหัส/ลบบัญชี
- `main` = `dev` ณ ตอน deploy; ทำงานต่อบน `dev` แล้ว merge เข้า `main` เมื่อผู้ใช้สั่ง deploy
- DB บน Supabase migrate ถึง `0002`; env บน Vercel ครบ (DATABASE_URL, DATABASE_POOL_MAX, DB_DRIVER, AUTH_PROVIDER, AUTH_SECRET,
  SMTP_USER, SMTP_PASS, MAIL_FROM_NAME, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- ตรวจเว็บจริงหลัง deploy: health/login/register/wasm = 200, /th/hub ไม่ล็อกอิน → 307, ปุ่ม Google ขึ้น, API ปฏิเสธ hotmail ✅
  (ยังไม่ได้ทดสอบส่ง OTP บนเว็บจริง — ผู้ใช้ทดสอบเอง)
- งานถัดไป: ดู ROADMAP (ยกเลิกบิล/คืนสินค้า, ตั้งค่าร้าน/VAT, สแกนด้วยกล้อง ...)

---

## 2026-11-17 — กรองหมวดย่อยในคลังสินค้า (branch dev)
- เลือกหมวดหลักแล้ว → แถวปุ่มหมวดย่อยโผล่ใต้ช่องค้นหา: "ทั้งหมด" · หมวดย่อยต่างๆ · "ไม่มีหมวดย่อย" (สินค้าที่มีแค่หมวดหลัก)
  หมวดที่ไม่มีหมวดย่อยเลย → ไม่แสดงแถว; dropdown บอกจำนวนหมวดย่อย เช่น "เครื่องดื่ม (3)"
- URL `?cat=..&sub=..` (`sub=-` = ไม่มีหมวดย่อย); `products.list` รับ `subcategory` (null = ว่าง); `categoryTree` มี `hasNoSub`
- lint/typecheck/build ✅ (ยังไม่ได้เปิดดูในเบราว์เซอร์ — ต้องล็อกอิน)

---

## 2026-11-17 — แก้เครื่องสแกนบน iPad/iOS ไม่ขึ้น (branch dev)
- อาการ: iPad จับคู่เครื่องสแกนแล้ว แต่เว็บไม่เห็น (Android/คอมปกติ)
- `client/devices/scanner.ts`: บน iOS ผ่อนเกณฑ์ความเร็ว (avg 140ms, gap 350ms, ไม่มี Enter รอ 400ms);
  ไม่ตัดทิ้งเมื่อ isComposing; สำรองอ่านจาก `input` event (insertText ทีละ 1 ตัว) เมื่อ keydown ไม่บอกตัวอักษร
- หน้าต่างทดสอบเครื่องสแกน: มีช่อง "แตะช่องนี้แล้วยิง" (inputMode none ไม่เด้งคีย์บอร์ด) + บันทึกปุ่มที่ได้รับ (key/code/ms) ไว้ดูสาเหตุ
- ยังไม่ได้ทดสอบกับ iPad จริง — ถ้ายังไม่ขึ้น ให้ผู้ใช้แคปหน้าจอ "ปุ่มที่เครื่องได้รับ" มา
- lint/typecheck/build ✅

---

## 2026-11-17 — ข้อมูลอัปเดตข้ามเครื่องอัตโนมัติ (branch dev)
- ปัญหา: แก้ข้อมูลในคอม → มือถือที่เปิดค้างไว้ไม่เห็นจนกดรีเฟรชเอง
- `components/LiveRefresh.tsx` (root layout): `router.refresh()` เมื่อกลับมาที่แอป/แท็บ, focus, ต่อเน็ตได้ (ทันที)
  และทุก 30 วิระหว่างเปิดหน้า (ข้ามตอนกำลังพิมพ์/มีป๊อปอัพเปิด); เว้นอย่างน้อย 5 วิ — state ฝั่งหน้า (ตะกร้า/ข้อความ) ไม่หาย
- ทดสอบ: ยิง focus → server ได้ request ใหม่ หน้าไม่ reload ✅; build ✅
- ถ้าต้องการเรียลไทม์ทันทีในอนาคต: Supabase Realtime / SSE (ตอนนี้ polling 30 วิ ภาระ DB น้อย)

---

## 2026-11-17 — นำเข้า Excel + หมวดย่อย + ขายปลีก/ยกลัง (branch dev)
**นำเข้า Excel/CSV** (`inventory/import`, ปุ่ม "นำเข้า Excel" ในคลัง — สิทธิ์ products.create)
- อ่านไฟล์ในเบราว์เซอร์ `src/client/sheet.ts`: .xlsx = zip+XML → `fflate@0.8.3` (ไม่มี dependency) + DOMParser; .csv รองรับ quote/BOM
  - ไม่ใช้ read-excel-file (dependency แปลกๆ หลายตัว) / SheetJS
- จับคู่หัวคอลัมน์อัตโนมัติ (ไทย/อังกฤษ เช่น บาร์โค้ด, ชื่อสินค้า, ราคาขาย, ราคาทุน, จำนวนคงเหลือ, หมวดหลัก, หมวดย่อย) แก้เองได้ + ตัวอย่าง 15 แถว + ไฟล์ตัวอย่าง CSV
- server ทำความสะอาดทุกช่อง: "nan"/ว่าง → null, บาร์โค้ดตัวเลข "…0.0"/"8.85E12" → สตริง, แป้นไทย → อังกฤษ; ส่งทีละ 200 แถว
- `products.importRows` (transaction): บาร์โค้ดตรง = อัปเดต (สต็อกตามไฟล์ถ้าติ๊ก → movement adjust), ไม่ตรง = เพิ่ม (movement in), ซ้ำในไฟล์ = ข้าม
- ทดสอบกับไฟล์จริงของผู้ใช้ (stock_export.xlsx, 82 แถว) ในร้านทดสอบ: เพิ่ม 81 + อัปเดต 1 (บาร์โค้ดที่มีอยู่) ข้าม 0;
  "nan" → ไม่มีบาร์โค้ด, 3 หมวด/11 หมวดย่อยตรงไฟล์, ราคา 195 → 19500 สตางค์ ✅ (ลบร้านทดสอบแล้ว)
**หมวดย่อย** — `products.subcategory`; `CategoryPicker` dropdown หมวดที่เคยใช้ + "+ เพิ่มหมวดใหม่…", หมวดย่อยกรองตามหมวดหลัก;
  หน้าขายมีชิปหมวดย่อยเมื่อเลือกหมวด; คลังแสดง "หมวด › หมวดย่อย"
**ขายปลีก/ยกลัง** — สต็อกนับเป็นหน่วยปลีกเสมอ; สินค้าตั้งได้: `pack_unit` (ลัง), `pack_size`, `pack_price_minor` (ว่าง = ราคาชิ้น×จำนวน), `pack_barcode`
- รับเข้า: เลือกหน่วย ชิ้น/ลัง (ลัง × pack_size), ยิงบาร์โค้ดลังเลือกหน่วยลังให้
- หน้าขาย: แตะการ์ด = ปลีก, ปุ่ม "+1 ลัง ×N ฿…" ใต้การ์ด หรือยิงบาร์โค้ดลัง; ตะกร้าแยกบรรทัดปลีก/ลัง; จำกัดตามสต็อกรวม
- บิล: `sale_items.base_qty` = ชิ้นที่ตัดจริง; ชื่อรายการ "สินค้า (ลัง ×12)"; ยกเลิกบิลคืนตาม base_qty
- คลัง: แสดง "54 ชิ้น = 4 ลัง 6 ชิ้น"
- Migration `0004_subcategory_pack` (เพิ่มคอลัมน์อย่างเดียว) — migrate Supabase แล้ว
- ทดสอบ: ตั้งลัง×12 ในฟอร์ม ✅ → หน้าขาย 1 ลัง + 2 ชิ้น = ฿140, สต็อก 30→16, base_qty 12/2 ✅ → ยกเลิกบิล สต็อกกลับ 30 ✅ →
  รับเข้า 2 ลัง 30→54 ✅; lint/build ✅

---

## 2026-11-17 — ปรับตามผู้ใช้ 5 ข้อ (branch dev)
1. **เอาปุ่มเชื่อมเครื่องสแกนผ่าน Bluetooth (BLE) ออก** (หลุดบ่อย) — ใช้เครื่องสแกนแบบคีย์บอร์ดอย่างเดียว
   - สถานะ "เชื่อมแล้ว" = เห็นการสแกนตั้งแต่เปิดหน้า; **ปิด/สลับแอป/ออกจากหน้า → รีเซ็ตเป็น "ยังไม่พบ"** (ไม่จำใน localStorage แล้ว)
   - เกณฑ์เวลาผ่อนอีก: เฉลี่ย ≤100ms/ตัว, ห่างสูงสุด 200ms
2. **ช่องบาร์โค้ดอยู่บนสุดของฟอร์มสินค้า** + แก้ "ยิงตอนคีย์บอร์ดไทยได้อักษรไทย":
   - `core/lib/keyboard.ts` → `toEnglishLayout()` (ย้ายตาราง ไทย→อังกฤษ มาไว้ core ใช้ได้ทั้ง server/client)
   - ช่องบาร์โค้ดแปลงทันทีตอนพิมพ์ ("ๅ/-ภ" → "1234") ไม่ขึ้นกับความเร็วเครื่องยิง
   - หน้าขาย (Enter ในช่องค้นหา / กรองรายการ) และหน้าคลัง (ค้นแล้วไม่เจอ → ลองแปลงแป้น) ก็รองรับ
3. **อัปเดตเว็บไม่ต้องล็อกอินใหม่**: `cookiePrefix` คงที่ `"ep"` (เดิมผูกกับรหัส deploy) — หลุดเฉพาะ session หมดอายุ (60 วันไม่ใช้)
   - deploy รอบนี้จะทำให้ทุกคนล็อกอินใหม่อีก **ครั้งสุดท้าย** (เพราะเปลี่ยนชื่อ cookie)
4. **ค้นหา/กรองคลังสินค้าทำงานทันที** (`inventory/InventoryFilters.tsx`): พิมพ์ (หน่วง 0.3 วิ) / เลือกหมวด / ติ๊กใกล้หมด → `router.replace` ไม่ต้องกดปุ่ม, มีปุ่ม × ล้าง
5. **ติดตั้งแอป (PWA)**: `app/manifest.ts`, ไอคอนสร้างจากโค้ด `/api/pwa-icon/{180,192,512}` (+ maskable), apple-touch-icon
   - `components/InstallPrompt.tsx`: ป๊อปอัพหลังล็อกอิน (`/hub?welcome=1` จาก login/verify/Google) หรือเข้าเว็บครั้งแรกในเครื่อง
   - ปุ่ม "ติดตั้งเลย" (Chrome/Edge/Samsung ผ่าน beforeinstallprompt) + วิธีติดตั้ง 4 แบบ: iPhone/iPad, Android, Samsung Internet, คอม (เลือกแท็บอุปกรณ์ให้อัตโนมัติ)
   - ไม่แสดงถ้าเปิดจากแอปที่ติดตั้งแล้ว (display-mode: standalone)
- ตรวจแล้ว (local): manifest/ไอคอน 200 ✅, ล็อกอิน → ป๊อปอัพขึ้น + URL ไม่ค้าง ?welcome=1 ✅, ค้นหาพิมพ์แล้วกรองเอง ✅,
  ค้น "ๅ/-ภถุึ" เจอบาร์โค้ด 1234567 ✅, ติ๊กใกล้หมดกรองทันที ✅, ช่องบาร์โค้ดแปลงไทย→ตัวเลข ✅,
  สถานะเครื่องสแกน: ยิง → เชื่อมแล้ว → ซ่อนหน้า → ยังไม่พบ ✅, cookie `ep.session_token` 60 วัน ✅; build ✅

---

## 2026-11-17 — รูปสินค้า (ถ่ายจากกล้องในเว็บเท่านั้น) (branch dev)
- **กติกา (ผู้ใช้สั่ง):** ใส่รูปได้เฉพาะถ่ายจากกล้องในเว็บ (ไม่มีเลือกไฟล์) เพื่อคุมขนาด
- `components/PhotoCapture.tsx`: กล้อง → ครอปสี่เหลี่ยมจัตุรัสกลางภาพ **600×600** → WebP (Safari ใช้ JPEG) ลดคุณภาพจน ≤150KB
- `inventory/ProductPhotoField.tsx`: ถ่าย/ถ่ายใหม่/ลบ — ใส่รูปลง `<input type=file name=photo hidden>` ด้วย DataTransfer แล้วส่งพร้อมฟอร์ม
- server (`inventory/actions.ts`): จำกัด 300KB + ตรวจหัวไฟล์ (JPEG/WebP) → อัปโหลด path สุ่ม `stores/{storeId}/products/{id}-{rand}.webp`
  → `products.image_path` (migration `0003`); ลบรูปเก่าเมื่อเปลี่ยน/ลบรูป/ลบสินค้า/ลบบัญชี (ลบทั้งโฟลเดอร์ร้าน)
  - รูปพังไม่ทำให้บันทึกสินค้าพัง → เด้งไปหน้าแก้ไขพร้อมข้อความให้ถ่ายใหม่
- ที่เก็บไฟล์เป็น port `core/ports/storage.ts` + adapter `adapters/storage/supabase.ts` (REST, ไม่ลง SDK) → ย้ายไป R2/S3 ได้
  - env: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (sb_secret_ ส่งทาง header apikey), `STORAGE_BUCKET=product-images`; ไม่ตั้ง = ซ่อนฟีเจอร์รูป
  - bucket `product-images` สร้างแล้ว: public read, จำกัด 300KB, รับเฉพาะ image/webp + image/jpeg
- แสดงรูป: การ์ดสินค้าในหน้าขาย, รูปย่อในคลังสินค้า, หน้าแก้ไข (ใช้ `<img>` ตรง ไม่ผ่าน Image Optimization ของ Vercel เพื่อไม่กินโควตา)
- ตรวจแล้ว: bucket ทดสอบตรง (อัปโหลด/อ่าน/ปฏิเสธไฟล์ text/ลบ) ✅; ฟอร์มจริง: บันทึกสินค้า+รูป WebP 4.4KB → อยู่ใน storage + แสดงในคลัง/หน้าขาย ✅;
  ลบสินค้า → ไฟล์ถูกลบ (list ว่าง; URL สาธารณะอาจค้าง CDN ชั่วคราว แต่ไม่มีใครอ้างถึงแล้ว) ✅; build ✅
- ยังไม่ได้ทดสอบกล้องจริง (เบราว์เซอร์ทดสอบไม่มีกล้อง) — **ก่อน deploy ต้องใส่ `SUPABASE_URL` + `SUPABASE_SECRET_KEY` บน Vercel**

---

## 2026-11-16 — แก้: สแกนแล้วสถานะไม่เปลี่ยน + เชื่อมเครื่องสแกนผ่าน Bluetooth (branch dev)
- ผู้ใช้รายงาน: ยิงเครื่องสแกนแล้วสถานะไม่เปลี่ยน → ตัวจับเข้มเกิน/ไม่รองรับบางแบบ แก้ใน `client/devices/scanner.ts`:
  - เกณฑ์เวลา: ห่างสูงสุด 80→150ms, เฉลี่ย 45→70ms/ตัว (เครื่อง Bluetooth บางรุ่นช้ากว่าแบบสาย)
  - เครื่องที่ **ไม่ส่ง Enter** ต่อท้าย: เงียบ 180ms + ยาว ≥6 ตัว = จบรหัส
  - เบราว์เซอร์ที่ **ไม่ส่ง event.code** (Android บางรุ่น): แปลงอักษรไทยเกษมณีกลับเป็นปุ่มอังกฤษ;
    ถ้าทั้งชุดมีอักษรไทย "/" "-" จะถูกตีความเป็น 2, 3
- **เชื่อมเครื่องสแกนผ่าน Bluetooth (BLE)**: ปุ่มในหน้าต่างเครื่องสแกน → เบราว์เซอร์เด้งหน้าต่างเลือกอุปกรณ์ →
  เชื่อมสำเร็จ สถานะ "เชื่อมแล้ว · ผ่าน Bluetooth: ชื่อเครื่อง" (ตัดการเชื่อม → กลับเป็นยังไม่พบ)
  - รับข้อมูลจาก characteristic แบบ notify (Nordic UART, FFE0, FFF0, ISSC ...)
  - เครื่องที่เป็นโหมดคีย์บอร์ด (HID) เว็บเชื่อมตรงไม่ได้ (เบราว์เซอร์บล็อก) → แสดงคำแนะนำให้จับคู่ในตั้งค่าเครื่องแทน
- ตรวจแล้ว (จำลองเวลา): 60ms/ตัว+Enter ✅, คนพิมพ์ 130ms/ตัว ไม่นับ ✅, ไม่มี event.code+แป้นไทย ✅, ไม่มี Enter ✅; build ✅
- ยังไม่ได้ทดสอบกับเครื่องสแกนจริง

---

## 2026-11-16 — เชื่อมเครื่องพิมพ์สลิป + เครื่องสแกน + แก้สแกนตอนคีย์บอร์ดภาษาไทย (branch dev)
**เครื่องสแกน (USB/Bluetooth แบบคีย์บอร์ด)** — `src/client/devices/scanner.ts`
- อ่าน `event.code` (ตำแหน่งปุ่ม) แทน `event.key` → คีย์บอร์ดภาษาไทย/ภาษาอื่นก็ได้ตัวเลข/อักษรถูก
- แยกการสแกนจากคนพิมพ์: ≥4 ตัว, เฉลี่ย ≤45ms/ตัว, จบด้วย Enter/Tab → กัน Enter submit ฟอร์ม + คืนค่าช่องที่โดนพิมพ์ทับ
- ไม่ต้องคลิกช่องก่อน: หน้าไหนเปิดอยู่ก็รับการสแกน (`useBarcodeScanner`, handler ล่าสุดชนะ)
  - หน้าขาย: หยิบใส่ตะกร้า | ฟอร์มสินค้า: กรอกช่องบาร์โค้ด | คลังสินค้า: ค้นหา | รับเข้า: เลือกสินค้า + โฟกัสช่องจำนวน
- สถานะ "เชื่อมแล้ว" = เห็นการสแกนจริงใน 12 ชม. (เครื่องแบบคีย์บอร์ดไม่มีสัญญาณเชื่อมต่อให้อ่าน) + หน้าต่างวิธีเชื่อม/ทดสอบ
**เครื่องพิมพ์สลิป (ESC/POS)** — `src/client/devices/printer.ts`, `escpos.ts`, `slip.ts`
- Web Bluetooth (Android/คอม Chrome) + WebUSB (คอม/Android OTG); iPhone ไม่รองรับ → แสดงข้อความ + ใช้พิมพ์ผ่านเบราว์เซอร์
- พิมพ์เป็น **รูปขาวดำ (GS v 0)** วาดจาก canvas → ภาษาไทยออกถูกทุกยี่ห้อ ไม่ต้องตั้งโค้ดเพจ; กระดาษ 58/80 มม.; ตัดกระดาษถ้ามีมีด
- USB ที่เคยอนุญาตต่อให้อัตโนมัติเมื่อเปิดหน้า; Bluetooth ต้องกดเชื่อมใหม่หลังรีเฟรช (ข้อจำกัดเบราว์เซอร์)
- ตัวเลือก "พิมพ์สลิปอัตโนมัติหลังขาย", ปุ่มพิมพ์ทดสอบ; ปุ่ม "พิมพ์ใบเสร็จ" ใช้เครื่องที่เชื่อมไว้ ไม่มีก็ใช้ window.print
- ตรวจแล้ว (local, จำลองคีย์บอร์ดภาษาไทย): ฟอร์มสินค้า → ช่องบาร์โค้ดได้ 8851234567898, ชื่อสินค้าไม่เพี้ยน, Enter ไม่ submit ✅;
  หน้าขาย สแกน 2 ครั้ง → ตะกร้า 2 ชิ้น ช่องค้นหาไม่มีอักษรเพี้ยน ✅; build ✅
- **ยังไม่ได้ทดสอบกับเครื่องพิมพ์/เครื่องสแกนจริง** (เบราว์เซอร์ทดสอบไม่มี Bluetooth/USB)

---

## 2026-11-16 — อายุ session + รีเฟรชอัตโนมัติ + บังคับเวอร์ชันล่าสุด (branch dev)
**กติกา (ผู้ใช้สั่ง):**
- ~~10 วันตายตัว~~ → ผู้ใช้เปลี่ยนเป็น **แบบ Facebook**: ใช้อยู่ = ค้างไปเรื่อยๆ, ไม่ได้เข้า **60 วัน** = ล็อกอินใหม่
  (`session.expiresIn = 60 วัน`, `updateAge = 1 วัน` ต่ออายุเมื่อเข้าใช้)
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
