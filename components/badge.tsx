import type { ChangeClassification } from "@/lib/types";

const styles: Record<ChangeClassification, string> = {
  NEW: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INCREASED: "bg-blue-50 text-blue-700 ring-blue-200",
  REDUCED: "bg-amber-50 text-amber-800 ring-amber-200",
  EXITED: "bg-rose-50 text-rose-700 ring-rose-200",
  UNCHANGED: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export function ChangeBadge({ value }: { value: ChangeClassification | null }) {
  if (!value) return <span className="text-zinc-400">—</span>;
  return <span className={`inline-flex rounded px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${styles[value]}`}>{value}</span>;
}

