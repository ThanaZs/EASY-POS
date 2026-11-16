export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-muted">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
      />
    </label>
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full rounded-xl bg-brand px-4 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
    />
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">{children}</div>;
}
