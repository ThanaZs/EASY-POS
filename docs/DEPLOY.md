# การ Deploy

## แบบที่ใช้ตอนนี้ (ฟรี): GitHub → Vercel + Supabase

### 1) สร้างฐานข้อมูลบน Supabase
1. สมัคร https://supabase.com → New project (เลือก region Singapore ใกล้ไทยสุด)
2. Project Settings → Database → Connection string → เลือก **Transaction pooler** (port 6543) คัดลอกมา
3. ใส่ในเครื่องที่ `.env.local` เป็น `DATABASE_URL=...`
4. สร้างตาราง:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

### 2) Deploy บน Vercel
1. https://vercel.com → Add New Project → Import repo `easy-pos` จาก GitHub
2. Environment Variables: ใส่ค่าตาม `.env.example` (อย่างน้อย `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`)
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
