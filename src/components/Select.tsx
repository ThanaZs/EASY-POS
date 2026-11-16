export function Select({
  label,
  options,
  ...props
}: { label: string; options: Array<{ value: string; label: string }> } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-muted">{label}</span>
      <select
        {...props}
        className="w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-brand"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export const timeZoneOptions = () =>
  Intl.supportedValuesOf("timeZone").map((z) => ({ value: z, label: z.replaceAll("_", " ") }));

export const currencyOptions = ["THB", "USD", "EUR", "JPY", "SGD", "LAK", "MMK", "KHR", "VND"].map((c) => ({
  value: c,
  label: c,
}));
