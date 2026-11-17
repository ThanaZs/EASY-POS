# EASY-POS

**ใช้งาน:** https://easy-pos-beta.vercel.app

เว็บแอป POS (ระบบขายหน้าร้าน) ที่ใช้ได้ทั้งมือถือและคอม รองรับหลายภาษา หลายทามโซน หลายร้านค้า
ต่อยอดจากโปรเจกต์เดิม **SmartStock** (เว็บเช็คสต็อก) และได้แรงบันดาลใจด้านการใช้งานจากแอป Shop Champ

> 📌 **ย้ายเครื่อง / ทำต่อ?** อ่าน [docs/PROGRESS.md](docs/PROGRESS.md) ก่อนเสมอ — มีสถานะล่าสุดและงานถัดไป

## เริ่มใช้งานบนเครื่องใหม่

ต้องมี: Node.js 22+ และ Git

```bash
git clone https://github.com/ThanaZs/EASY-POS.git easy-pos
cd easy-pos
git checkout dev              # ทำงานบน dev เสมอ (push main = deploy เว็บจริงทันที)
npm install                   # Windows ถ้า esbuild error: npm install --ignore-scripts แล้ว node scripts/copy-wasm.mjs
cp .env.example .env.local    # แล้วใส่ค่าจริง (ดูหัวข้อ "ค่าลับ" ด้านล่าง)
npm run dev                   # เปิด http://localhost:3000
```

### ค่าลับ (ไม่อยู่ใน git — ห้าม commit)
ค่าจริงทุกตัวอยู่ที่ **Vercel → project easy-pos → Settings → Environment Variables** (คัดลอกมาใส่ `.env.local`)
แล้วเพิ่ม 2 บรรทัดสำหรับเครื่อง dev: `APP_URL=http://localhost:3000` และ `DATABASE_POOL_MAX=5`
- Supabase secret key / รหัส DB: Supabase → Project Settings (ไม่แสดงซ้ำ — ถ้าหายให้ reset แล้วอัปเดตใน Vercel ด้วย)
- Gmail App Password: myaccount.google.com/apppasswords (สร้างใหม่ได้)

### บริการภายนอกที่ใช้ (ล็อกอินด้วยบัญชีเจ้าของ)
| บริการ | ใช้ทำอะไร | หมายเหตุ |
|---|---|---|
| GitHub `ThanaZs/EASY-POS` | เก็บโค้ด | branch `dev` = ทำงาน, `main` = เว็บจริง |
| Vercel project `easy-pos` | เว็บจริง https://easy-pos-beta.vercel.app | region `hnd1` (Tokyo) ใน `vercel.json` |
| Supabase project `easy-pos` (Tokyo) | Postgres + เก็บรูป (bucket `product-images`) | ใช้ Transaction pooler `aws-1-ap-northeast-1` |
| Google Cloud project `EASY-POS` | ปุ่ม Google login | โหมด Testing — ใช้ได้เฉพาะ test users |
| Gmail (SMTP) | ส่ง OTP / ลืมรหัสผ่าน | ชื่อผู้ส่ง "EASY-POS (no-reply)" |
| cron-job.org | ping `/api/health?db=1` ทุก 5 นาที | กันเครื่องเย็น + กัน Supabase pause |

### ให้ Claude ทำต่อ
เปิด Claude Code ในโฟลเดอร์นี้ → มันจะอ่าน `CLAUDE.md` → `docs/PROGRESS.md` (สถานะล่าสุด/บันทึกทุกงาน) + `docs/ROADMAP.md`

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันโหมดพัฒนา |
| `npm run build` / `npm start` | build และรันแบบ production |
| `npm run lint` | ตรวจโค้ด |
| `npm run db:generate` | สร้างไฟล์ migration จาก schema |
| `npm run db:migrate` | ส่ง migration ขึ้นฐานข้อมูลตาม `DATABASE_URL` |

## Stack (ฟรีทั้งหมดตอนนี้)

| ส่วน | ใช้ตอนนี้ | ย้ายไปได้ |
|---|---|---|
| Frontend + Backend | Next.js 16 (App Router) + TypeScript | Vercel / Docker / VPS / Cloud Run / Railway / Netlify |
| Database | PostgreSQL บน **Supabase** (free) ผ่าน Drizzle ORM | Neon, AWS RDS, Google Cloud SQL, Postgres ใน Docker |
| UI | Tailwind CSS 4 + lucide-react | — |
| ภาษา | ระบบ dictionary ในโปรเจกต์ (`src/i18n`) — ไทย/อังกฤษ | เพิ่มภาษาได้โดยเพิ่มไฟล์ JSON |

รายละเอียดสถาปัตยกรรม: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · การ deploy: [docs/DEPLOY.md](docs/DEPLOY.md) · แผนงาน: [docs/ROADMAP.md](docs/ROADMAP.md) · โปรเจกต์เดิม: [docs/LEGACY-SMARTSTOCK.md](docs/LEGACY-SMARTSTOCK.md)
