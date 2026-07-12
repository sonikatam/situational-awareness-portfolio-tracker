import { Database } from "lucide-react";

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-zinc-300 bg-white px-6 text-center">
      <Database className="mb-4 size-7 text-zinc-400" aria-hidden="true" />
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">{detail}</p>
    </div>
  );
}

