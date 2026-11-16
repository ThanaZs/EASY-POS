@AGENTS.md

# EASY-POS — คำแนะนำสำหรับ Claude

- เริ่ม session: อ่าน `docs/PROGRESS.md` และ `docs/ROADMAP.md` ก่อน แล้วสรุปให้ผู้ใช้ว่าจะทำต่อจากตรงไหน
- จบงานแต่ละรอบ: เพิ่มรายการใหม่บนสุดของ `docs/PROGRESS.md` (วันที่, ทำอะไร, ตรวจอะไรแล้ว, ข้อสังเกต) และติ๊ก ROADMAP
- ผู้ใช้สื่อสารภาษาไทย — ตอบเป็นภาษาไทย, คอมเมนต์ในโค้ดเป็นไทยได้
- สถาปัตยกรรม: `docs/ARCHITECTURE.md` — `src/core` ห้าม import next/drizzle/adapters; เข้าถึงข้อมูลผ่าน `getRepositories()` เท่านั้น
- ข้อความบน UI ทุกอันต้องอยู่ใน `src/i18n/messages/*.json` (th และ en ต้องมี key ตรงกัน)
- เงิน = จำนวนเต็มหน่วยย่อย, เวลา = UTC ใน DB, query ต้องกรอง `store_id`
- ก่อน commit: `npm run lint && npm run build`
- **วิธีทำงาน (ผู้ใช้ต้องการประหยัด token):** พัฒนาบน branch `dev` และทดสอบที่ localhost เท่านั้น
  - push `dev` ขึ้น GitHub ได้ (สำรองงาน/ย้ายเครื่อง) — `vercel.json` ปิด deploy ทุก branch ยกเว้น `main`
  - ห้าม push/merge เข้า `main` จนกว่าผู้ใช้สั่ง deploy (push `main` = deploy ขึ้นเว็บจริงทันที)
  - ไม่ต้องรอ/ทดสอบบนเว็บ Vercel ทุกครั้งที่แก้
- ห้าม commit ไฟล์ `.env*` (ยกเว้น `.env.example`) และไฟล์สำรอง SmartStock
