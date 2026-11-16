# EASY-POS

เว็บแอป POS (ระบบขายหน้าร้าน) ที่ใช้ได้ทั้งมือถือและคอม รองรับหลายภาษา หลายทามโซน หลายร้านค้า
ต่อยอดจากโปรเจกต์เดิม **SmartStock** (เว็บเช็คสต็อก) และได้แรงบันดาลใจด้านการใช้งานจากแอป Shop Champ

> 📌 **ย้ายเครื่อง / ทำต่อ?** อ่าน [docs/PROGRESS.md](docs/PROGRESS.md) ก่อนเสมอ — มีสถานะล่าสุดและงานถัดไป

## เริ่มใช้งานบนเครื่องใหม่

ต้องมี: Node.js 22+ และ Git

```bash
git clone <URL ของ repo นี้>
cd easy-pos
npm install
cp .env.example .env.local   # แล้วใส่ค่า (ยังไม่ใส่ก็รันดู UI ได้)
npm run dev                  # เปิด http://localhost:3000
```

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
