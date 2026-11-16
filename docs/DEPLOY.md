# การ Deploy

## แบบที่ใช้ตอนนี้ (ฟรี): GitHub → Vercel + Supabase

### 1) สร้างฐานข้อมูลบน Supabase
1. สมัคร https://supabase.com → New project (เลือก region Singapore ใกล้ไทยสุด)
2. ปุ่ม **Connect** (บนสุด) → **Direct** → Method **Transaction pooler** (port 6543) คัดลอกมา
   - ห้ามใช้ `db.<ref>.supabase.co:5432` (Direct) — เป็น IPv6 อย่างเดียว ต่อจาก Vercel/เน็ตบ้านส่วนใหญ่ไม่ได้
   - Supabase ไม่แสดงรหัสฐานข้อมูล — ลืมให้กด Reset database password
3. ใส่ในเครื่องที่ `.env.local` เป็น `DATABASE_URL=...` (แทนรหัส `[YOUR-PASSWORD]` ด้วยรหัสฐานข้อมูลที่ตั้งตอนสร้าง project) และตั้ง `DATABASE_POOL_MAX=5`
4. สร้างตาราง (ไฟล์ migration อยู่ใน `drizzle/` แล้ว):
   ```bash
   npm run db:migrate
   ```
   (`drizzle.config.ts` อ่าน `.env.local` ให้เอง)
   - แก้ schema ภายหลัง: `npm run db:generate` (สร้างไฟล์ migration ใหม่) แล้ว `db:migrate`
   - migration `0001_enable_rls` เปิด RLS ทุกตาราง เพื่อปิด Supabase Data API — ตารางใหม่ต้องเปิด RLS ด้วย

### ทดสอบในเครื่องโดยไม่มี Supabase (PGlite)
Postgres แบบ WASM ในหน่วยความจำ — ข้อมูลหายเมื่อปิด
```bash
npx @electric-sql/pglite-socket --port=55432 --max-connections=10
```
แล้วตั้ง `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres` และ **`DATABASE_POOL_MAX=1`** (PGlite รับ query ขนานจากหลาย connection ไม่ได้) → `db:migrate` → `npm run dev`

### 2) Deploy บน Vercel
1. https://vercel.com → Add New Project → Import repo `easy-pos` จาก GitHub
2. Environment Variables: ใส่ค่าตาม `.env.example` (อย่างน้อย `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` = URL จริงของ Vercel เช่น `https://easy-pos.vercel.app`)
   - Google login: Google Cloud Console → OAuth client → Authorized redirect URI = `<APP_URL>/api/auth/callback/google`
3. Deploy — หลังจากนี้ทุกครั้งที่ `git push` ขึ้น `main` Vercel จะ deploy ให้อัตโนมัติ

> ⚠️ Vercel แผน Hobby (ฟรี) ระบุว่าใช้ได้เฉพาะ **ส่วนตัว/ไม่ใช่เชิงพาณิชย์** ถ้าเริ่มใช้ในร้านจริงจัง/ขายให้คนอื่น ให้อัปเกรดเป็น Pro หรือย้ายไปที่อื่นตามด้านล่าง
> ⚠️ Supabase ฟรีจะ pause ถ้าไม่มีการใช้งาน 7 วัน — ถ้าใช้ทุกวันไม่มีปัญหา

## ย้ายไปที่อื่น (โค้ดเดิม เปลี่ยนแค่ env)

| ไปที่ | ทำอย่างไร |
|---|---|
| Docker / VPS / Cloud Run / Railway / Fly.io | `next.config.ts` ตั้ง `output: "standalone"` ไว้แล้ว → `npm run build` แล้วรัน `node .next/standalone/server.js` (คัดลอก `.next/static` และ `public` ไปด้วย) |
| Netlify / Cloudflare | ใช้ adapter ของแต่ละเจ้าสำหรับ Next.js |
| ฐานข้อมูล Neon / RDS / Cloud SQL | `pg_dump` จากที่เดิม → `psql` เข้าที่ใหม่ → เปลี่ยน `DATABASE_URL` |
| Backend แยก | ย้าย `src/core` ไปใช้ใน server ใหม่ แล้วเขียน adapter `http-api` (ดู ARCHITECTURE.md) |
