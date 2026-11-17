// ===== Port: ที่เก็บไฟล์ (รูปสินค้า) =====
// ตอนนี้ใช้ Supabase Storage — ย้ายไป Cloudflare R2 / S3 / GCS: เขียน adapter ใหม่ + แก้ src/server/container.ts จุดเดียว

export interface FileStorage {
  /** อัปโหลด/ทับไฟล์ */
  put(path: string, data: Uint8Array, contentType: string): Promise<void>;
  remove(paths: string[]): Promise<void>;
  /** ลบทุกไฟล์ที่ขึ้นต้นด้วย prefix (เช่น ลบร้าน → ลบรูปทั้งร้าน) */
  removePrefix(prefix: string): Promise<void>;
  /** URL สาธารณะสำหรับแสดงรูป */
  publicUrl(path: string): string;
}
