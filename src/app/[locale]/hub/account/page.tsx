import { Alert, pickMessage } from "@/components/Alert";
import { PageTitle } from "@/components/PageTitle";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { Select, timeZoneOptions } from "@/components/Select";
import { localeLabels, locales } from "@/i18n/config";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireUser } from "@/server/session";
import { forgotPasswordAction } from "../../(auth)/actions";
import { changePasswordAction, saveAccountAction } from "../actions";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

export default async function AccountPage({
  params,
  searchParams,
}: PageProps<"/[locale]/hub/account">) {
  const { locale, t } = await loadLocale(params);
  const user = await requireUser(locale);
  const sp = await searchParams;
  const a = t.account;
  const repos = await getRepositories();
  const [hasPassword, memberships] = await Promise.all([
    repos.users.hasPassword(user.id),
    repos.stores.listForUser(user.id),
  ]);
  const ownedStores = memberships
    .filter((m) => m.member.role === "owner")
    .map((m) => m.store.name);
  const pwError = pickMessage(a.pwErrors, sp.pw);

  // ส่ง OTP ไปที่อีเมลของบัญชีนี้ → หน้า /reset (ใช้ได้ทั้งลืมรหัส และบัญชี Google ที่อยากตั้งรหัส)
  const otpButton = (label: string) => (
    <form action={forgotPasswordAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="email" value={user.email} />
      <button
        type="submit"
        className="text-sm font-semibold text-brand-ink hover:underline"
      >
        {label}
      </button>
    </form>
  );

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageTitle title={t.hub.account} />
      <Card>
        <form action={saveAccountAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          {sp.saved === "1" && <Alert kind="success">{a.saved}</Alert>}
          <p className="text-sm text-muted">{user.email}</p>
          <Field
            label={a.displayName}
            name="displayName"
            defaultValue={user.displayName}
            maxLength={80}
            required
          />
          <Select
            label={a.language}
            name="newLocale"
            defaultValue={locale}
            options={locales.map((l) => ({ value: l, label: localeLabels[l] }))}
          />
          <Select
            label={a.timezone}
            name="timeZone"
            options={timeZoneOptions()}
            defaultValue={user.timeZone}
          />
          <PrimaryButton type="submit">{a.save}</PrimaryButton>
        </form>
      </Card>

      <section id="password" className="scroll-mt-20">
        <Card>
          <h2 className="mb-4 font-semibold">{a.passwordTitle}</h2>
          {hasPassword ? (
            <>
              <form action={changePasswordAction} className="space-y-4">
                <input type="hidden" name="locale" value={locale} />
                {sp.pw === "ok" && (
                  <Alert kind="success">{a.passwordChanged}</Alert>
                )}
                {pwError && <Alert>{pwError}</Alert>}
                {/* ช่วยให้ password manager รู้ว่าเป็นบัญชีไหน */}
                <input
                  type="email"
                  name="username"
                  value={user.email}
                  autoComplete="username"
                  readOnly
                  hidden
                />
                <Field
                  label={a.currentPassword}
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <Field
                  label={a.newPassword}
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <PrimaryButton type="submit">{a.changePassword}</PrimaryButton>
              </form>
              <div className="mt-3 text-center">
                {otpButton(a.forgotCurrent)}
              </div>
            </>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted">{a.noPassword}</p>
              {otpButton(a.setPassword)}
            </div>
          )}
        </Card>
      </section>

      <DeleteAccountDialog
        locale={locale}
        ownedStores={ownedStores}
        mismatch={sp.del === "mismatch"}
        labels={{
          deleteAccount: a.deleteAccount,
          deleteTitle: a.deleteTitle,
          deleteWarn: a.deleteWarn,
          deleteAccountData: a.deleteAccountData,
          deleteStores: a.deleteStores,
          deleteNoStores: a.deleteNoStores,
          deleteTypePrompt: a.deleteTypePrompt,
          deleteWord: a.deleteWord,
          deleteConfirm: a.deleteConfirm,
          cancel: a.cancel,
          deleteMismatch: a.deleteMismatch,
        }}
      />
    </div>
  );
}
