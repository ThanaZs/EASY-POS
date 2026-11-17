import "server-only";
import type { FileStorage } from "@/core/ports/storage";

// Supabase Storage ผ่าน REST API (ไม่ต้องลง SDK) — ใช้ secret/service_role key ฝั่ง server เท่านั้น
export function createSupabaseStorage(opts: { url: string; key: string; bucket: string }): FileStorage {
  const base = `${opts.url.replace(/\/$/, "")}/storage/v1`;
  // key แบบเก่า (JWT "eyJ...") ส่งได้ทั้ง apikey + Bearer; key แบบใหม่ (sb_secret_...) ส่งทาง apikey
  const auth: Record<string, string> = opts.key.startsWith("eyJ")
    ? { apikey: opts.key, Authorization: `Bearer ${opts.key}` }
    : { apikey: opts.key };
  const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

  async function check(res: Response, what: string) {
    if (!res.ok) throw new Error(`storage ${what} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  return {
    async put(path, data, contentType) {
      const res = await fetch(`${base}/object/${opts.bucket}/${enc(path)}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "max-age=31536000" },
        body: data as unknown as BodyInit,
      });
      await check(res, "upload");
    },
    async remove(paths) {
      if (!paths.length) return;
      const res = await fetch(`${base}/object/${opts.bucket}`, {
        method: "DELETE",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: paths }),
      });
      await check(res, "delete");
    },
    async removePrefix(prefix) {
      // list ทีละชั้น (Supabase list ไม่ไล่โฟลเดอร์ย่อยให้)
      const walk = async (dir: string): Promise<string[]> => {
        const res = await fetch(`${base}/object/list/${opts.bucket}`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: dir, limit: 1000 }),
        });
        await check(res, "list");
        const items = (await res.json()) as Array<{ name: string; id: string | null }>;
        const out: string[] = [];
        for (const it of items) {
          const full = `${dir}/${it.name}`;
          if (it.id) out.push(full);
          else out.push(...(await walk(full))); // id = null → โฟลเดอร์
        }
        return out;
      };
      const files = await walk(prefix.replace(/\/$/, ""));
      for (let i = 0; i < files.length; i += 500) await this.remove(files.slice(i, i + 500));
    },
    publicUrl(path) {
      return `${base}/object/public/${opts.bucket}/${enc(path)}`;
    },
  };
}
