"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { ChangeBadge } from "@/components/badge";
import { integer, money, percent } from "@/lib/format";
import type { Position } from "@/lib/types";

type SortKey = "issuer_name" | "ticker" | "value_usd" | "quantity" | "weight" | "quantity_change";

export function PortfolioTable({ positions }: { positions: Position[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("value_usd");
  const [ascending, setAscending] = useState(false);
  const total = positions.reduce((sum, item) => sum + item.value_usd, 0);
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return positions
      .filter((item) => !normalized || [item.issuer_name, item.ticker, item.cusip, item.title_of_class].some((value) => value?.toLowerCase().includes(normalized)))
      .toSorted((a, b) => {
        const av = sort === "weight" ? a.value_usd / total : (a[sort] ?? "");
        const bv = sort === "weight" ? b.value_usd / total : (b[sort] ?? "");
        const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return ascending ? result : -result;
      });
  }, [positions, query, sort, ascending, total]);

  const sortButton = (key: SortKey, label: string) => (
    <button className="inline-flex items-center gap-1 font-semibold hover:text-zinc-950" onClick={() => { setAscending(sort === key ? !ascending : false); setSort(key); }}>
      {label}<ArrowUpDown className="size-3" aria-hidden="true" />
    </button>
  );

  return (
    <div>
      <label className="mb-4 flex max-w-sm items-center gap-2 border border-zinc-300 bg-white px-3 py-2 text-sm focus-within:border-zinc-900">
        <Search className="size-4 text-zinc-400" aria-hidden="true" />
        <span className="sr-only">Search positions</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issuer, ticker, CUSIP" className="w-full bg-transparent outline-none placeholder:text-zinc-400" />
      </label>
      <div className="overflow-x-auto border border-zinc-200 bg-white">
        <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th scope="col" className="px-4 py-3">{sortButton("issuer_name", "Issuer")}</th>
              <th scope="col" className="px-4 py-3">{sortButton("ticker", "Ticker")}</th>
              <th scope="col" className="px-4 py-3">CUSIP</th><th scope="col" className="px-4 py-3">Class</th>
              <th scope="col" className="px-4 py-3 text-right">{sortButton("quantity", "Quantity")}</th>
              <th scope="col" className="px-4 py-3 text-right">{sortButton("value_usd", "Value")}</th>
              <th scope="col" className="px-4 py-3 text-right">{sortButton("weight", "Weight")}</th>
              <th scope="col" className="px-4 py-3">Type</th>
              <th scope="col" className="px-4 py-3 text-right">{sortButton("quantity_change", "Qty change")}</th>
              <th scope="col" className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-50/80">
                <td className="max-w-64 px-4 py-3 font-medium text-zinc-900">{item.issuer_name}</td><td className="px-4 py-3 font-mono">{item.ticker ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{item.cusip}</td><td className="px-4 py-3 text-zinc-600">{item.title_of_class}</td>
                <td className="px-4 py-3 text-right tabular-nums">{integer.format(item.quantity)} <span className="text-xs text-zinc-400">{item.share_principal_type}</span></td>
                <td className="px-4 py-3 text-right tabular-nums">{money.format(item.value_usd)}</td><td className="px-4 py-3 text-right tabular-nums">{percent.format(item.value_usd / total)}</td>
                <td className="px-4 py-3"><span className="rounded bg-zinc-100 px-2 py-1 text-xs font-semibold">{item.put_call || "Shares"}</span></td>
                <td className="px-4 py-3 text-right tabular-nums">{item.quantity_change == null ? "—" : `${item.quantity_change > 0 ? "+" : ""}${integer.format(item.quantity_change)}`}</td>
                <td className="px-4 py-3"><ChangeBadge value={item.classification} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">No positions match this search.</p> : null}
      </div>
    </div>
  );
}

