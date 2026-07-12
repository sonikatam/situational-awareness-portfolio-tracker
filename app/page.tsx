import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, FileClock, Layers3, PieChart } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatDate, money, percent } from "@/lib/format";
import { getChanges, getLatestFiling, getPositions } from "@/lib/data";

export default async function Dashboard() {
  const filing = await getLatestFiling();
  if (!filing) return <><PageTitle /><EmptyState title="No processed 13F filing yet" detail="Run the historical importer after applying the Supabase migration. The dashboard will populate from official SEC filings." /></>;
  const positions = await getPositions(filing.id);
  const changes = await getChanges(filing.id);
  const total = positions.reduce((sum, item) => sum + item.value_usd, 0);
  const topFive = positions.toSorted((a,b) => b.value_usd-a.value_usd).slice(0,5).reduce((sum,item) => sum+item.value_usd,0) / total;
  const count = (classification: string) => changes.filter((item) => item.classification === classification).length;
  const stats = [
    ["Disclosed value", money.format(total), PieChart], ["Positions", positions.length.toString(), Layers3], ["Top-five concentration", percent.format(topFive || 0), PieChart],
    ["New", count("NEW").toString(), ArrowRight], ["Increased", count("INCREASED").toString(), ArrowRight], ["Reduced", count("REDUCED").toString(), ArrowRight], ["Exited", count("EXITED").toString(), ArrowRight],
  ] as const;
  return <><PageTitle /><section className="mb-6 grid border border-zinc-200 bg-white sm:grid-cols-2"><div className="p-5 sm:border-r sm:border-zinc-200"><span className="text-xs font-semibold uppercase text-zinc-500">Report period</span><p className="mt-2 flex items-center gap-2 text-xl font-semibold"><CalendarDays className="size-5 text-zinc-400" />{formatDate(filing.report_period)}</p></div><div className="border-t border-zinc-200 p-5 sm:border-t-0"><span className="text-xs font-semibold uppercase text-zinc-500">Published by SEC</span><p className="mt-2 flex items-center gap-2 text-xl font-semibold"><FileClock className="size-5 text-zinc-400" />{formatDate(filing.filing_date)}</p></div></section><div className="mb-6 flex gap-3 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><p><strong>Historical disclosure.</strong> This portfolio reflects the reporting date above, was published later, and does not establish what the manager holds today.</p></div><section className="grid border-l border-t border-zinc-200 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label,value,Icon]) => <div key={label} className="border-b border-r border-zinc-200 bg-white p-5"><Icon className="mb-6 size-4 text-zinc-400" /><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-sm text-zinc-500">{label}</p></div>)}</section><div className="mt-6 flex flex-wrap gap-3"><Link href="/portfolio" className="inline-flex items-center gap-2 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white">Inspect portfolio <ArrowRight className="size-4" /></Link><a href={filing.sec_url} target="_blank" rel="noreferrer" className="border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold">Official SEC filing</a></div></>;
}

function PageTitle() { return <div className="mb-7"><p className="mb-2 text-xs font-bold uppercase text-emerald-700">CIK 0002045724</p><h1 className="text-2xl font-semibold sm:text-3xl">Disclosed portfolio overview</h1><p className="mt-2 text-sm text-zinc-500">Situational Awareness LP · public SEC filings</p></div>; }
