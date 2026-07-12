import { EmptyState } from "@/components/empty-state";
import { PortfolioTable } from "@/components/portfolio-table";
import { formatDate } from "@/lib/format";
import { getLatestFiling, getPositions } from "@/lib/data";

export const metadata = { title: "Latest Portfolio" };
export default async function PortfolioPage() { const filing = await getLatestFiling(); const positions = filing ? await getPositions(filing.id) : []; return <><div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-xs font-bold uppercase text-emerald-700">Latest 13F</p><h1 className="text-2xl font-semibold">Disclosed portfolio</h1></div>{filing ? <div className="text-sm sm:text-right"><p><strong>Report:</strong> {formatDate(filing.report_period)}</p><p className="mt-1 text-zinc-500"><strong>Filed:</strong> {formatDate(filing.filing_date)}</p></div> : null}</div>{positions.length ? <PortfolioTable positions={positions} /> : <EmptyState title="No portfolio available" detail="No successfully processed 13F positions are available yet." />}</>; }

