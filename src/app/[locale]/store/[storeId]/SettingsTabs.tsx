import { SubTabs } from "@/components/SubTabs";
import { can } from "@/core/domain/permissions";
import type { StoreMember } from "@/core/domain/types";
import type { Dictionary } from "@/i18n/dictionary";

/** แท็บของ "ตั้งค่าร้าน": ข้อมูลร้าน | พนักงาน & รหัสเชิญ | ประวัติการแก้ไข — แสดงตามสิทธิ์ */
export function SettingsTabs({
  locale,
  storeId,
  member,
  t,
  active,
}: {
  locale: string;
  storeId: string;
  member: StoreMember;
  t: Dictionary["store"]["tabs"];
  active: "settings" | "staff" | "activity";
}) {
  const base = `/${locale}/store/${storeId}`;
  const tabs = [
    can(member, "store.settings") && {
      key: "settings",
      href: `${base}/settings`,
      label: t.storeInfo,
    },
    can(member, "staff.manage") && {
      key: "staff",
      href: `${base}/staff`,
      label: t.staff,
    },
    (can(member, "store.settings") || can(member, "staff.manage")) && {
      key: "activity",
      href: `${base}/activity`,
      label: t.activity,
    },
  ].filter((x): x is { key: string; href: string; label: string } => !!x);
  return (
    <SubTabs
      tabs={tabs.map((x) => ({
        href: x.href,
        label: x.label,
        active: x.key === active,
      }))}
    />
  );
}
