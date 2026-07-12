export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

export const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

export function formatDate(value: string | null): string {
  if (!value) return "Not reported";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

